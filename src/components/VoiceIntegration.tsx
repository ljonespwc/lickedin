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
      
      // Handle interview completion event - check BOTH patterns
      if (data.type === 'interview_complete' || 
          (data.type === 'response.data' && content?.type === 'interview_complete')) {
        console.log('🎉 Received interview_complete event:', data)
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
      } else {
        // Log unknown data types for debugging
        console.log('LayerCode unknown data type:', data.type, 'content.type:', content?.type)
      }
    }
  })

  const { 
    agentAudioAmplitude, 
    userAudioAmplitude,
    status: voiceStatus
  } = hookData

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