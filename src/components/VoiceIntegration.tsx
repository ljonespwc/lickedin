'use client'

import React from 'react'
import { useLayercodePipeline } from '@layercode/react-sdk'

interface VoiceIntegrationProps {
  onVoiceData: (data: { 
    agentAudioAmplitude?: number; 
    userAudioAmplitude?: number;
    status?: string;
    agentTranscription?: string;
    userTranscription?: string;
    interviewComplete?: boolean;
    finalGoodbyeSent?: boolean;
  }) => void
}

interface TranscriptionStreamProps extends VoiceIntegrationProps {
  interviewSessionId: string
  pipelineId: string
}

export function VoiceIntegration({ onVoiceData, interviewSessionId, pipelineId }: TranscriptionStreamProps) {
  
  const hookData = useLayercodePipeline({
    pipelineId: pipelineId,
    authorizeSessionEndpoint: '/api/voice-auth',
    metadata: {
      interviewSessionId: interviewSessionId
    },
    onDataMessage: (data: { type: string; text?: string; content?: unknown; timestamp?: number }) => {
      // Handle transcription data
      const content = data.content as { type?: string; text?: string; message?: string } | undefined
      
      // Handle final goodbye sent - start monitoring for TTS completion
      if (data.type === 'final_goodbye_sent' || 
          (data.type === 'response.data' && content?.type === 'final_goodbye_sent')) {
        console.log('👋 Final goodbye sent - starting TTS completion monitoring')
        
        onVoiceData({ 
          finalGoodbyeSent: true,
          status: voiceStatus
        })
        return
      }

      // Handle interview completion event - check BOTH patterns
      if (data.type === 'interview_complete' || 
          (data.type === 'response.data' && content?.type === 'interview_complete')) {
        console.log('🏁 Interview complete event received - terminating LayerCode connection')
        
        // Terminate LayerCode pipeline connection
        if (disconnect && typeof disconnect === 'function') {
          console.log('🔌 Calling LayerCode disconnect method')
          try {
            const result = disconnect()
            // Handle promise rejection if disconnect returns a promise (cast to unknown to bypass typing)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const promiseResult = result as any
            if (promiseResult && typeof promiseResult.catch === 'function') {
              promiseResult.catch((error: unknown) => {
                console.warn('⚠️ LayerCode disconnect promise rejected (SDK internal issue):', error)
              })
            }
            console.log('✅ LayerCode disconnect called successfully')
          } catch (error) {
            console.warn('⚠️ LayerCode disconnect error (SDK internal issue):', error)
            // Continue anyway - this is a LayerCode SDK bug, not our issue
          }
        } else {
          console.warn('⚠️ LayerCode disconnect method not available')
        }
        
        onVoiceData({ 
          interviewComplete: true,
          status: 'disconnected' // Force status to disconnected
        })
        return
      }
      
      if (data.type === 'user_transcription' || 
          (data.type === 'response.data' && content?.type === 'user_transcription')) {
        // Extract text from the correct location
        const text = data.text || content?.text || ''
        onVoiceData({ 
          userTranscription: text
        })
      } else if (data.type === 'agent_transcription' || 
                 (data.type === 'response.data' && content?.type === 'agent_transcription')) {
        // Extract text from the correct location in LayerCode's data structure
        const text = data.text || content?.text || ''
        
        onVoiceData({ 
          agentTranscription: text
        })
      }
    }
  })

  const { 
    agentAudioAmplitude, 
    userAudioAmplitude,
    status: voiceStatus,
    disconnect
  } = hookData || {}
  
  // Debug: Log all available methods/properties (removed to reduce console spam)

  // Send audio/status updates to parent with throttling to reduce spam
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      onVoiceData({ 
        agentAudioAmplitude, 
        userAudioAmplitude,
        status: voiceStatus
      })
    }, 50) // Throttle to 20fps max
    
    return () => clearTimeout(timeoutId)
  }, [agentAudioAmplitude, userAudioAmplitude, voiceStatus, onVoiceData])

  return null // This component only handles the voice hook
}