import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { streamResponse, verifySignature } from '@layercode/node-server-sdk'
import { createClient } from '@supabase/supabase-js'
import { sessionMapping } from '../session-mapping'

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
  persona: string // DEPRECATED: Legacy field
  difficulty_level: string
  interview_type: string
  voice_gender: string
  communication_style: string
  interview_questions: InterviewQuestion[]
  resumes: { parsed_content: string }[]
  job_descriptions: { job_content: string }[]
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
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select(`
        id,
        persona,
        difficulty_level,
        interview_type,
        voice_gender,
        communication_style,
        resumes (
          parsed_content
        ),
        job_descriptions (
          job_content
        ),
        interview_questions (
          id,
          question_text,
          question_order,
          question_type
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Error fetching session context:', sessionError)
      return null
    }

    return session
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

  const resume = sessionContext.resumes?.[0]?.parsed_content || 'No resume content available'
  const jobDescription = sessionContext.job_descriptions?.[0]?.job_content || 'No job description available'
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
    technical_screen: "Dive deep into technical concepts, problem-solving approaches, and hands-on experience. Ask for specific examples and technical details.",
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
      // Extract company name from job description for personalization
      const jobContent = sessionContext?.job_descriptions?.[0]?.job_content || ''
      const companyNameMatch = jobContent.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/)?.[1] || 'the company'
      
      return `DECISION: Provide a warm, personalized introduction based on your communication style and interview type. 
      
      Include:
      - Brief personal introduction as the interviewer
      - Reference to the company: "${companyNameMatch}"
      - Mention the interview type: "${sessionContext?.interview_type || 'interview'}"
      - Set the tone based on your communication style
      - Keep it concise (1-2 sentences) and natural for voice
      
      Example framework: "Hi! I'm [Name/Persona], and I'm excited to conduct your [interview_type] interview with [company] today!"`
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
      return "DECISION: Ask a follow-up question to get more depth on the current topic. Probe for specific examples, challenges, or outcomes."
    case 'next_question':
      // Use improved unique question tracking
      const mainQuestionTurns = recentConversation.filter(turn => 
        turn.speaker === 'interviewer' && 
        turn.message_type === 'main_question' && 
        turn.related_main_question_id
      )
      
      const usedQuestionIds = new Set(mainQuestionTurns.map(turn => turn.related_main_question_id!))
      const sortedQuestions = questions.sort((a, b) => a.question_order - b.question_order)
      const nextQuestion = sortedQuestions[usedQuestionIds.size]
      
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
    
    const usedQuestionIds = new Set(mainQuestionTurns.map(turn => turn.related_main_question_id!))
    const mainQuestionsAsked = usedQuestionIds.size
    
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

    // Force progression rules
    const MAX_FOLLOWUPS_PER_QUESTION = 2
    const MAX_TOTAL_INTERVIEWER_TURNS = 18 // Allow 5 questions + 2 follow-ups each + closing turns
    const totalQuestions = questions.length
    
    const totalInterviewerTurns = recentConversation.filter(turn => 
      turn.speaker === 'interviewer'
    ).length

    console.log('📊 Questions:', mainQuestionsAsked, '/', totalQuestions, '| Follow-ups:', followUpsSinceLastMain, '| Turns:', totalInterviewerTurns)

    // Safety net: if we've had too many interviewer turns, end the interview
    if (totalInterviewerTurns >= MAX_TOTAL_INTERVIEWER_TURNS) {
      return {
        action: 'end_interview',
        reasoning: `Safety limit reached: ${totalInterviewerTurns} interviewer turns, ending interview`
      }
    }

    // Deterministic introduction detection: if no main questions have been asked yet, show introduction
    if (usedQuestionIds.size === 0) {
      return {
        action: 'introduction',
        reasoning: 'No main questions asked yet - showing introduction'
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

    // If all main questions have been asked, enter closing phase
    if (mainQuestionsAsked >= totalQuestions) {
      return {
        action: 'end_interview',
        reasoning: 'All main questions covered, entering closing phase'
      }
    }

    const conversationSummary = recentConversation
      .slice(-6) // Last 6 turns
      .map(turn => `${turn.speaker}: ${turn.message_text}`)
      .join('\n')

    const decisionPrompt = `You are an AI interviewer analyzing a conversation to decide the next action.

MAIN QUESTIONS TO COVER:
${mainQuestions}

RECENT CONVERSATION:
${conversationSummary}

CANDIDATE'S LATEST RESPONSE:
${currentResponse}

MAIN QUESTIONS ASKED SO FAR: ${mainQuestionsAsked} out of ${totalQuestions}
FOLLOW-UPS SINCE LAST MAIN QUESTION: ${followUpsSinceLastMain} (max: ${MAX_FOLLOWUPS_PER_QUESTION})

Analyze the candidate's response and decide:
1. "introduction" - if no main questions have been asked yet (first turn)
2. "recovery" - if the response was cut off, incomplete, or didn't address the question
3. "follow_up" - if the response needs clarification or more depth (but you haven't hit the follow-up limit)
4. "next_question" - if the response is sufficient OR you've had enough follow-ups on this topic
5. "end_interview" - if all main questions have been thoroughly covered

Respond with JSON only:
{
  "action": "introduction|recovery|follow_up|next_question|end_interview",
  "reasoning": "Brief explanation of your decision"
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a decision engine for interview flow. Respond only with valid JSON."
        },
        {
          role: "user",
          content: decisionPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const decision = JSON.parse(response)
    
    return {
      action: decision.action || 'follow_up',
      reasoning: decision.reasoning || 'Default follow-up decision'
    }
  } catch (error) {
    console.error('Error in decision engine:', error)
    return {
      action: 'follow_up',
      reasoning: 'Error in decision engine, defaulting to follow-up'
    }
  }
}

export async function GET() {
  console.log('🔥 GET request to voice-agent endpoint')
  return new Response('Webhook endpoint is working! Updated with session mapping.', { status: 200 })
}

export async function POST(request: NextRequest) {
  
  let requestBody
  try {
    requestBody = await request.json()
  } catch (error) {
    console.error('Failed to parse request body:', error)
    return new Response('Bad Request', { status: 400 })
  }
  
  // Verify webhook signature
  const signature = request.headers.get('layercode-signature')
  
  if (signature && process.env.LAYERCODE_WEBHOOK_SECRET) {
    const isValid = verifySignature({
      payload: JSON.stringify(requestBody),
      signature,
      secret: process.env.LAYERCODE_WEBHOOK_SECRET
    })
    
    if (!isValid) {
      console.error('Webhook signature invalid - rejecting request')
      return new Response('Unauthorized', { status: 401 })
    }
  }
  
  return streamResponse(requestBody, async ({ stream }) => {
    // Extract webhook data
    const { text, type, session_id, session_context } = requestBody
    
    // Get LayerCode's session ID from the request
    const layercodeSessionId = session_id || session_context?.sessionId
    
    // Look up our interview session ID using the LayerCode session ID
    const interviewSessionId = sessionMapping.get(layercodeSessionId || '')
    
    if (!interviewSessionId) {
      console.error('No interview session mapping found for LayerCode session:', layercodeSessionId)
    }
    
    // Fetch session context if available
    let sessionContext: SessionContext | null = null
    let recentConversation: ConversationTurn[] = []
    let nextTurnNumber = 1
    
    if (interviewSessionId) {
      sessionContext = await fetchSessionContext(interviewSessionId)
      recentConversation = await getRecentConversation(interviewSessionId, 100)
      nextTurnNumber = await getNextTurnNumber(interviewSessionId)
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
        
        nextTurnNumber++
      }
    }

    // Generate AI response
    try {
      // Use decision engine to determine next action
      let decision: { action: 'introduction' | 'recovery' | 'follow_up' | 'next_question' | 'end_interview', reasoning: string } = { action: 'follow_up', reasoning: 'Default behavior' }
      
      // Use decision engine for all cases (including first turn)
      if (sessionContext && recentConversation.length >= 0) {
        decision = await analyzeConversationAndDecide(sessionContext, recentConversation, text || '')
      }
      
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
        
        const usedQuestionIds = new Set(mainQuestionTurns.map(turn => turn.related_main_question_id!))
        const sortedQuestions = sessionContext.interview_questions
          .sort((a, b) => a.question_order - b.question_order)
        
        const nextQuestion = sortedQuestions[usedQuestionIds.size]
        
        if (nextQuestion) {
          // Override LLM response with exact question from database
          response = nextQuestion.question_text
          relatedMainQuestionId = nextQuestion.id
          console.log(`✅ Asking Q${nextQuestion.question_order}: ${nextQuestion.question_text.substring(0, 50)}...`)
        }
      }
      
      // Check termination BEFORE storing/streaming response
      if (decision.action === 'end_interview') {
        // Simple closing turn counter (from existing conversation)
        const closingTurns = recentConversation.filter(turn => 
          turn.speaker === 'interviewer' && turn.message_type === 'closing'
        ).length

        // Expanded natural end signals
        const candidateSignalsEnd = text && /^(no|nope|i'm good|that's all|thanks|thank you|great|sounds good|perfect|awesome|excellent|wonderful|good to go|all set|i'm all set|nothing else|no more questions|i think that's it|that covers it|i'm satisfied|looks good|sounds great|you too|you as well|likewise|same to you|goodbye|bye)[\s\.\!\?]*$/i.test(text.trim())

        console.log(`🎯 Closing check: ${closingTurns} existing turns, candidate response: "${text}", signals end: ${candidateSignalsEnd}`)

        // Bulletproof termination - check BEFORE adding this turn
        if (candidateSignalsEnd || closingTurns >= 4) {
          console.log('🏁 ENDING INTERVIEW:', candidateSignalsEnd ? 'Natural end signal detected' : `${closingTurns + 1} closing turns would exceed limit`)
          
          // Send custom completion event before ending stream
          stream.data({
            type: 'interview_complete',
            message: 'Interview has ended',
            reason: candidateSignalsEnd ? 'natural_end_signal' : 'closing_turn_limit',
            timestamp: Date.now()
          })
          
          stream.end()
          return
        }
      }
      
      // Store interviewer response in conversation
      if (interviewSessionId && response) {
        const messageType = decision.action === 'end_interview' ? 'closing' : 
                           decision.action === 'next_question' ? 'main_question' : 
                           decision.action === 'introduction' ? 'transition' : 
                           decision.action === 'recovery' ? 'follow_up' : 'follow_up'
        
        // relatedMainQuestionId already set above for main questions
        // For follow-ups and closing, it remains null
        
        const insertResult = await supabase
          .from('interview_conversation')
          .insert({
            session_id: interviewSessionId,
            turn_number: nextTurnNumber,
            speaker: 'interviewer',
            message_text: response,
            message_type: messageType,
            related_main_question_id: relatedMainQuestionId,
            word_count: response.split(' ').length
          })
        
        if (insertResult.error) {
          console.error('Error storing interviewer response:', insertResult.error)
        }
      }
      
      // Send agent transcription immediately via stream.data()
      stream.data({
        type: 'agent_transcription',
        text: response,
        timestamp: Date.now()
      })
      
      // Stream the response back to LayerCode
      stream.tts(response)
      
      console.log('💬 Continuing closing conversation')
      
    } catch (error) {
      console.error('OpenAI completion error:', error)
      stream.tts("I apologize, but I'm having some technical difficulties. Let's continue with your interview.")
    }
    
    // End the stream
    stream.end()
  })
}

