import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { updateTranscription, mapLayerCodeSession } from '@/lib/transcription-store'
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
    
    // Extract data from the request body
    const { text, session_id, session_context } = requestBody
    console.log('Input text:', text)
    console.log('Session context:', session_context)
    
    // Extract interview session ID from LayerCode session context
    const interviewSessionId = session_context?.interview_session_id
    console.log('Interview session ID from context:', interviewSessionId)
    
    // Map LayerCode session to interview session
    if (session_id && interviewSessionId) {
      console.log('=== MAPPING SESSIONS ===')
      mapLayerCodeSession(session_id, interviewSessionId)
    }
    
    // Store user transcription
    if (text && interviewSessionId) {
      console.log('=== STORING USER TRANSCRIPTION ===')
      console.log('Text:', text)
      updateTranscription(interviewSessionId, 'user', text)
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
      if (response && interviewSessionId) {
        console.log('=== STORING AGENT TRANSCRIPTION ===')
        console.log('Response:', response)
        updateTranscription(interviewSessionId, 'agent', response)
      }
      
      // Stream the response back to LayerCode
      const responseStream = async function* () {
        yield response
      }
      await stream.ttsTextStream(responseStream())
      
    } catch (error) {
      console.error('OpenAI error:', error)
      const errorStream = async function* () {
        yield "I apologize, but I'm having some technical difficulties. Let's continue with your interview."
      }
      await stream.ttsTextStream(errorStream())
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