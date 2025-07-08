import { NextRequest } from 'next/server'
import { getTranscription, setLatestInterviewSessionId } from '@/lib/transcription-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    console.log('=== TRANSCRIPTION POLL: GET request ===')
    console.log('Session ID:', sessionId)
    
    if (!sessionId) {
      console.log('=== TRANSCRIPTION POLL: Missing sessionId ===')
      return new Response('Missing sessionId', { status: 400 })
    }
    
    // Since this is being polled, this is definitely an active interview session
    // Use this to set the latest interview session ID for webhook mapping
    setLatestInterviewSessionId(sessionId)

    // Simple polling endpoint - get current transcription data
    const data = getTranscription(sessionId)
    console.log('=== TRANSCRIPTION POLL: Retrieved data ===')
    console.log(`Session: ${sessionId}`)
    console.log('Data:', data)
    
    return Response.json({
      userText: data.userText,
      agentText: data.agentText,
      timestamp: data.lastUpdate
    })
    
  } catch (error) {
    console.error('Transcription poll error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}