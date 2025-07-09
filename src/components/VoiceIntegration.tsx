'use client'

import React from 'react'
import { useLayercodePipeline } from '@layercode/react-sdk'

interface VoiceIntegrationProps {
  onVoiceData: (data: { 
    agentAudioAmplitude: number; 
    status: string;
    agentTranscription?: string;
    userTranscription?: string;
  }) => void
}

interface TranscriptionStreamProps extends VoiceIntegrationProps {
  sessionId: string
}

export function VoiceIntegration({ onVoiceData, sessionId }: TranscriptionStreamProps) {
  const agentTextRef = React.useRef('')
  const userTextRef = React.useRef('')
  
  const hookData = useLayercodePipeline({
    pipelineId: process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID!,
    authorizeSessionEndpoint: '/api/voice-auth',
    sessionContext: {
      sessionId: sessionId,
      interviewSessionId: sessionId
    },
    onDataMessage: (data: { type: string; text: string; timestamp: number }) => {
      console.log('🔥 LayerCode stream.data() received:', data)
      
      // Handle real-time transcription data from stream.data()
      if (data.type === 'user_transcription') {
        console.log('🟢 Setting user text:', data.text)
        userTextRef.current = data.text
        onVoiceData({ 
          agentAudioAmplitude: hookData.agentAudioAmplitude || 0, 
          status: hookData.status || 'disconnected',
          agentTranscription: agentTextRef.current,
          userTranscription: data.text
        })
      } else if (data.type === 'agent_transcription') {
        console.log('🟠 Setting agent text:', data.text)
        agentTextRef.current = data.text
        onVoiceData({ 
          agentAudioAmplitude: hookData.agentAudioAmplitude || 0, 
          status: hookData.status || 'disconnected',
          agentTranscription: data.text,
          userTranscription: userTextRef.current
        })
      }
    }
  })

  const { 
    agentAudioAmplitude, 
    status: voiceStatus
  } = hookData

  // Only update audio/status when they change - no transcription clearing
  React.useEffect(() => {
    onVoiceData({ 
      agentAudioAmplitude, 
      status: voiceStatus,
      agentTranscription: agentTextRef.current,
      userTranscription: userTextRef.current
    })
  }, [agentAudioAmplitude, voiceStatus, onVoiceData])

  return null // This component only handles the voice hook
}