import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { updateTranscription, getInterviewSessionId } from '@/lib/transcription-store'
import { streamResponse, verifySignature } from '@layercode/node-server-sdk'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET() {
  return new Response('Webhook endpoint is working!', { status: 200 })
}

export async function POST(request: NextRequest) {
  const requestBody = await request.json()
  
  // Verify webhook signature
  const signature = request.headers.get('layercode-signature')
  if (signature && process.env.LAYERCODE_WEBHOOK_SECRET) {
    const isValid = verifySignature({
      payload: JSON.stringify(requestBody),
      signature,
      secret: process.env.LAYERCODE_WEBHOOK_SECRET
    })
    
    if (!isValid) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  return streamResponse(requestBody, async ({ stream }) => {
    // Log the complete request body to understand LayerCode's structure
    console.log('LayerCode webhook request body:', JSON.stringify(requestBody, null, 2))
    
    // Extract webhook data
    const { text, session_id, type, session_context } = requestBody
    
    // Try to get interview session ID from session context first, then fallback to complex mapping
    let interviewSessionId = session_context?.sessionId || session_context?.interviewSessionId
    
    // If no session context, use existing fallback approach
    if (!interviewSessionId && session_id) {
      interviewSessionId = getInterviewSessionId(session_id)
      console.log('Using fallback session mapping for:', session_id, '→', interviewSessionId)
    }
    
    console.log('Final interview session ID:', interviewSessionId)
    
    // Handle MESSAGE event - store user transcription
    if ((type === 'MESSAGE' || !type) && text && interviewSessionId) {
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
        updateTranscription(interviewSessionId, 'agent', response)
      }
      
      // Stream the response back to LayerCode
      stream.tts(response)
      
    } catch {
      stream.tts("I apologize, but I'm having some technical difficulties. Let's continue with your interview.")
    }
    
    // End the stream
    stream.end()
  })
}

