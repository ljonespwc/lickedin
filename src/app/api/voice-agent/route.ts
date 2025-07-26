import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { streamResponse, verifySignature } from '@layercode/node-server-sdk'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// In-memory stores for deduplication and mutex
const recentRequests = new Map<string, number>() // requestHash -> timestamp
const responseMutex = new Map<string, boolean>() // sessionId -> isProcessing
const DEDUP_WINDOW_MS = 5000 // 5 second window for duplicate detection
const MUTEX_TIMEOUT_MS = 30000 // 30 second mutex timeout

// Type definitions
interface ConversationTurn {
  id: string
  session_id: string
  turn_number: number
  speaker: 'interviewer' | 'candidate'
  message_text: string
  message_type: 'main_question' | 'follow_up' | 'response' | 'transition' | 'closing'
  related_main_question_id?: string
  word_count?: number
  response_time_seconds?: number
  created_at: string
}

interface InterviewQuestion {
  id: string
  question_text: string
  question_order: number
  question_type: string
  addressed?: boolean // For tracking which questions have been covered
}

interface SessionContext {
  id: string
  difficulty_level: string
  interview_type: string
  voice_gender: string
  communication_style: string
  interview_questions: InterviewQuestion[]
  resumes: { parsed_summary: string }[]
  job_descriptions: { job_summary: string; company_name: string; job_title: string }[]
}

// Helper function to detect if candidate asked a question using AI
async function detectQuestionWithAI(candidateResponse: string): Promise<boolean> {
  if (!candidateResponse || candidateResponse.trim().length === 0) {
    return false
  }

  try {
    const prompt = `You are analyzing whether a candidate's response contains a question during an interview closing phase.

CANDIDATE RESPONSE: "${candidateResponse}"

Determine if this response contains a question (explicit or implied). Consider these examples:

QUESTIONS (return true):
- "What's the salary range?"
- "I'm wondering about the compensation structure."
- "I'm just wondering how much you'll pay me."
- "I have bills to pay, so what's the salary like?"
- "What's the pay for this position?"
- "How much does this job pay?"
- "I was wondering about the compensation."
- "Could you tell me about the benefits?"
- "I'd like to know more about the team."
- "How about work-life balance?"
- "I'm curious about remote work options."
- "What about career growth opportunities?"
- "I wanted to ask about the company culture."
- "Can you share more about the role?"
- "What are the next steps in the process?"
- "When would you need someone to start?"

NOT QUESTIONS (return false):
- "Thank you for your time."
- "I'm excited about this opportunity."
- "I look forward to hearing from you."
- "This sounds like a great fit."
- "I appreciate the conversation."
- "I have a big mortgage payment."
- "Money is important to me."

Respond with only "true" or "false".`

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at detecting questions in conversation. Respond only with 'true' or 'false'."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 5
    })

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase()
    return response === 'true'
  } catch (error) {
    console.error('Error detecting question with AI:', error)
    // Fallback to simple question mark detection
    return candidateResponse.includes('?')
  }
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Add startup logging
console.log('Voice Agent initialized with:', {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
  openaiKey: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING'
})

