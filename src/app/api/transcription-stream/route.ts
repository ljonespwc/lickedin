import { NextRequest } from 'next/server'
import { getTranscription, setLatestInterviewSessionId } from '@/lib/transcription-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400 })
    }
    
    // Since this is being polled, this is definitely an active interview session
    // Use this to set the latest interview session ID for webhook mapping
    setLatestInterviewSessionId(sessionId)

    // Get current transcription data
    const data = getTranscription(sessionId)
    
    return Response.json({
      userText: data.userText,
      agentText: data.agentText,
      timestamp: data.lastUpdate
    })
    
  } catch {
    return new Response('Internal server error', { status: 500 })
  }
}