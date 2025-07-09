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

  const { 
    agentAudioAmplitude, 
    status: voiceStatus
  } = useLayercodePipeline({
    pipelineId: process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID!,
    authorizeSessionEndpoint: '/api/voice-auth',
    sessionContext: {
      sessionId: sessionId,
      interviewSessionId: sessionId
    }
  })

  // Poll for transcription updates
  React.useEffect(() => {
    if (!sessionId) return

    let lastTimestamp = 0
    
    const pollTranscription = async () => {
      try {
        const response = await fetch(`/api/transcription-stream?sessionId=${sessionId}`)
        
        if (!response.ok) return
        
        const data = await response.json()
        
        // Only update if there's new data
        if (data.timestamp > lastTimestamp) {
          setAgentText(data.agentText || '')
          setUserText(data.userText || '')
          lastTimestamp = data.timestamp
        }
      } catch {
        // Silently handle errors to avoid console spam
      }
    }
    
    // Poll every 1 second
    const interval = setInterval(pollTranscription, 1000)
    
    // Initial poll
    pollTranscription()

    return () => {
      clearInterval(interval)
    }
  }, [sessionId])

  // Pass voice data to parent component
  React.useEffect(() => {
    onVoiceData({ 
      agentAudioAmplitude, 
      status: voiceStatus,
      agentTranscription: agentText,
      userTranscription: userText
    })
  }, [agentAudioAmplitude, voiceStatus, agentText, userText, onVoiceData])

  return null // This component only handles the voice hook
}