// Helper function to fetch session context from database
async function fetchSessionContext(sessionId: string): Promise<SessionContext | null> {
  try {
    // Get session basic info first
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select(`
        id,
        difficulty_level,
        interview_type,
        voice_gender,
        communication_style,
        resume_id,
        job_description_id
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Error fetching session context:', sessionError)
      return null
    }

    // Get resume data (use summary for voice conversations)
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .select('parsed_summary')
      .eq('id', session.resume_id)
      .single()

    if (resumeError) {
      console.error('Error fetching resume:', resumeError)
    }

    // Get job description data (use summary for voice conversations)
    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .select('job_summary, company_name, job_title')
      .eq('id', session.job_description_id)
      .single()

    if (jobError) {
      console.error('Error fetching job description:', jobError)
    }

    // Get interview questions
    const { data: questionsData, error: questionsError } = await supabase
      .from('interview_questions')
      .select('id, question_text, question_order, question_type')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true })

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
    }

    // Transform the data into the expected format
    const sessionContext: SessionContext = {
      id: session.id,
      difficulty_level: session.difficulty_level,
      interview_type: session.interview_type,
      voice_gender: session.voice_gender,
      communication_style: session.communication_style,
      interview_questions: questionsData || [],
      resumes: resumeData ? [{ parsed_summary: resumeData.parsed_summary }] : [],
      job_descriptions: jobData ? [{ 
        job_summary: jobData.job_summary,
        company_name: jobData.company_name,
        job_title: jobData.job_title
      }] : []
    }

    console.log('✅ Session context loaded successfully:', {
      sessionId,
      hasResume: sessionContext.resumes.length > 0,
      hasJobDescription: sessionContext.job_descriptions.length > 0,
      questionCount: sessionContext.interview_questions.length,
      resumeLength: sessionContext.resumes[0]?.parsed_summary?.length || 0,
      jobLength: sessionContext.job_descriptions[0]?.job_summary?.length || 0
    })

    return sessionContext
  } catch (error) {
    console.error('Exception in fetchSessionContext:', error)
    return null
  }
}

// Helper function to get recent conversation history
async function getRecentConversation(sessionId: string, limit: number = 10): Promise<ConversationTurn[]> {
  try {
    const { data: conversation, error } = await supabase
      .from('interview_conversation')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_number', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching conversation:', error)
      return []
    }

    // Return in chronological order (oldest first)
    return conversation.reverse()
  } catch (error) {
    console.error('Error in getRecentConversation:', error)
    return []
  }
}

// Helper function to get next turn number
async function getNextTurnNumber(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('interview_conversation')
      .select('turn_number')
      .eq('session_id', sessionId)
      .order('turn_number', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error getting turn number:', error)
      return 1
    }

    return data.length > 0 ? data[0].turn_number + 1 : 1
  } catch (error) {
    console.error('Error in getNextTurnNumber:', error)
    return 1
  }
}

// Helper function to build personalized system prompt
function buildSystemPrompt(sessionContext: SessionContext | null): string {
  if (!sessionContext) {
    return `You are a professional job interviewer conducting a voice interview for LickedIn Interviews. 

Guidelines:
- Keep responses conversational and natural for voice
- Ask thoughtful follow-up questions based on responses
- Be encouraging but maintain professionalism
- If this seems like the start of conversation, introduce yourself
- Ask about their background, experience, and motivations
- Limit responses to 1-2 sentences for natural conversation flow

Current interview context: This is a demo interview session.`
  }

  const resume = sessionContext.resumes?.[0]?.parsed_summary || 'No resume content available'
  const jobDescription = sessionContext.job_descriptions?.[0]?.job_summary || 'No job description available'
  const difficulty = sessionContext.difficulty_level
  const interviewType = sessionContext.interview_type
  const communicationStyle = sessionContext.communication_style
  
  // Get difficulty description
  const getDifficultyContext = (level: string): string => {
    const numLevel = parseInt(level) || 5
    if (numLevel <= 2) return "easy, encouraging approach suitable for entry-level"
    if (numLevel <= 5) return "standard professional level with moderate depth"
    if (numLevel <= 8) return "challenging questions requiring detailed examples"
    return "extremely difficult with expert-level technical depth"
  }
  
  // Legacy difficulty mapping
  const difficultyMap = {
    softball: "easy, encouraging approach suitable for entry-level",
    medium: "standard professional level with moderate depth",
    hard: "challenging questions requiring detailed examples", 
    hard_as_fck: "extremely difficult with expert-level technical depth"
  }
  
  const difficultyContext = difficultyMap[difficulty as keyof typeof difficultyMap] || getDifficultyContext(difficulty)
  
  // Get communication style and interview type instructions
  const styleInstructions = getCommunicationStyleInstructions(communicationStyle, interviewType)
  
  return `You are conducting a voice interview for LickedIn Interviews with ${difficultyContext}. ${styleInstructions}

CANDIDATE BACKGROUND:
${resume}

JOB REQUIREMENTS:
${jobDescription}

INTERVIEW CONFIGURATION:
- Type: ${interviewType} interview
- Communication Style: ${communicationStyle}
- Difficulty Level: ${difficultyContext}

CORE INSTRUCTIONS:
- Keep responses conversational and natural for voice (1-2 sentences max)
- Ask thoughtful follow-up questions to get deeper insights
- Work through the interview but allow natural conversation flow
- If this seems like the start, introduce yourself briefly
- Be encouraging but maintain professionalism
- Focus on getting detailed responses and building rapport

CURRENT CONTEXT: You are conducting a personalized ${interviewType} interview based on the candidate's resume and the specific job requirements above.`
}

// Helper function to detect response quality issues
function detectResponseQualityIssues(
  currentResponse: string,
  recentConversation: ConversationTurn[]
): { needsRecovery: boolean; reason: string } {
  if (!currentResponse) {
    return { needsRecovery: false, reason: 'No response provided' }
  }

  const response = currentResponse.trim()
  const wordCount = response.split(/\s+/).filter(word => word.length > 0).length

  // Check for incomplete responses (very short)
  if (wordCount < 5) {
    return { needsRecovery: true, reason: 'Response too short (< 5 words)' }
  }

  // Check for cutoff indicators - simplified patterns
  const cutoffPatterns = [
    /\band\s*$/i,
    /\bbut\s*$/i,
    /\bso\s*$/i,
    /\bbecause\s*$/i,
    /\bwhen\s*$/i,
    /\bif\s*$/i,
    /\bthen\s*$/i,
    /\.\.\.\s*$/,
    /\,\s*$/
  ]

  const hasCutoffIndicator = cutoffPatterns.some(pattern => pattern.test(response))
  if (hasCutoffIndicator) {
    return { needsRecovery: true, reason: 'Response appears to be cut off mid-sentence' }
  }

  // Check for non-answers
  const nonAnswerPatterns = [
    /^(i don't know|idk|no idea|not sure|pass|skip|next|dunno|beats me|couldn't say|no clue|haven't thought about it|good question|that's a good question)\.?\s*$/i,
    /^(lol|haha|hehe|funny|joke|kidding|just kidding|jk|whatever|random|meh|shrug)\.?\s*$/i,
    /^(okay|fine|sure|yeah|yep|right|correct|exactly)\.?\s*$/i
  ]

  const isNonAnswer = nonAnswerPatterns.some(pattern => pattern.test(response))
  if (isNonAnswer) {
    return { needsRecovery: true, reason: 'Response is a non-answer or evasive' }
  }

  // Check if previous interviewer response mentioned cutoff/recovery
  const lastInterviewerResponse = recentConversation
    .slice()
    .reverse()
    .find(turn => turn.speaker === 'interviewer')

  if (lastInterviewerResponse) {
    const recoveryIndicators = [
      /cut off|cutoff|interrupted|continue|finish|complete|saying/i,
      /sounds like|seems like|appears/i,
      /what was that|repeat|again|rephrase/i
    ]

    const wasRecoveryAttempt = recoveryIndicators.some(pattern => 
      pattern.test(lastInterviewerResponse.message_text)
    )

    if (wasRecoveryAttempt && wordCount < 10) {
      return { needsRecovery: true, reason: 'Previous recovery attempt, still incomplete response' }
    }
  }

  return { needsRecovery: false, reason: 'Response appears complete' }
}

// Helper function to get communication style instructions
function getCommunicationStyleInstructions(communicationStyle: string, interviewType: string) {
  const baseStyleInstructions = {
    corporate_professional: "Use formal business language, maintain structured conversation flow, ask precise questions with professional terminology, and keep responses concise and businesslike.",
    casual_conversational: "Use relaxed, natural language, allow for organic conversation flow, ask questions in a friendly manner, and create a comfortable, informal atmosphere."
  }

  const interviewTypeContext = {
    phone_screening: "Focus on getting to know the candidate's background, motivations, and cultural fit. Keep questions broad and exploratory.",
    behavioral_interview: "Use the STAR method (Situation, Task, Action, Result) to explore past experiences. Ask 'Tell me about a time when...' questions and probe for specific examples, outcomes, and lessons learned.",
    hiring_manager: "Explore leadership experiences, past challenges, and role-specific scenarios. Ask about decision-making processes and team dynamics.",
    cultural_fit: "Understand work styles, team preferences, values alignment, and interpersonal skills. Focus on how they collaborate and handle workplace situations."
  }

  const styleInstruction = baseStyleInstructions[communicationStyle as keyof typeof baseStyleInstructions]
  const typeContext = interviewTypeContext[interviewType as keyof typeof interviewTypeContext]
  
  return `${styleInstruction} ${typeContext}`
}

// Helper function to get decision-specific guidance
function getDecisionGuidance(
  action: 'introduction' | 'recovery' | 'follow_up' | 'next_question' | 'end_interview', 
  sessionContext: SessionContext | null, 
  recentConversation: ConversationTurn[] = []
): string {
  const questions = sessionContext?.interview_questions || []
  
  switch (action) {
    case 'introduction':
      // Use structured company name from job description
      const jobDesc = sessionContext?.job_descriptions?.[0]
      const companyName = jobDesc?.company_name || 'the company'
      const jobTitle = jobDesc?.job_title || 'this role'
      
      return `DECISION: Provide a warm, personalized introduction based on your communication style and interview type. 
      
      Include:
      - Brief personal introduction as "Alex" (the interviewer name)
      - Reference to the company: "${companyName}"
      - Reference to the position: "${jobTitle}"
      - Mention the interview type: "${sessionContext?.interview_type || 'interview'}"
      - Let them know they'll have time to ask questions at the end
      - Set the tone based on your communication style
      - Keep it concise (2-3 sentences) and natural for voice
      - End with a natural confirmation phrase like "Sound good?" or "How does that sound?" or "Ready to get started?"
      
      Example framework: "Hi! I'm Alex, and I'm excited to conduct your [interview_type] interview for the ${jobTitle} position at ${companyName} today! I'll be asking you a few questions, and you'll have time to ask me questions at the end. Sound good?"`
    case 'recovery':
      return `DECISION: The candidate's response was incomplete, cut off, or didn't address the question. Give them a chance to recover.
      
      Recovery scenarios:
      - Incomplete response (< 10 words or cut off mid-sentence)
      - Non-answer ("I don't know", "pass", evasive response)
      - Off-topic or silly answer that doesn't engage with the question
      
      Recovery approaches:
      - For cutoffs: "I think you were saying something about [topic]... please continue"
      - For non-answers: "I'd love to hear more about your experience with [topic]"
      - For off-topic: "Let me rephrase - I'm curious about [specific aspect]"
      
      Keep it encouraging and give them a clear path to provide a better response.`
    case 'follow_up':
      const followUpMainQuestions = recentConversation.filter(turn => 
        turn.speaker === 'interviewer' && 
        turn.message_type === 'main_question' && 
        turn.related_main_question_id
      )
      const totalQuestions = questions.length
      const questionsAsked = followUpMainQuestions.length
      
      return `DECISION: Ask a follow-up question to get more depth on the current topic. Probe for specific examples, challenges, or outcomes.
      
      IMPORTANT CONTEXT: You are in the MIDDLE of the interview process (${questionsAsked}/${totalQuestions} main questions covered). 
      DO NOT use closing language like "wrap up", "before we finish", or "final questions". 
      Continue the natural interview flow with curiosity about their experience.`
    
    case 'next_question':
      // Use improved unique question tracking
      const mainQuestionTurns = recentConversation.filter(turn => 
        turn.speaker === 'interviewer' && 
        turn.message_type === 'main_question' && 
        turn.related_main_question_id
      )
      
      const sortedQuestions = questions.sort((a, b) => a.question_order - b.question_order)
      
      // Find the highest question_order that has been asked
      const maxQuestionOrder = Math.max(0, ...mainQuestionTurns.map(turn => {
        const q = sortedQuestions.find(sq => sq.id === turn.related_main_question_id)
        return q ? q.question_order : 0
      }))

      // Get the next question in sequence
      const nextQuestion = sortedQuestions.find(q => q.question_order === maxQuestionOrder + 1)
      
      return nextQuestion 
        ? "DECISION: Move to the next main question."
        : "DECISION: All main questions have been covered. Wrap up the interview."
    case 'end_interview':
      return "DECISION: All main topics have been covered thoroughly. Wrap up the interview with closing remarks and next steps."
    default:
      return "DECISION: Continue with follow-up questions."
  }
}


// Helper function to analyze conversation and decide next action
async function analyzeConversationAndDecide(
  sessionContext: SessionContext | null,
  recentConversation: ConversationTurn[],
  currentResponse: string
): Promise<{ action: 'introduction' | 'recovery' | 'follow_up' | 'next_question' | 'end_interview', reasoning: string }> {
  try {
    const questions = sessionContext?.interview_questions || []
    const mainQuestions = questions
      .sort((a, b) => a.question_order - b.question_order)
      .map((q) => `${q.question_order}. ${q.question_text}`)
      .join('\n')

    // Count unique main questions that have been asked
    const mainQuestionTurns = recentConversation.filter(turn => 
      turn.speaker === 'interviewer' && 
      turn.message_type === 'main_question' && 
      turn.related_main_question_id
    )
    
    // Find the highest question order that has been asked
    const maxQuestionOrder = mainQuestionTurns.length > 0 ? Math.max(...mainQuestionTurns.map(turn => {
      const q = sessionContext?.interview_questions?.find(sq => sq.id === turn.related_main_question_id)
      return q ? q.question_order : 0
    })) : 0
    
    const mainQuestionsAsked = maxQuestionOrder
    
    // Count follow-ups since the last unique main question
    const lastMainQuestionTurn = recentConversation
      .slice()
      .reverse()
      .find(turn => turn.speaker === 'interviewer' && 
                   turn.message_type === 'main_question' && 
                   turn.related_main_question_id)?.turn_number || 0
    
    const followUpsSinceLastMain = recentConversation.filter(turn => 
      turn.speaker === 'interviewer' && 
      turn.message_type === 'follow_up' && 
      turn.turn_number > lastMainQuestionTurn
    ).length

    // Phase 2: Enhanced force progression rules
    const MAX_FOLLOWUPS_PER_QUESTION = 3 // Increased from 2 to 3 for more natural flow
    const MAX_TOTAL_INTERVIEWER_TURNS = 26 // Allow 8 questions + 3 follow-ups each + closing turns
    const totalQuestions = questions.length
    
    const totalInterviewerTurns = recentConversation.filter(turn => 
      turn.speaker === 'interviewer'
    ).length

    console.log('📊 Questions:', mainQuestionsAsked, '/', totalQuestions, '| Follow-ups:', followUpsSinceLastMain, '| Turns:', totalInterviewerTurns)

    // Phase 2 Safety Net: Force first main question if we've been stuck too long
    if (mainQuestionsAsked === 0 && totalInterviewerTurns >= 3) {
      return {
        action: 'next_question',
        reasoning: `Safety net: ${totalInterviewerTurns} turns without main question - forcing first main question`
      }
    }

    // Safety net: if we've had too many interviewer turns, end the interview
    if (totalInterviewerTurns >= MAX_TOTAL_INTERVIEWER_TURNS) {
      return {
        action: 'end_interview',
        reasoning: `Safety limit reached: ${totalInterviewerTurns} interviewer turns, ending interview`
      }
    }

    // Phase 1 Fix: Deterministic introduction and first question logic
    if (mainQuestionsAsked === 0) {
      // Check if we've already shown introduction
      const hasIntroduction = recentConversation.some(turn => 
        turn.speaker === 'interviewer' && turn.message_type === 'transition' && turn.turn_number === 1
      )
      
      if (!hasIntroduction) {
        return {
          action: 'introduction',
          reasoning: 'First turn - showing introduction'
        }
      } else {
        // Safety net: If we've shown introduction but haven't asked any main questions, force first main question
        return {
          action: 'next_question',
          reasoning: 'Introduction shown but no main questions asked - forcing first main question'
        }
      }
    }

    // Check for response quality issues that need recovery
    const qualityCheck = detectResponseQualityIssues(currentResponse, recentConversation)
    if (qualityCheck.needsRecovery) {
      // Count recent recovery attempts to prevent infinite loops
      const recentRecoveryAttempts = recentConversation
        .slice(-4) // Last 4 turns
        .filter(turn => turn.speaker === 'interviewer' && turn.message_type === 'follow_up')
        .length

      if (recentRecoveryAttempts < 2) {
        return {
          action: 'recovery',
          reasoning: `Recovery needed: ${qualityCheck.reason}`
        }
      }
    }

    // If we've hit the follow-up limit, move to next question
    if (followUpsSinceLastMain >= MAX_FOLLOWUPS_PER_QUESTION) {
      if (mainQuestionsAsked >= totalQuestions) {
        return {
          action: 'end_interview',
          reasoning: 'All main questions covered and follow-up limit reached'
        }
      }
      return {
        action: 'next_question',
        reasoning: `Follow-up limit reached (${followUpsSinceLastMain}), moving to next main question`
      }
    }

    const conversationSummary = recentConversation
      .slice(-6) // Last 6 turns
      .map(turn => `${turn.speaker}: ${turn.message_text}`)
      .join('\n')

    // If all main questions have been asked, check if we should allow follow-ups or close
    if (mainQuestionsAsked >= totalQuestions) {
      // Allow follow-ups to the final main question if within limits
      if (followUpsSinceLastMain < MAX_FOLLOWUPS_PER_QUESTION) {
        // Continue with normal decision logic to allow follow-ups to final question
        console.log(`🎯 All ${totalQuestions} main questions asked, but allowing follow-ups to final question (${followUpsSinceLastMain}/${MAX_FOLLOWUPS_PER_QUESTION})`)
      } else {
        // All questions + follow-ups complete, start closing mode
        return {
          action: 'end_interview',
          reasoning: `All ${totalQuestions} main questions covered with follow-ups complete, entering closing mode`
        }
      }
    }

    const decisionPrompt = `You are an AI interviewer analyzing a conversation to decide the next action.

MAIN QUESTIONS TO COVER:
${mainQuestions}

RECENT CONVERSATION:
${conversationSummary}

CANDIDATE'S LATEST RESPONSE:
${currentResponse}

PROGRESS STATUS:
- MAIN QUESTIONS ASKED: ${mainQuestionsAsked} out of ${totalQuestions}
- FOLLOW-UPS SINCE LAST MAIN QUESTION: ${followUpsSinceLastMain} (max: ${MAX_FOLLOWUPS_PER_QUESTION})

DECISION RULES (Phase 4: BULLETPROOF CONSTRAINTS):
1. "recovery" - ONLY if response was cut off, incomplete, or completely didn't address the question
2. "follow_up" - If response is reasonable but could use 1-2 clarifying questions (max ${MAX_FOLLOWUPS_PER_QUESTION} total)
3. "next_question" - If response is sufficient OR you've asked ${MAX_FOLLOWUPS_PER_QUESTION} follow-ups OR candidate gave good examples
4. "end_interview" - ONLY ALLOWED IF ALL ${totalQuestions} MAIN QUESTIONS HAVE BEEN ASKED

⚠️  ABSOLUTE REQUIREMENT: You can NEVER choose "end_interview" unless MAIN QUESTIONS ASKED = ${totalQuestions}
⚠️  CURRENT STATUS: ${mainQuestionsAsked}/${totalQuestions} questions asked
⚠️  IF ${mainQuestionsAsked} < ${totalQuestions}, you MUST choose "next_question" or "follow_up", NEVER "end_interview"

Respond with JSON only:
{
  "action": "recovery|follow_up|next_question|end_interview",
  "reasoning": "Brief explanation of your decision"
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a decision engine for interview flow."
        },
        {
          role: "user",
          content: decisionPrompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interview_decision",
          schema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["recovery", "follow_up", "next_question", "end_interview"]
              },
              reasoning: {
                type: "string"
              }
            },
            required: ["action", "reasoning"]
          }
        }
      },
      temperature: 0.3,
      max_tokens: 100
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const decision = JSON.parse(response)
    
    // BULLETPROOF OVERRIDE: Never allow end_interview unless all main questions asked
    let finalAction = decision.action || 'follow_up'
    if (finalAction === 'end_interview' && mainQuestionsAsked < totalQuestions) {
      console.log(`🚫 BLOCKING PREMATURE END_INTERVIEW: ${mainQuestionsAsked}/${totalQuestions} questions asked, forcing next_question`)
      finalAction = 'next_question'
    }
    
    const finalDecision = {
      action: finalAction,
      reasoning: decision.reasoning || 'Default follow-up decision'
    }
    
    // Phase 4: Comprehensive logging
    console.log('🤖 LLM Decision:', {
      input: {
        mainQuestionsAsked,
        totalQuestions,
        followUpsSinceLastMain,
        totalInterviewerTurns,
        currentResponseLength: currentResponse?.length || 0
      },
      output: finalDecision,
      rawResponse: response
    })
    
    return finalDecision
  } catch (error) {
    console.error('Error in decision engine:', error)
    return {
      action: 'follow_up',
      reasoning: 'Error in decision engine, defaulting to follow-up'
    }
  }
}

// Helper function to generate request fingerprint
function generateRequestHash(sessionId: string, text: string, type: string): string {
  const content = `${sessionId}-${text}-${type}`
  return crypto.createHash('md5').update(content).digest('hex')
}

// Helper function to check if request is duplicate
function isDuplicateRequest(sessionId: string, text: string, type: string): boolean {
  const requestHash = generateRequestHash(sessionId, text, type)
  const now = Date.now()
  
  // Clean old entries
  for (const [hash, timestamp] of recentRequests.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      recentRequests.delete(hash)
    }
  }
  
  // Check if this request was seen recently
  if (recentRequests.has(requestHash)) {
    console.log('🔄 DUPLICATE REQUEST DETECTED:', { sessionId, text: text?.substring(0, 50), type })
    return true
  }
  
  // Store this request
  recentRequests.set(requestHash, now)
  return false
}

// Helper function to acquire response generation mutex
function acquireResponseMutex(sessionId: string): boolean {
  if (responseMutex.get(sessionId)) {
    console.log('🔒 RESPONSE MUTEX LOCKED - skipping duplicate response for session:', sessionId)
    return false
  }
  
  responseMutex.set(sessionId, true)
  
  // Auto-release mutex after timeout
  setTimeout(() => {
    responseMutex.delete(sessionId)
    console.log('⏰ RESPONSE MUTEX AUTO-RELEASED for session:', sessionId)
  }, MUTEX_TIMEOUT_MS)
  
  console.log('🔓 RESPONSE MUTEX ACQUIRED for session:', sessionId)
  return true
}

// Helper function to release response generation mutex
function releaseResponseMutex(sessionId: string): void {
  responseMutex.delete(sessionId)
  console.log('🔓 RESPONSE MUTEX RELEASED for session:', sessionId)
}

export async function GET() {
  console.log('🔥 GET request to voice-agent endpoint')
  return new Response('Webhook endpoint is working! Updated with session mapping.', { status: 200 })
}

export async function POST(request: NextRequest) {
  // Start total pipeline timing
  const pipelineStartTime = Date.now()
  
  // Timing tracker for consolidated reporting
  const timings: { [key: string]: { start: number; duration?: number } } = {
    pipeline: { start: pipelineStartTime }
  }
  
  let requestBody
  try {
    requestBody = await request.json()
  } catch (error) {
    console.error('Failed to parse request body:', error)
    return new Response('Bad Request', { status: 400 })
  }
  
  // Verify webhook signature - try both male and female webhook secrets
  const signature = request.headers.get('layercode-signature')
  
  if (signature) {
    const maleSecret = process.env.LAYERCODE_WEBHOOK_SECRET_MALE
    const femaleSecret = process.env.LAYERCODE_WEBHOOK_SECRET_FEMALE
    
    if (maleSecret || femaleSecret) {
      const isValidMale = maleSecret ? verifySignature({
        payload: JSON.stringify(requestBody),
        signature,
        secret: maleSecret
      }) : false
      
      const isValidFemale = femaleSecret ? verifySignature({
        payload: JSON.stringify(requestBody),
        signature,
        secret: femaleSecret
      }) : false
      
      if (!isValidMale && !isValidFemale) {
        console.error('Webhook signature invalid for both male and female secrets - rejecting request')
        return new Response('Unauthorized', { status: 401 })
      }
      
      // Log which pipeline was used for debugging
      if (isValidMale) {
        console.log('✅ Webhook verified with male pipeline secret')
      }
      if (isValidFemale) {
        console.log('✅ Webhook verified with female pipeline secret')
      }
    }
  }
  
  return streamResponse(requestBody, async ({ stream }) => {
    // Extract webhook data
    const { text, type, session_id, session_context } = requestBody
    
    // Get LayerCode's session ID from the request
    const layercodeSessionId = session_id || session_context?.sessionId
    
    // DEDUPLICATION CHECK: Skip duplicate requests within 5-second window
    if (layercodeSessionId && text && isDuplicateRequest(layercodeSessionId, text, type || 'message')) {
      console.log('🚫 SKIPPING DUPLICATE REQUEST - maintaining first response')
      stream.end()
      return
    }
    
    // Look up our interview session ID using the LayerCode session ID
    let interviewSessionId: string | null = null
    
    if (layercodeSessionId) {
      timings.sessionLookup = { start: Date.now() }
      const { data: sessionData, error: sessionError } = await supabase
        .from('interview_sessions')
        .select('id')
        .eq('layercode_session_id', layercodeSessionId)
        .single()
      timings.sessionLookup.duration = Date.now() - timings.sessionLookup.start
      
      if (sessionError || !sessionData) {
        console.error('❌ No interview session found for LayerCode session:', layercodeSessionId, sessionError)
        
        // Send error response and end stream
        stream.data({
          type: 'error',
          message: 'Session not found - please restart the interview',
          timestamp: Date.now()
        })
        stream.end()
        return
      } else {
        interviewSessionId = sessionData.id
        console.log('✅ Found interview session:', interviewSessionId, 'for LayerCode session:', layercodeSessionId)
        
        // MUTEX CHECK: Only allow one response generation per session at a time
        if (interviewSessionId && !acquireResponseMutex(interviewSessionId)) {
          console.log('🚫 SKIPPING REQUEST - response already in progress for session:', interviewSessionId)
          stream.end()
          return
        }
      }
    } else {
      console.error('❌ No LayerCode session ID provided')
      stream.data({
        type: 'error',
        message: 'No session ID provided',
        timestamp: Date.now()
      })
      stream.end()
      return
    }
    
    // Fetch session context if available
    let sessionContext: SessionContext | null = null
    let recentConversation: ConversationTurn[] = []
    let nextTurnNumber = 1
    
    if (interviewSessionId) {
      timings.contextLoading = { start: Date.now() }
      sessionContext = await fetchSessionContext(interviewSessionId)
      recentConversation = await getRecentConversation(interviewSessionId, 10)
      nextTurnNumber = await getNextTurnNumber(interviewSessionId)
      timings.contextLoading.duration = Date.now() - timings.contextLoading.start
    }

    // Send user transcription immediately via stream.data()
    if ((type === 'MESSAGE' || type === 'message' || !type) && text) {
      stream.data({
        type: 'user_transcription',
        text: text,
        timestamp: Date.now()
      })
      
      // Store user message in conversation if we have a session
      if (interviewSessionId && text) {
        timings.userStorage = { start: Date.now() }
        const insertResult = await supabase
          .from('interview_conversation')
          .insert({
            session_id: interviewSessionId,
            turn_number: nextTurnNumber,
            speaker: 'candidate',
            message_text: text,
            message_type: 'response',
            word_count: text.split(' ').length,
            response_time_seconds: null
          })
        
        if (insertResult.error) {
          console.error('Error storing user message:', insertResult.error)
        }
        
        // Mark interview as started on first candidate response
        await markInterviewStarted(interviewSessionId)
        
        nextTurnNumber++
        timings.userStorage.duration = Date.now() - timings.userStorage.start
      }
    }

    // Generate AI response
    try {
      // SERVER-SIDE PROTECTION: Check if interview session is already completed
      if (sessionContext) {
        const { data: sessionCheck } = await supabase
          .from('interview_sessions')
          .select('status, completed_at')
          .eq('id', sessionContext.id)
          .single()
        
        if (sessionCheck?.status === 'completed' || sessionCheck?.completed_at) {
          console.log('🚫 BLOCKING REQUEST: Interview session already completed')
          
          // Send termination message
          stream.data({
            type: 'interview_complete',
            message: 'Interview session has already ended',
            reason: 'session_already_completed',
            timestamp: Date.now()
          })
          
          // Release mutex before ending
          if (interviewSessionId) {
            releaseResponseMutex(interviewSessionId)
          }
          stream.end()
          return
        }
      }
      
      // BULLETPROOF CLOSING CHECK: Check if we're in closing phase and candidate didn't ask a question
      const existingClosingTurns = recentConversation.filter(turn => 
        turn.speaker === 'interviewer' && turn.message_type === 'closing'
      ).length
      
      const candidateAskedQuestion = text && text.trim().includes('?')
      
      // If we already have closing turns and candidate didn't ask a question, end immediately
      if (existingClosingTurns > 0 && !candidateAskedQuestion) {
        console.log('🏁 BULLETPROOF TERMINATION: Candidate responded without question in closing phase')
        
        // Generate final goodbye response
        const finalGoodbye = "Thanks so much for your time today, Lance! It was great getting to know you. We'll be in touch soon with next steps. Take care!"
        
        // Store final goodbye in conversation
        if (interviewSessionId) {
          const finalGoodbyeEntry = {
            session_id: interviewSessionId,
            turn_number: nextTurnNumber,
            speaker: 'interviewer',
            message_text: finalGoodbye,
            message_type: 'closing',
            related_main_question_id: null,
            word_count: finalGoodbye.split(' ').length
          }
          
          await supabase
            .from('interview_conversation')
            .insert(finalGoodbyeEntry)
        }
        
        // Send final goodbye transcription
        stream.data({
          type: 'agent_transcription',
          text: finalGoodbye,
          timestamp: Date.now()
        })
        
        // Send TTS for final goodbye
        stream.tts(finalGoodbye)
        
        // Send completion notification - but don't trigger modal yet
        stream.data({
          type: 'interview_ended_wait_for_user',
          message: 'Interview ended - user can navigate to results when ready',
          timestamp: Date.now()
        })
        
        // Mark interview as completed in database
        if (interviewSessionId) {
          await markInterviewCompleted(interviewSessionId)
          // Release mutex before ending
          releaseResponseMutex(interviewSessionId)
        }
        
        stream.end()
        return
      }
      
      // Use decision engine to determine next action
      let decision: { action: 'introduction' | 'recovery' | 'follow_up' | 'next_question' | 'end_interview', reasoning: string } = { action: 'follow_up', reasoning: 'Default behavior' }
      
      // BULLETPROOF CLOSING MODE: If already in closing, force end_interview decision
      const isAlreadyInClosingMode = recentConversation.some(turn => 
        turn.speaker === 'interviewer' && turn.message_type === 'closing'
      )

      if (isAlreadyInClosingMode) {
        decision = { action: 'end_interview', reasoning: 'Already in closing mode - must stay in closing' }
        console.log('🔒 FORCING CLOSING MODE: Overriding decision engine to stay in closing')
      } else {
        // Only call decision engine if NOT in closing mode
        if (sessionContext && recentConversation.length >= 0) {
          timings.decisionEngine = { start: Date.now() }
          decision = await analyzeConversationAndDecide(sessionContext, recentConversation, text || '')
          timings.decisionEngine.duration = Date.now() - timings.decisionEngine.start
        }
      }
      
      // BULLETPROOF OVERRIDE: If decision is end_interview but candidate asked question, switch to follow_up
      if (decision.action === 'end_interview' && text) {
        const candidateAskedQuestion = await detectQuestionWithAI(text)
        if (candidateAskedQuestion) {
          decision = {
            action: 'follow_up',
            reasoning: 'Candidate asked question during closing - continuing conversation'
          }
          console.log('🔄 OVERRIDE: Changed end_interview to follow_up due to candidate question')
        }
      }
      
      // Phase 4: Log decision execution
      console.log('⚡ Decision Execution:', {
        sessionId: interviewSessionId,
        decision: decision,
        hasQuestions: sessionContext?.interview_questions?.length || 0,
        conversationLength: recentConversation.length
      })
      
      // Build conversation history for context
      const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = recentConversation.map(turn => ({
        role: turn.speaker === 'interviewer' ? 'assistant' as const : 'user' as const,
        content: turn.message_text
      }))
      
      // Add current user message
      if (text) {
        conversationHistory.push({
          role: 'user',
          content: text
        })
      }
      
      // Build personalized system prompt with decision context
      const systemPrompt = buildSystemPrompt(sessionContext)
      const decisionGuidance = getDecisionGuidance(decision.action, sessionContext, recentConversation)
      
      timings.responseGeneration = { start: Date.now() }
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt + "\n\n" + decisionGuidance
          },
          ...conversationHistory
        ],
        temperature: 0.7,
        max_tokens: 150
      })
      timings.responseGeneration.duration = Date.now() - timings.responseGeneration.start

      let response = completion.choices[0]?.message?.content || "I see. Can you tell me more about that?"
      
      // Handle main question insertion directly from database
      let relatedMainQuestionId = null
      if (decision.action === 'next_question' && sessionContext?.interview_questions) {
        // Get the next question directly from database
        const mainQuestionTurns = recentConversation.filter(turn => 
          turn.speaker === 'interviewer' && 
          turn.message_type === 'main_question' && 
          turn.related_main_question_id
        )
        
        const sortedQuestions = sessionContext.interview_questions
          .sort((a, b) => a.question_order - b.question_order)
        
        // Find the highest question_order that has been asked
        const maxQuestionOrder = Math.max(0, ...mainQuestionTurns.map(turn => {
          const q = sortedQuestions.find(sq => sq.id === turn.related_main_question_id)
          return q ? q.question_order : 0
        }))

        // Get the next question in sequence
        const nextQuestion = sortedQuestions.find(q => q.question_order === maxQuestionOrder + 1)
        
        // Phase 4: Enhanced logging for question selection
        console.log('🎯 Question Selection:', {
          maxQuestionOrder,
          nextQuestionOrder: maxQuestionOrder + 1,
          totalQuestions: sortedQuestions.length,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.id,
            order: nextQuestion.question_order,
            text: nextQuestion.question_text.substring(0, 100) + '...'
          } : null
        })
        
        if (nextQuestion) {
          // Override LLM response with exact question from database
          response = nextQuestion.question_text
          relatedMainQuestionId = nextQuestion.id
          console.log(`✅ Asking Q${nextQuestion.question_order}: ${nextQuestion.question_text.substring(0, 50)}...`)
        } else {
          console.log('⚠️  No next question found - all questions may have been asked')
          decision.action = 'end_interview'
        }
      }
      
      // isAlreadyInClosingMode already defined above
      
      // Handle opening closing question when starting closing mode
      if (decision.action === 'end_interview' && !isAlreadyInClosingMode) {
        // Generate opening closing question - FIRST closing turn
        response = "Great! That covers all my questions. Now, do you have any questions for me about the role, the team, or the company?"
        console.log('🎯 STARTING CLOSING MODE: Asking opening closing question')
      }
      
      if (decision.action === 'end_interview' && isAlreadyInClosingMode) {
        // Count existing closing turns
        const closingTurns = recentConversation.filter(turn => 
          turn.speaker === 'interviewer' && turn.message_type === 'closing'
        ).length

        // FIRST: Check if response needs recovery (same logic as main questions)
        const qualityCheck = detectResponseQualityIssues(text, recentConversation)
        
        if (qualityCheck.needsRecovery) {
          console.log('🔄 CLOSING RECOVERY NEEDED:', qualityCheck.reason)
          
          // Generate recovery response instead of terminating
          response = "I think you were saying something there - could you repeat that last part?"
          
          // Store recovery response and continue conversation
          const recoveryEntry = {
            session_id: interviewSessionId,
            turn_number: nextTurnNumber,
            speaker: 'interviewer',
            message_text: response,
            message_type: 'follow_up',
            related_main_question_id: null,
            word_count: response.split(' ').length
          }
          
          await supabase
            .from('interview_conversation')
            .insert(recoveryEntry)
          
          // Send response and continue
          stream.data({
            type: 'agent_transcription',
            text: response,
            timestamp: Date.now()
          })
          
          stream.tts(response)
          return // Don't terminate, continue conversation
        }

        // SECOND: If no recovery needed, check for questions vs termination
        const candidateAskedQuestion = await detectQuestionWithAI(text || '')

        console.log(`🎯 Closing check: ${closingTurns} existing turns, candidate response: "${text}"`)
        console.log(`🔍 AI Question detection result: candidateAskedQuestion=${candidateAskedQuestion}`)

        // Bulletproof closing logic: if candidate responds without a question, end interview
        if (!candidateAskedQuestion) {
          console.log('🏁 ENDING INTERVIEW: Candidate responded without question in closing phase - BULLETPROOF TERMINATION')
          
          // Generate final goodbye response first
          const finalGoodbye = "Thanks so much for your time today, Lance! It was great getting to know you. We'll be in touch soon with next steps. Take care!"
          
          // Store final goodbye in conversation
          if (interviewSessionId) {
            const finalGoodbyeEntry = {
              session_id: interviewSessionId,
              turn_number: nextTurnNumber,
              speaker: 'interviewer',
              message_text: finalGoodbye,
              message_type: 'closing',
              related_main_question_id: null,
              word_count: finalGoodbye.split(' ').length
            }
            
            await supabase
              .from('interview_conversation')
              .insert(finalGoodbyeEntry)
          }
          
          // Send final goodbye transcription
          stream.data({
            type: 'agent_transcription',
            text: finalGoodbye,
            timestamp: Date.now()
          })
          
          // Send TTS for final goodbye  
          stream.tts(finalGoodbye)
          
          // Send completion notification - but don't trigger modal yet
          stream.data({
            type: 'interview_ended_wait_for_user',
            message: 'Interview ended - user can navigate to results when ready',
            timestamp: Date.now()
          })
          
          // Mark interview as completed in database
          if (interviewSessionId) {
            await markInterviewCompleted(interviewSessionId)
          }
          return
        }

        // Continue if candidate asked a question, but check closing turn limit
        if (closingTurns >= 8) {
          console.log('🏁 ENDING INTERVIEW: Maximum closing turns reached')
          
          stream.data({
            type: 'interview_complete',
            message: 'Interview has ended',
            reason: 'closing_turn_limit',
            timestamp: Date.now()
          })
          
          // Mark interview as completed in database
          if (interviewSessionId) {
            await markInterviewCompleted(interviewSessionId)
            // Release mutex before ending
            releaseResponseMutex(interviewSessionId)
          }
          
          stream.end()
          return
        }
      }
      
      // Store interviewer response in conversation
      if (interviewSessionId && response) {
        const messageType = decision.action === 'end_interview' ? 'closing' : 
                           (decision.action === 'follow_up' && isAlreadyInClosingMode) ? 'closing' :
                           decision.action === 'next_question' ? 'main_question' : 
                           decision.action === 'introduction' ? 'transition' : 
                           decision.action === 'recovery' ? 'follow_up' : 'follow_up'
        
        // relatedMainQuestionId already set above for main questions
        // For follow-ups and closing, it remains null
        
        const conversationEntry = {
          session_id: interviewSessionId,
          turn_number: nextTurnNumber,
          speaker: 'interviewer',
          message_text: response,
          message_type: messageType,
          related_main_question_id: relatedMainQuestionId,
          word_count: response.split(' ').length
        }
        
        // Phase 4: Log storage details
        console.log('💾 Storing conversation:', {
          action: decision.action,
          messageType,
          relatedMainQuestionId,
          responseLength: response.length,
          turnNumber: nextTurnNumber
        })
        
        timings.responseStorage = { start: Date.now() }
        const insertResult = await supabase
          .from('interview_conversation')
          .insert(conversationEntry)
        
        if (insertResult.error) {
          console.error('❌ Error storing interviewer response:', insertResult.error)
        } else {
          console.log('✅ Conversation stored successfully')
        }
        timings.responseStorage.duration = Date.now() - timings.responseStorage.start
      }
      
      // Calculate and log comprehensive latency metrics
      const pipelineEndTime = Date.now()
      const totalPipelineTime = pipelineEndTime - pipelineStartTime
      timings.pipeline.duration = totalPipelineTime
      
      // Comprehensive latency summary
      console.log('📊 ============ LATENCY BREAKDOWN ============')
      console.log(`🔍 Session: ${interviewSessionId}`)
      console.log(`├─ Session Lookup: ${timings.sessionLookup?.duration || 'N/A'}ms`)
      console.log(`├─ Context Loading: ${timings.contextLoading?.duration || 'N/A'}ms`)
      console.log(`├─ User Storage: ${timings.userStorage?.duration || 'N/A'}ms`)
      console.log(`├─ Decision Engine: ${timings.decisionEngine?.duration || 'N/A'}ms`)
      console.log(`├─ Response Generation: ${timings.responseGeneration?.duration || 'N/A'}ms`)
      console.log(`├─ Response Storage: ${timings.responseStorage?.duration || 'N/A'}ms`)
      console.log(`└─ 🎯 TOTAL PIPELINE: ${totalPipelineTime}ms (${(totalPipelineTime/1000).toFixed(1)}s)`)
      console.log('📊 ===========================================')

      // Send agent transcription immediately via stream.data()
      stream.data({
        type: 'agent_transcription',
        text: response,
        timestamp: Date.now()
      })
      
      // Stream the response back to LayerCode
      stream.tts(response)
      
    } catch (error) {
      console.error('OpenAI completion error:', error)
      stream.tts("I apologize, but I'm having some technical difficulties. Let's continue with your interview.")
    } finally {
      // DELAY mutex release to allow LayerCode time to start TTS playback
      // This prevents rapid duplicate requests from interrupting audio
      if (interviewSessionId) {
        setTimeout(() => {
          releaseResponseMutex(interviewSessionId)
        }, 2000) // 2 second delay before releasing mutex
      }
    }
    
    // End the stream
    stream.end()
  })
}

// Helper function to mark interview as started (first candidate response)
async function markInterviewStarted(interviewSessionId: string) {
  try {
    console.log(`🚀 Marking interview ${interviewSessionId} as started...`)
    
    // Check if interview is already marked as started
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, started_at, status')
      .eq('id', interviewSessionId)
      .single()
    
    if (sessionError || !session) {
      console.error('❌ Failed to get interview session for start tracking:', sessionError)
      return
    }
    
    // Only update if not already started
    if (!session.started_at) {
      const { error: updateError } = await supabase
        .from('interview_sessions')
        .update({
          started_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', interviewSessionId)
      
      if (updateError) {
        console.error('❌ Failed to mark interview as started:', updateError)
      } else {
        console.log(`✅ Interview ${interviewSessionId} marked as started`)
      }
    }
  } catch (error) {
    console.error('❌ Error marking interview as started:', error)
  }
}

// Helper function to mark interview as completed
async function markInterviewCompleted(interviewSessionId: string) {
  try {
    console.log(`📝 Marking interview ${interviewSessionId} as completed...`)
    
    // Get the interview session to calculate duration
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, created_at, started_at')
      .eq('id', interviewSessionId)
      .single()
    
    if (sessionError || !session) {
      console.error('❌ Failed to get interview session for completion:', sessionError)
      return
    }
    
    const now = new Date()
    const completedAt = now.toISOString()
    
    // Calculate duration (use started_at if available, otherwise fall back to created_at)
    const startTime = session.started_at || session.created_at
    const durationSeconds = startTime ? Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000) : null
    
    // Update interview session with completion data
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        total_duration_seconds: durationSeconds,
        // Set started_at if it wasn't set earlier
        started_at: session.started_at || session.created_at
      })
      .eq('id', interviewSessionId)
    
    if (updateError) {
      console.error('❌ Failed to update interview session completion:', updateError)
    } else {
      console.log(`✅ Interview ${interviewSessionId} marked as completed (duration: ${durationSeconds}s)`)
    }
  } catch (error) {
    console.error('❌ Error marking interview as completed:', error)
  }
}