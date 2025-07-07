import { NextRequest, NextResponse } from 'next/server'
// Note: Supabase imports available for future authentication integration
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    console.log('Voice authorization request received')
    
    // Parse request body to get session context
    const body = await request.json().catch(() => ({}))
    const { sessionId, metadata } = body
    
    console.log('Voice session data:', { sessionId, metadata })

    // For LayerCode voice integration, we'll allow authorization
    // TODO: In the future, we can add more sophisticated auth checks
    // by integrating with the current interview session context
    
    // Log the session for debugging
    if (sessionId) {
      console.log(`Voice session ${sessionId} authorized`)
    }

    // Return authorization success
    return NextResponse.json({
      authorized: true,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        service: 'LickedIn Interviews Voice',
        ...metadata
      }
    })

  } catch (error) {
    console.error('Voice authorization error:', error)
    
    // Return a more permissive response to avoid blocking voice setup
    return NextResponse.json({
      authorized: true,
      sessionId: 'fallback-session',
      timestamp: new Date().toISOString(),
      metadata: {
        service: 'LickedIn Interviews Voice',
        note: 'Fallback authorization'
      }
    })
  }
}