import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { updateTranscription, getInterviewSessionId } from '@/lib/transcription-store'
import { streamResponse, verifySignature } from '@layercode/node-server-sdk'

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
  const requestBody = await request.json()
  
  console.log('=== LAYERCODE WEBHOOK RECEIVED ===')
  console.log('Full payload:', requestBody)
  
  // Verify webhook signature (optional in development)
  const signature = request.headers.get('layercode-signature')
  if (signature && process.env.LAYERCODE_WEBHOOK_SECRET) {
    const isValid = verifySignature({
      payload: JSON.stringify(requestBody),
      signature,
      secret: process.env.LAYERCODE_WEBHOOK_SECRET
    })
    
    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  return streamResponse(requestBody, async ({ stream }) => {
    console.log('=== STREAM RESPONSE HANDLER ===')
    console.log('Request body:', requestBody)
    
    // Based on webhook API docs, extract the correct fields
    const { text, session_id, type, turn_id, connection_id } = requestBody
    console.log('Event type:', type)
    console.log('Input text:', text)
    console.log('Session ID:', session_id)
    console.log('Turn ID:', turn_id)
    console.log('Connection ID:', connection_id)
    
    // Get interview session ID using fallback approach
    const mappedInterviewSessionId = session_id ? getInterviewSessionId(session_id) : null
    console.log('=== FINAL SESSION MAPPING ===')
    console.log('Mapped interview session ID:', mappedInterviewSessionId)
    
    // Handle SESSION_START event
    if (type === 'SESSION_START') {
      console.log('=== SESSION START EVENT ===')
      // Just respond with a greeting, no transcription storage needed
    }
    
    // Handle MESSAGE event
    if (type === 'MESSAGE' || !type) { // Handle both MESSAGE and undefined type
      // Store user transcription
      if (text && mappedInterviewSessionId) {
        console.log('=== STORING USER TRANSCRIPTION ===')
        console.log('Text:', text)
        console.log('Session:', mappedInterviewSessionId)
        updateTranscription(mappedInterviewSessionId, 'user', text)
      } else {
        console.log('=== CANNOT STORE USER TRANSCRIPTION ===')
        console.log('Missing text or session mapping:', { 
          hasText: !!text,
          hasMappedSession: !!mappedInterviewSessionId 
        })
      }
    }

    // Generate AI response
    try {
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
            content: text || "Hello"
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })

      const response = completion.choices[0]?.message?.content || "I see. Can you tell me more about that?"
      
      // Store agent transcription
      if (response && mappedInterviewSessionId) {
        console.log('=== STORING AGENT TRANSCRIPTION ===')
        console.log('Response:', response)
        console.log('Session:', mappedInterviewSessionId)
        updateTranscription(mappedInterviewSessionId, 'agent', response)
      }
      
      // Stream the response back to LayerCode
      stream.tts(response)
      
    } catch (error) {
      console.error('OpenAI error:', error)
      stream.tts("I apologize, but I'm having some technical difficulties. Let's continue with your interview.")
    }
    
    // End the stream
    stream.end()
  })
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