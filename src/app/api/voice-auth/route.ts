import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Parse request body to get session context
    const body = await request.json().catch(() => ({}))
    
    // Extract values from the request
    const { pipeline_id, metadata } = body
    const interviewSessionId = metadata?.interviewSessionId
    
    console.log('Voice auth - Interview session ID:', interviewSessionId)

    // Call LayerCode API to generate client_session_key
    const layercodeApiKey = process.env.LAYERCODE_API_KEY
    const pipelineId = pipeline_id || process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID
    
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
          service: 'LickedIn Interviews Voice'
        }
      })
    })

    if (!layercodeResponse.ok) {
      throw new Error(`LayerCode API error: ${layercodeResponse.status}`)
    }

    const layercodeData = await layercodeResponse.json()
    
    // Store the LayerCode session ID in the database
    if (layercodeData.session_id && interviewSessionId) {
      const { error: updateError } = await supabase
        .from('interview_sessions')
        .update({ layercode_session_id: layercodeData.session_id })
        .eq('id', interviewSessionId)
      
      if (updateError) {
        console.error('❌ Error storing LayerCode session ID:', updateError)
      } else {
        console.log('✅ LayerCode session ID stored in database:', {
          layercodeSessionId: layercodeData.session_id,
          interviewSessionId: interviewSessionId
        })
      }
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