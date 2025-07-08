import { NextRequest } from 'next/server'
import { getTranscription } from '@/lib/transcription-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    console.log('=== SSE ROUTE: GET request ===')
    console.log('Session ID:', sessionId)
    
    if (!sessionId) {
      console.log('=== SSE ROUTE: Missing sessionId ===')
      return new Response('Missing sessionId', { status: 400 })
    }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))
      
      // Check for updates every 500ms
      const interval = setInterval(() => {
        const data = getTranscription(sessionId)
        if (data.lastUpdate > 0) {
          console.log(`=== SSE SENDING DATA ===`)
          console.log(`Session: ${sessionId}`)
          console.log('Data:', data)
          
          const payload = {
            type: 'transcription',
            userText: data.userText,
            agentText: data.agentText,
            timestamp: data.lastUpdate
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }
      }, 500)

      // Cleanup after 30 minutes
      setTimeout(() => {
        clearInterval(interval)
        controller.close()
      }, 30 * 60 * 1000)
    }
  })

  return new Response(stream, { headers })
  } catch (error) {
    console.error('SSE Route error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}