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
    console.log('🔍 Querying database for session ID:', sessionId)
    
    // Fetch interview session with related data
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

    if (sessionError) {
      console.error('❌ Supabase error fetching session:', sessionError)
      console.error('Error details:', {
        message: sessionError.message,
        code: sessionError.code,
        details: sessionError.details
      })
      return null
    }

    if (!session) {
      console.error('❌ No session found with ID:', sessionId)
      return null
    }

    console.log('✅ Session found successfully:', {
      id: session.id,
      persona: session.persona,
      difficulty: session.difficulty_level,
      hasResume: !!session.resumes,
      hasJobDesc: !!session.job_descriptions,
      questionCount: session.interview_questions?.length || 0
    })

    return session
  } catch (error) {
    console.error('❌ Exception in fetchSessionContext:', error)
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
  const questions = sessionContext.interview_questions || []
  
  // Get persona-specific instructions
  const personaInstructions = getPersonaInstructions(persona)
  
  // Get main questions for reference
  const mainQuestions = questions
    .sort((a, b) => a.question_order - b.question_order)
    .map((q) => `${q.question_order}. ${q.question_text}`)
    .join('\n')

  return `You are conducting a ${difficulty} difficulty voice interview for LickedIn Interviews. ${personaInstructions}

CANDIDATE BACKGROUND:
${resume}

JOB REQUIREMENTS:
${jobDescription}

MAIN INTERVIEW QUESTIONS TO COVER:
${mainQuestions}

INSTRUCTIONS:
- Keep responses conversational and natural for voice (1-2 sentences max)
- Ask thoughtful follow-up questions to get deeper insights
- Work through the main questions but allow natural conversation flow
- Decide when to ask follow-ups vs. move to next main question
- If this seems like the start, introduce yourself and begin with the first main question
- Be encouraging but maintain professionalism
- Use the candidate's background and job requirements to make questions relevant

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
function getDecisionGuidance(action: 'follow_up' | 'next_question' | 'end_interview', sessionContext: SessionContext | null): string {
  const questions = sessionContext?.interview_questions || []
  
  switch (action) {
    case 'follow_up':
      return "DECISION: Ask a follow-up question to get more depth on the current topic. Probe for specific examples, challenges, or outcomes."
    case 'next_question':
      const nextQuestion = questions.find((q) => !q.addressed) // This would need tracking
      return nextQuestion 
        ? `DECISION: Move to the next main question: "${nextQuestion.question_text}"`
        : "DECISION: Continue with follow-up questions as all main questions have been introduced."
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

    // Get questions that have been addressed
    const addressedQuestions = new Set()
    recentConversation.forEach(turn => {
      if (turn.related_main_question_id) {
        addressedQuestions.add(turn.related_main_question_id)
      }
    })

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

QUESTIONS ALREADY ADDRESSED: ${addressedQuestions.size} out of ${questions.length}

Analyze the candidate's response and decide:
1. "follow_up" - if the response is shallow, incomplete, or needs clarification
2. "next_question" - if the response is complete and you should move to the next main question
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
  console.log('🔥🔥🔥 POST request to voice-agent - UPDATED CODE RUNNING!')
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))
  
  let requestBody
  try {
    requestBody = await request.json()
    console.log('✅ Successfully parsed request body:', JSON.stringify(requestBody, null, 2))
  } catch (error) {
    console.error('❌ Failed to parse request body:', error)
    return new Response('Bad Request', { status: 400 })
  }
  
  // Verify webhook signature
  const signature = request.headers.get('layercode-signature')
  console.log('Webhook signature present:', !!signature)
  console.log('Webhook secret configured:', !!process.env.LAYERCODE_WEBHOOK_SECRET)
  
  if (signature && process.env.LAYERCODE_WEBHOOK_SECRET) {
    console.log('Verifying webhook signature...')
    const isValid = verifySignature({
      payload: JSON.stringify(requestBody),
      signature,
      secret: process.env.LAYERCODE_WEBHOOK_SECRET
    })
    
    console.log('Signature valid:', isValid)
    if (!isValid) {
      console.log('❌ WEBHOOK SIGNATURE INVALID - REJECTING REQUEST')
      return new Response('Unauthorized', { status: 401 })
    }
  } else {
    console.log('⚠️ No signature verification (signature or secret missing)')
  }

  console.log('🎯 ENTERING STREAM RESPONSE CALLBACK')
  
  return streamResponse(requestBody, async ({ stream }) => {
    console.log('🎯🎯 INSIDE STREAM RESPONSE CALLBACK - PROCESSING REQUEST')
    
    // Extract webhook data
    const { text, type, session_id, session_context } = requestBody
    
    // Get LayerCode's session ID from the request
    const layercodeSessionId = session_id || session_context?.sessionId
    
    console.log('=== VOICE AGENT DEBUG ===')
    console.log('LayerCode session ID:', layercodeSessionId)
    console.log('Message type:', type)
    console.log('Text:', text)
    console.log('Full requestBody keys:', Object.keys(requestBody))
    
    // Look up our interview session ID using the LayerCode session ID
    const interviewSessionId = sessionMapping.get(layercodeSessionId || '')
    console.log('Mapped interview session ID:', interviewSessionId)
    
    if (!interviewSessionId) {
      console.log('❌ NO INTERVIEW SESSION MAPPING FOUND')
      console.log('Available mappings:', Array.from(sessionMapping.entries()))
    }
    
    // Fetch session context if available
    let sessionContext: SessionContext | null = null
    let recentConversation: ConversationTurn[] = []
    let nextTurnNumber = 1
    
    if (interviewSessionId) {
      console.log('Fetching session context for ID:', interviewSessionId)
      
      // First test basic database connectivity and list existing sessions
      try {
        const { data: testQuery, error: testError } = await supabase
          .from('interview_sessions')
          .select('id, status, created_at')
          .limit(5)
          .order('created_at', { ascending: false })
        
        if (testError) {
          console.error('❌ Database connectivity test failed:', testError)
        } else {
          console.log('✅ Database connectivity test passed')
          console.log('Recent sessions in database:', testQuery)
        }
      } catch (dbTestError) {
        console.error('❌ Database connectivity exception:', dbTestError)
      }
      
      sessionContext = await fetchSessionContext(interviewSessionId)
      console.log('Session context retrieved:', sessionContext ? 'SUCCESS' : 'NULL')
      if (sessionContext) {
        console.log('Session details:', {
          persona: sessionContext.persona,
          difficulty: sessionContext.difficulty_level,
          questionCount: sessionContext.interview_questions?.length || 0,
          resumeContent: sessionContext.resumes?.parsed_content ? 'PRESENT' : 'MISSING',
          jobContent: sessionContext.job_descriptions?.job_content ? 'PRESENT' : 'MISSING'
        })
      }
      
      recentConversation = await getRecentConversation(interviewSessionId, 8)
      console.log('Recent conversation turns:', recentConversation.length)
      
      nextTurnNumber = await getNextTurnNumber(interviewSessionId)
      console.log('Next turn number:', nextTurnNumber)
    } else {
      console.log('❌ NO INTERVIEW SESSION ID FOUND - using generic responses')
    }

    console.log('🔍 Checking conditions for user transcription...')
    console.log('Type check:', type, 'matches MESSAGE/message:', (type === 'MESSAGE' || type === 'message' || !type))
    console.log('Text check:', !!text, 'Text value:', text)
    
    // Send user transcription immediately via stream.data()
    if ((type === 'MESSAGE' || type === 'message' || !type) && text) {
      console.log('✅ Sending user transcription to frontend')
      stream.data({
        type: 'user_transcription',
        text: text,
        timestamp: Date.now()
      })
      
      // Store user message in conversation if we have a session
      if (interviewSessionId && text) {
        console.log('Storing user message in database...')
        const insertResult = await supabase
          .from('interview_conversation')
          .insert({
            session_id: interviewSessionId,
            turn_number: nextTurnNumber,
            speaker: 'candidate',
            message_text: text,
            message_type: 'response',
            word_count: text.split(' ').length,
            response_time_seconds: null // TODO: calculate from voice activity
          })
        
        if (insertResult.error) {
          console.error('Error storing user message:', insertResult.error)
        } else {
          console.log('✅ User message stored successfully')
        }
        
        nextTurnNumber++
      }
    }

    console.log('🤖 Starting AI response generation...')
    
    // Generate AI response
    try {
      // Use decision engine to determine next action
      let decision: { action: 'follow_up' | 'next_question' | 'end_interview', reasoning: string } = { action: 'follow_up', reasoning: 'Default behavior' }
      console.log('🧠 Running decision engine...')
      if (sessionContext && text) {
        decision = await analyzeConversationAndDecide(sessionContext, recentConversation, text)
        console.log('Decision engine result:', decision)
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
      const decisionGuidance = getDecisionGuidance(decision.action, sessionContext)
      
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

      const response = completion.choices[0]?.message?.content || "I see. Can you tell me more about that?"
      
      // Store interviewer response in conversation
      if (interviewSessionId && response) {
        const messageType = decision.action === 'end_interview' ? 'closing' : 
                           decision.action === 'next_question' ? 'main_question' : 'follow_up'
        
        console.log('Storing interviewer response in database...')
        const insertResult = await supabase
          .from('interview_conversation')
          .insert({
            session_id: interviewSessionId,
            turn_number: nextTurnNumber,
            speaker: 'interviewer',
            message_text: response,
            message_type: messageType,
            word_count: response.split(' ').length
          })
        
        if (insertResult.error) {
          console.error('Error storing interviewer response:', insertResult.error)
        } else {
          console.log('✅ Interviewer response stored successfully')
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
      
    } catch (error) {
      console.error('OpenAI completion error:', error)
      stream.tts("I apologize, but I'm having some technical difficulties. Let's continue with your interview.")
    }
    
    // End the stream
    stream.end()
  })
}

