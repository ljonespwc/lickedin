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
    interviewEndedShowButton?: boolean;
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
      
      if (data.type === 'agent_transcription' || 
          (data.type === 'response.data' && content?.type === 'agent_transcription')) {
        const text = data.text || content?.text || ''
        onVoiceData({ 
          agentTranscription: text
        })
      }

      // Handle interview ended - show simple notification instead of modal
      if (data.type === 'interview_ended_wait_for_user' || 
          (data.type === 'response.data' && content?.type === 'interview_ended_wait_for_user')) {
        console.log('✅ Interview ended - showing navigation button')
        
        onVoiceData({ 
          interviewEndedShowButton: true
        })
        return
      }

      // REMOVED: Old interview_complete event handling - now using user-controlled completion only
      
      if (data.type === 'user_transcription' || 
          (data.type === 'response.data' && content?.type === 'user_transcription')) {
        // Extract text from the correct location
        const text = data.text || content?.text || ''
        onVoiceData({ 
          userTranscription: text
        })
      }
    }
  })

  const { 
    agentAudioAmplitude, 
    userAudioAmplitude,
    status: voiceStatus
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