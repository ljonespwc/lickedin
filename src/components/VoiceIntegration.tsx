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
  const [polledAgentText, setPolledAgentText] = React.useState('')
  const [polledUserText, setPolledUserText] = React.useState('')

  const hookData = useLayercodePipeline({
    pipelineId: process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID!,
    authorizeSessionEndpoint: '/api/voice-auth',
    sessionContext: {
      sessionId: sessionId,
      interviewSessionId: sessionId
    },
    onData: (data: { type: string; text: string; sessionId: string; timestamp: number }) => {
      console.log('LayerCode stream.data() received:', data)
      
      // Handle transcription data from stream.data()
      if (data.type === 'user_transcription' && data.sessionId === sessionId) {
        setPolledUserText(data.text)
      } else if (data.type === 'agent_transcription' && data.sessionId === sessionId) {
        setPolledAgentText(data.text)
      }
    }
  })

  // Log all hook data to see what's available
  React.useEffect(() => {
    console.log('LayerCode hook data:', hookData)
  }, [hookData])

  const { 
    agentAudioAmplitude, 
    status: voiceStatus,
    userAudioAmplitude
  } = hookData

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
          setPolledAgentText(data.agentText || '')
          setPolledUserText(data.userText || '')
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
    console.log('Transcription update - Agent:', polledAgentText, 'User:', polledUserText)
    
    onVoiceData({ 
      agentAudioAmplitude, 
      status: voiceStatus,
      agentTranscription: polledAgentText,
      userTranscription: polledUserText
    })
  }, [agentAudioAmplitude, voiceStatus, polledAgentText, polledUserText, onVoiceData, userAudioAmplitude])

  return null // This component only handles the voice hook
}