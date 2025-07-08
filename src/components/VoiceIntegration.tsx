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
  })

  // Connect to transcription SSE stream
  React.useEffect(() => {
    if (!sessionId) {
      console.log('=== SSE: No sessionId provided ===')
      return
    }

    console.log(`=== SSE: Connecting to transcription stream for session ${sessionId} ===`)
    const eventSource = new EventSource(`/api/transcription-stream?sessionId=${sessionId}`)
    
    eventSource.onopen = () => {
      console.log('=== SSE: Connection opened ===')
    }
    
    eventSource.onmessage = (event) => {
      console.log('=== SSE: Message received ===', event.data)
      try {
        const data = JSON.parse(event.data)
        console.log('=== SSE: Parsed data ===', data)
        
        if (data.type === 'transcription') {
          console.log('=== SSE: Setting transcription data ===')
          console.log('Agent text:', data.agentText)
          console.log('User text:', data.userText)
          setAgentText(data.agentText || '')
          setUserText(data.userText || '')
        } else if (data.type === 'connected') {
          console.log('=== SSE: Connected confirmation received ===')
        }
      } catch (error) {
        console.error('Error parsing transcription data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('Transcription SSE error:', error)
      console.log('EventSource readyState:', eventSource.readyState)
    }

    return () => {
      console.log('=== SSE: Closing connection ===')
      eventSource.close()
    }
  }, [sessionId])

  // Pass voice data to parent component
  React.useEffect(() => {
    console.log('=== VOICE DATA UPDATE ===')
    console.log('Agent amplitude:', agentAudioAmplitude)
    console.log('Voice status:', voiceStatus)
    console.log('Agent transcription:', agentText)
    console.log('User transcription:', userText)
    
    onVoiceData({ 
      agentAudioAmplitude, 
      status: voiceStatus,
      agentTranscription: agentText,
      userTranscription: userText
    })
  }, [agentAudioAmplitude, voiceStatus, agentText, userText, onVoiceData])

  return null // This component only handles the voice hook
}