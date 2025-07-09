'use client'

import React from 'react'
import { useLayercodePipeline } from '@layercode/react-sdk'

interface VoiceIntegrationProps {
  onVoiceData: (data: { 
    agentAudioAmplitude?: number; 
    status?: string;
    agentTranscription?: string;
    userTranscription?: string;
  }) => void
}

interface TranscriptionStreamProps extends VoiceIntegrationProps {
  sessionId: string
}

export function VoiceIntegration({ onVoiceData, sessionId }: TranscriptionStreamProps) {
  const hookData = useLayercodePipeline({
    pipelineId: process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID!,
    authorizeSessionEndpoint: '/api/voice-auth',
    sessionContext: {
      sessionId: sessionId,
      interviewSessionId: sessionId
    },
    onDataMessage: (data: { type: string; text: string; timestamp: number }) => {
      console.log('🔥 LayerCode stream.data() received:', data)
      
      // Immediately call parent with the transcription data
      if (data.type === 'user_transcription') {
        console.log('🟢 Sending user text to parent:', data.text)
        onVoiceData({ 
          userTranscription: data.text
        })
      } else if (data.type === 'agent_transcription') {
        console.log('🟠 Sending agent text to parent:', data.text)
        onVoiceData({ 
          agentTranscription: data.text
        })
      }
    }
  })

  const { 
    agentAudioAmplitude, 
    status: voiceStatus
  } = hookData

  // Send audio/status updates to parent, but DON'T include transcriptions (they're sent separately)
  React.useEffect(() => {
    onVoiceData({ 
      agentAudioAmplitude, 
      status: voiceStatus
    })
  }, [agentAudioAmplitude, voiceStatus, onVoiceData])

  return null // This component only handles the voice hook
}