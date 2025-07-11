import { NextRequest, NextResponse } from 'next/server'
import { sessionMapping } from '../session-mapping'
// Note: Supabase imports available for future authentication integration
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Parse request body to get session context
    const body = await request.json().catch(() => ({}))
    
    // The sessionContext from React SDK should be here
    const { sessionId, metadata, sessionContext } = body
    const interviewSessionId = sessionId || sessionContext?.sessionId || sessionContext?.interviewSessionId
    
    console.log('Voice auth - Interview session ID:', interviewSessionId)
    console.log('Voice auth - Full session context to send:', {
      sessionId: interviewSessionId,
      interviewSessionId: interviewSessionId,
      service: 'LickedIn Interviews Voice',
      ...metadata
    })

    // Call LayerCode API to generate client_session_key
    const layercodeApiKey = process.env.LAYERCODE_API_KEY
    const pipelineId = process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID
    
    if (!layercodeApiKey || !pipelineId) {
      throw new Error('Missing LayerCode configuration')
    }

    // Make request to LayerCode authorization API
    const layercodeResponse = await fetch('https://api.layercode.com/v1/pipelines/authorize_session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${layercodeApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pipeline_id: pipelineId,
        session_context: {
          sessionId: interviewSessionId,
          interviewSessionId: interviewSessionId,
          service: 'LickedIn Interviews Voice',
          ...metadata
        }
      })
    })

    if (!layercodeResponse.ok) {
      throw new Error(`LayerCode API error: ${layercodeResponse.status}`)
    }

    const layercodeData = await layercodeResponse.json()
    
    // Store the session mapping if LayerCode returned a session ID
    if (layercodeData.session_id && interviewSessionId) {
      sessionMapping.set(layercodeData.session_id, interviewSessionId)
      console.log('✅ Session mapping stored:', {
        layercodeSessionId: layercodeData.session_id,
        interviewSessionId: interviewSessionId
      })
    }
    
    // Return exactly what LayerCode API returns for React SDK compatibility
    return NextResponse.json(layercodeData)

  } catch (error) {
    // Return error response
    return NextResponse.json({
      error: 'Voice authorization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      authorized: false
    }, { status: 500 })
  }
}