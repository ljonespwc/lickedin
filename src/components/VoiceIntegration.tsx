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

  // Poll for transcription updates
  React.useEffect(() => {
    if (!sessionId) {
      console.log('=== TRANSCRIPTION POLL: No sessionId provided ===')
      return
    }

    console.log(`=== TRANSCRIPTION POLL: Starting polling for session ${sessionId} ===`)
    
    let lastTimestamp = 0
    
    const pollTranscription = async () => {
      try {
        console.log('=== TRANSCRIPTION POLL: Fetching data ===')
        const response = await fetch(`/api/transcription-stream?sessionId=${sessionId}`)
        
        if (!response.ok) {
          console.error('Transcription poll failed:', response.status)
          return
        }
        
        const data = await response.json()
        console.log('=== TRANSCRIPTION POLL: Received data ===', data)
        
        // Only update if there's new data
        if (data.timestamp > lastTimestamp) {
          console.log('=== TRANSCRIPTION POLL: Updating UI ===')
          console.log('Agent text:', data.agentText)
          console.log('User text:', data.userText)
          setAgentText(data.agentText || '')
          setUserText(data.userText || '')
          lastTimestamp = data.timestamp
        } else {
          console.log('=== TRANSCRIPTION POLL: No new data ===')
        }
      } catch (error) {
        console.error('Transcription poll error:', error)
      }
    }
    
    // Poll every 1 second
    const interval = setInterval(pollTranscription, 1000)
    
    // Initial poll
    pollTranscription()

    return () => {
      console.log('=== TRANSCRIPTION POLL: Stopping polling ===')
      clearInterval(interval)
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