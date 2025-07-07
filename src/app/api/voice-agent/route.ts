import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
// Note: LayerCode and Supabase imports available for future integration
// import { streamResponse } from '@layercode/node-server-sdk'
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Log webhook headers for debugging
    const signature = request.headers.get('x-layercode-signature')
    const timestamp = request.headers.get('x-layercode-timestamp')
    const allHeaders = Object.fromEntries(request.headers.entries())
    
    console.log('Voice agent webhook received:', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      headers: allHeaders
    })
    
    // Temporarily disable strict signature validation for debugging
    // TODO: Re-enable proper signature validation once headers are confirmed
    // if (!signature || !timestamp) {
    //   return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
    // }

    // Parse the webhook payload
    const body = await request.json()
    const { type, text, turn_id } = body
    
    console.log('Webhook payload:', { type, text, turn_id })

    // Handle different webhook event types
    if (type === 'session.start') {
      // Initialize the interview session with SSE format
      const welcomeMessage = "Welcome to LickedIn Interviews! I'm your AI interviewer. Let's start with your first question."
      
      const sseData = JSON.stringify({
        type: "response.tts",
        content: welcomeMessage,
        turn_id: turn_id
      })
      
      console.log('Sending welcome TTS response:', sseData)
      
      return new Response(`data: ${sseData}\n\ndata: ${JSON.stringify({type: "response.end", turn_id: turn_id})}\n\n`, {
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    if (type === 'message') {
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
        
        // Return SSE format for LayerCode TTS
        const sseData = JSON.stringify({
          type: "response.tts",
          content: response,
          turn_id: turn_id
        })
        
        console.log('Sending TTS response:', sseData)
        
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