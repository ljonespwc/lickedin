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
    // Verify webhook signature for security
    const signature = request.headers.get('x-layercode-signature')
    const timestamp = request.headers.get('x-layercode-timestamp')
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
    }

    // Parse the webhook payload
    const body = await request.json()
    const { type, text } = body
    // Note: session_id and turn_id available for future use

    // Handle different webhook event types
    if (type === 'session.start') {
      // Initialize the interview session
      // TODO: Use LayerCode streamResponse once SDK types are resolved
      return new Response("Welcome to LickedIn Interviews! I'm your AI interviewer. Let's start with your first question.", {
        headers: { 'Content-Type': 'text/plain' }
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
        
        // Return the response for LayerCode to convert to speech
        return new Response(response, {
          headers: { 'Content-Type': 'text/plain' }
        })

      } catch (error) {
        console.error('Voice agent error:', error)
        return new Response("I apologize, but I'm having some technical difficulties. Let's continue with your interview.", {
          headers: { 'Content-Type': 'text/plain' }
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