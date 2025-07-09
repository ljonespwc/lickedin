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
  const [agentText, setAgentText] = React.useState('')
  const [userText, setUserText] = React.useState('')
  const [currentVoiceData, setCurrentVoiceData] = React.useState({ agentAudioAmplitude: 0, status: 'disconnected' })

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
        setUserText(data.text)
        // Immediately update parent with new user text
        onVoiceData({ 
          agentAudioAmplitude: currentVoiceData.agentAudioAmplitude, 
          status: currentVoiceData.status,
          agentTranscription: agentText,
          userTranscription: data.text
        })
      } else if (data.type === 'agent_transcription') {
        console.log('🟠 Setting agent text:', data.text)
        setAgentText(data.text)
        // Immediately update parent with new agent text
        onVoiceData({ 
          agentAudioAmplitude: currentVoiceData.agentAudioAmplitude, 
          status: currentVoiceData.status,
          agentTranscription: data.text,
          userTranscription: userText
        })
      }
    }
  })


  const { 
    agentAudioAmplitude, 
    status: voiceStatus
  } = hookData

  // Update current voice data when audio/status changes
  React.useEffect(() => {
    const newVoiceData = { agentAudioAmplitude, status: voiceStatus }
    setCurrentVoiceData(newVoiceData)
    
    // Also update parent with current transcription data
    onVoiceData({ 
      agentAudioAmplitude, 
      status: voiceStatus,
      agentTranscription: agentText,
      userTranscription: userText
    })
  }, [agentAudioAmplitude, voiceStatus, agentText, userText, onVoiceData])

  return null // This component only handles the voice hook
}