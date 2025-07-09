import { NextRequest } from 'next/server'
import OpenAI from 'openai'
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
    // Extract webhook data
    const { text, session_id, type, session_context } = requestBody
    
    console.log('🔥 LayerCode webhook:', { text, session_id, type, session_context })
    
    // Send user transcription immediately via stream.data()
    if ((type === 'MESSAGE' || !type) && text) {
      console.log('📤 Sending user transcription via stream.data():', text)
      stream.data({
        type: 'user_transcription',
        text: text,
        timestamp: Date.now()
      })
    } else {
      console.log('⚠️ Skipping user transcription - no text or wrong type:', { type, hasText: !!text })
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
      
      console.log('📤 Sending agent transcription via stream.data():', response)
      // Send agent transcription immediately via stream.data()
      stream.data({
        type: 'agent_transcription',
        text: response,
        timestamp: Date.now()
      })
      
      // Stream the response back to LayerCode
      stream.tts(response)
      
    } catch {
      stream.tts("I apologize, but I'm having some technical difficulties. Let's continue with your interview.")
    }
    
    // End the stream
    stream.end()
  })
}

