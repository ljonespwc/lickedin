import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { updateTranscription, mapLayerCodeSession, getInterviewSessionId } from '@/lib/transcription-store'
// Note: LayerCode and Supabase imports available for future integration
// import { streamResponse } from '@layercode/node-server-sdk'
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Add a simple GET handler to test if the endpoint is reachable
export async function GET() {
  console.log('=== WEBHOOK GET TEST ===')
  return new Response('Webhook endpoint is working!', { status: 200 })
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== WEBHOOK REQUEST RECEIVED ===')
    console.log('Method:', request.method)
    console.log('URL:', request.url)
    console.log('Timestamp:', new Date().toISOString())
    
    // Extract interview session ID from URL query params
    const { searchParams } = new URL(request.url)
    const interviewSessionId = searchParams.get('sessionId')
    console.log('Interview Session ID from URL:', interviewSessionId)
    
    // LayerCode sends signature as "layercode-signature" (without x- prefix)
    const signature = request.headers.get('layercode-signature')
    
    console.log('=== WEBHOOK HEADERS CHECK ===')
    console.log('All headers:', Object.fromEntries(request.headers.entries()))
    console.log('Has signature:', !!signature)
    
    // TEMPORARILY DISABLE signature validation for debugging
    // if (!signature) {
    //   console.error('Missing LayerCode signature header')
    //   return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
    // }

    // Parse the webhook payload
    const body = await request.json()
    const { type, text, turn_id, session_id } = body
    
    console.log('=== VOICE WEBHOOK DEBUG ===')
    console.log('Full payload:', { type, text, turn_id, session_id })
    console.log('Text length:', text?.length || 0)
    console.log('Session ID:', session_id)

    // Handle different webhook event types
    if (type === 'session.start') {
      // Map LayerCode session to interview session if we have the interview session ID
      if (interviewSessionId && session_id) {
        console.log('=== MAPPING SESSIONS ===')
        mapLayerCodeSession(session_id, interviewSessionId)
      } else {
        console.log('=== SESSION MAPPING FAILED ===')
        console.log('Missing interview session ID in URL or LayerCode session ID')
      }
      
      // Initialize the interview session with SSE format
      const welcomeMessage = "Welcome to LickedIn Interviews! I'm your AI interviewer. Let's start with your first question."
      
      const sseData = JSON.stringify({
        type: "response.tts",
        content: welcomeMessage,
        turn_id: turn_id
      })
      
      
      return new Response(`data: ${sseData}\n\ndata: ${JSON.stringify({type: "response.end", turn_id: turn_id})}\n\n`, {
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    if (type === 'message') {
      // Get the mapped interview session ID
      const mappedInterviewSessionId = session_id ? getInterviewSessionId(session_id) : null
      console.log('=== MESSAGE EVENT PROCESSING ===')
      console.log('LayerCode session ID:', session_id)
      console.log('Mapped interview session ID:', mappedInterviewSessionId)
      
      // Store user transcription for real-time display
      if (text && mappedInterviewSessionId) {
        console.log('=== STORING USER TRANSCRIPTION ===')
        console.log('Using interview session ID:', mappedInterviewSessionId)
        console.log('User text:', text)
        updateTranscription(mappedInterviewSessionId, 'user', text)
        console.log('Transcription stored successfully')
      } else {
        console.log('=== SKIPPING USER TRANSCRIPTION ===')
        console.log('Missing text or mapped session:', { 
          hasText: !!text, 
          hasLayerCodeSession: !!session_id,
          hasMappedSession: !!mappedInterviewSessionId 
        })
      }
      
      // Handle user's voice message during interview
      try {
        // Supabase client available for future integration with interview sessions
        // const cookieStore = await cookies()
        // const supabase = createServerClient(...)

        // TODO: In the future, we can get the session_id from the LayerCode session
        // and use it to fetch current interview question and context
        
        // Create an AI interviewer that maintains conversation context
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a professional job interviewer conducting a voice interview for LickedIn Interviews. 

Guidelines:
- Keep responses conversational and natural for voice
- Ask thoughtful follow-up questions based on responses
- Be encouraging but maintain professionalism
- If this seems like the start of conversation, introduce yourself
- Ask about their background, experience, and motivations
- Limit responses to 1-2 sentences for natural conversation flow

Current interview context: This is a demo interview session.`
            },
            {
              role: "user", 
              content: text
            }
          ],
          temperature: 0.7,
          max_tokens: 150
        })

        const response = completion.choices[0]?.message?.content || "I see. Can you tell me more about that?"
        
        // Store agent transcription for real-time display
        if (response && mappedInterviewSessionId) {
          console.log('=== STORING AGENT TRANSCRIPTION ===')
          console.log('Using interview session ID:', mappedInterviewSessionId)
          console.log('Agent response:', response)
          updateTranscription(mappedInterviewSessionId, 'agent', response)
          console.log('Agent transcription stored successfully')
        } else {
          console.log('=== SKIPPING AGENT TRANSCRIPTION ===')
          console.log('Missing response or mapped session:', { 
            hasResponse: !!response, 
            hasMappedSession: !!mappedInterviewSessionId 
          })
        }
        
        // Return SSE format for LayerCode TTS
        const sseData = JSON.stringify({
          type: "response.tts",
          content: response,
          turn_id: turn_id
        })
        
        
        return new Response(`data: ${sseData}\n\ndata: ${JSON.stringify({type: "response.end", turn_id: turn_id})}\n\n`, {
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        })

      } catch (error) {
        console.error('Voice agent error:', error)
        
        const errorMessage = "I apologize, but I'm having some technical difficulties. Let's continue with your interview."
        const sseData = JSON.stringify({
          type: "response.tts",
          content: errorMessage,
          turn_id: turn_id
        })
        
        return new Response(`data: ${sseData}\n\ndata: ${JSON.stringify({type: "response.end", turn_id: turn_id})}\n\n`, {
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        })
      }
    }

    // Handle unknown event types
    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add handlers for other HTTP methods to debug
export async function PUT(request: NextRequest) {
  console.log('=== WEBHOOK PUT RECEIVED ===')
  console.log('Headers:', Object.fromEntries(request.headers.entries()))
  return new Response('PUT received', { status: 200 })
}

export async function PATCH(request: NextRequest) {
  console.log('=== WEBHOOK PATCH RECEIVED ===')
  console.log('Headers:', Object.fromEntries(request.headers.entries()))
  return new Response('PATCH received', { status: 200 })
}