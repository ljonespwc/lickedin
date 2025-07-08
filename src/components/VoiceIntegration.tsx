'use client'

import React from 'react'
import { useLayercodePipeline } from '@layercode/react-sdk'

interface VoiceIntegrationProps {
  onVoiceData: (data: { agentAudioAmplitude: number; status: string }) => void
}

export function VoiceIntegration({ onVoiceData }: VoiceIntegrationProps) {
  const { agentAudioAmplitude, status: voiceStatus } = useLayercodePipeline({
    pipelineId: process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID!,
    authorizeSessionEndpoint: '/api/voice-auth',
  })

  // Pass voice data to parent component
  React.useEffect(() => {
    onVoiceData({ agentAudioAmplitude, status: voiceStatus })
  }, [agentAudioAmplitude, voiceStatus, onVoiceData])

  return null // This component only handles the voice hook
}