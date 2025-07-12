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
  persona: string
  difficulty_level: string
  interview_questions: InterviewQuestion[]
  resumes: { parsed_content: string }
  job_descriptions: { job_content: string }
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
        *,
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

  const resume = sessionContext.resumes?.parsed_content || 'No resume content available'
  const jobDescription = sessionContext.job_descriptions?.job_content || 'No job description available'
  const persona = sessionContext.persona || 'professional'
  const difficulty = sessionContext.difficulty_level || 'medium'
  
  // Get persona-specific instructions
  const personaInstructions = getPersonaInstructions(persona)
  
  return `You are conducting a ${difficulty} difficulty voice interview for LickedIn Interviews. ${personaInstructions}

CANDIDATE BACKGROUND:
${resume}

JOB REQUIREMENTS:
${jobDescription}

INSTRUCTIONS:
- Keep responses conversational and natural for voice (1-2 sentences max)
- Ask thoughtful follow-up questions to get deeper insights
- Work through the interview but allow natural conversation flow
- If this seems like the start, introduce yourself briefly
- Be encouraging but maintain professionalism
- Focus on getting detailed responses and building rapport

CURRENT CONTEXT: You are conducting a personalized interview based on the candidate's resume and the specific job requirements above.`
}

// Helper function to get persona-specific instructions
function getPersonaInstructions(persona: string) {
  switch (persona) {
    case 'michael_scott':
      return "Channel Michael Scott from The Office - be enthusiastic, occasionally make inappropriate comments, use business jargon incorrectly, but still try to conduct a real interview."
    case 'friendly':
      return "Be warm, supportive, and encouraging. Make the candidate feel comfortable while still asking probing questions."
    case 'tech_lead':
      return "Be technical, direct, and focused on problem-solving. Ask detailed questions about their technical approach and experience."
    case 'professional':
    default:
      return "Be professional, courteous, and thorough. Ask structured questions and listen carefully to responses."
  }
}

// Helper function to get decision-specific guidance
function getDecisionGuidance(
  action: 'follow_up' | 'next_question' | 'end_interview', 
  sessionContext: SessionContext | null, 
  recentConversation: ConversationTurn[] = []
): string {
  const questions = sessionContext?.interview_questions || []
  
  switch (action) {
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
): Promise<{ action: 'follow_up' | 'next_question' | 'end_interview', reasoning: string }> {
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

    // If this is the very first conversation turn, start with first main question
    if (recentConversation.length === 0) {
      return {
        action: 'next_question',
        reasoning: 'Starting interview with first main question'
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
1. "follow_up" - if the response needs clarification or more depth (but you haven't hit the follow-up limit)
2. "next_question" - if the response is sufficient OR you've had enough follow-ups on this topic
3. "end_interview" - if all main questions have been thoroughly covered

Respond with JSON only:
{
  "action": "follow_up|next_question|end_interview",
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
      let decision: { action: 'follow_up' | 'next_question' | 'end_interview', reasoning: string } = { action: 'follow_up', reasoning: 'Default behavior' }
      
      // Special case: if this is the very first interviewer response, start with main question
      const hasInterviewerResponses = recentConversation.some(turn => turn.speaker === 'interviewer')
      
      if (!hasInterviewerResponses && sessionContext?.interview_questions?.length) {
        decision = {
          action: 'next_question',
          reasoning: 'First interviewer response - starting with first main question'
        }
      } else if (sessionContext && text) {
        decision = await analyzeConversationAndDecide(sessionContext, recentConversation, text)
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
        if (candidateSignalsEnd || closingTurns >= 2) {
          console.log('🏁 ENDING INTERVIEW:', candidateSignalsEnd ? 'Natural end signal detected' : `${closingTurns + 1} closing turns would exceed limit`)
          stream.end()
          return
        }
      }
      
      // Store interviewer response in conversation
      if (interviewSessionId && response) {
        const messageType = decision.action === 'end_interview' ? 'closing' : 
                           decision.action === 'next_question' ? 'main_question' : 'follow_up'
        
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

