'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Mic } from "lucide-react"
import Confetti from 'react-confetti'
// Dynamic import to avoid SSR issues with LayerCode
const VoiceIntegration = dynamic(() => import('@/components/VoiceIntegration').then(mod => ({ default: mod.VoiceIntegration })), {
  ssr: false,
  loading: () => null
})

interface InterviewSession {
  id: string
  persona: string // DEPRECATED: Legacy field
  difficulty_level: string
  interview_type: string
  voice_gender: string
  communication_style: string
  question_count: number
  status: string
}

// interface Question {
//   id: string
//   question_text: string
//   question_order: number
//   question_type: string
// }

const InterviewSession = () => {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [timeElapsed, setTimeElapsed] = useState(0)
  // Enhanced progress tracking
  const [progressData, setProgressData] = useState({
    currentMainQuestion: 1,
    mainQuestionsAsked: 0,
    mainQuestionsCompleted: 0,
    currentQuestionType: 'main_question',
    currentFollowupCount: 0,
    followupLetter: null as string | null,
    totalQuestionsAsked: 0,
    progress: 0
  })
  // const [transcription] = useState('') // TODO: Implement live transcription
  const [session, setSession] = useState<InterviewSession | null>(null)
  // const [questions] = useState<Question[]>([]) // TODO: Load and use questions
  // const [currentQuestionText, setCurrentQuestionText] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Interview completion state
  const [showConfetti, setShowConfetti] = useState(false)
  const [showEndButton, setShowEndButton] = useState(false)
  // REMOVED: prevStatusRef no longer needed since old completion detection was removed

  // Voice integration state
  const [voiceData, setVoiceData] = useState<{
    agentAudioAmplitude: number; 
    userAudioAmplitude: number;
    status: string;
    agentTranscription?: string;
    userTranscription?: string;
  }>({
    agentAudioAmplitude: 0,
    userAudioAmplitude: 0,
    status: 'disconnected',
    agentTranscription: '',
    userTranscription: ''
  })
  // User speaking detection based on audio amplitude
  const userSpeaking = voiceData.userAudioAmplitude > 0.01 // Threshold for considering user is speaking

  // Handle voice data from the dynamic component - memoized to prevent infinite re-renders

  const handleVoiceData = useCallback((data: { 
    agentAudioAmplitude?: number; 
    userAudioAmplitude?: number;
    status?: string;
    agentTranscription?: string;
    userTranscription?: string;
    interviewEndedShowButton?: boolean;
  }) => {
    // Handle interview ended - show button instead of modal
    if (data.interviewEndedShowButton) {
      console.log('✅ Interview ended - showing navigation button')
      setShowEndButton(true)
    }

    // REMOVED: Old interviewComplete handling - now using user-controlled button only
    
    // Merge with existing data instead of overwriting
    setVoiceData(prevData => ({
      agentAudioAmplitude: data.agentAudioAmplitude !== undefined ? data.agentAudioAmplitude : prevData.agentAudioAmplitude,
      userAudioAmplitude: data.userAudioAmplitude !== undefined ? data.userAudioAmplitude : prevData.userAudioAmplitude,
      status: data.status !== undefined ? data.status : prevData.status,
      agentTranscription: data.agentTranscription !== undefined ? data.agentTranscription : prevData.agentTranscription,
      userTranscription: data.userTranscription !== undefined ? data.userTranscription : prevData.userTranscription
    }))
  }, []) // Removed interviewCompleted dependency as it's no longer used
  
  // Removed unused cleanup effect

  // Get pipeline ID based on voice gender
  const getPipelineId = (voiceGender: string) => {
    return voiceGender === 'male' 
      ? process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID_MALE!
      : process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID_FEMALE!
  }


  // Create interviewer display info based on new customization fields
  const getInterviewerInfo = () => {
    if (!session?.interview_type) {
      return { name: 'Professional Interviewer', emoji: '👔' }
    }

    const interviewTypeMap = {
      phone_screening: { name: 'Phone Screener', emoji: '📞' },
      behavioral_interview: { name: 'Behavioral Interviewer', emoji: '🧠' },
      hiring_manager: { name: 'Hiring Manager', emoji: '👔' },
      cultural_fit: { name: 'Culture Interviewer', emoji: '🤝' }
    }

    return interviewTypeMap[session.interview_type as keyof typeof interviewTypeMap] || 
           { name: 'Professional Interviewer', emoji: '👔' }
  }

  const interviewer = getInterviewerInfo()

  // Suppress VAD warnings in console
  useEffect(() => {
    const originalWarn = console.warn
    console.warn = (...args) => {
      const message = args.join(' ')
      if (message.includes('CleanUnusedInitializersAndNodeArgs') || 
          message.includes('VAD model failed to load') ||
          message.includes('onSpeechStart') ||
          message.includes('Interruption requested')) {
        return // Suppress these warnings
      }
      originalWarn.apply(console, args)
    }
    
    return () => {
      console.warn = originalWarn
    }
  }, [])

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        // Get session and access token
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          router.push('/')
          return
        }

        const accessToken = session.access_token
        
        const response = await fetch(`/api/interview/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error('Failed to load session')
        }
        
        const data = await response.json()
        setSession(data.session)
        // Set total questions from session data
        setTotalQuestions(data.session.question_count || 8)
        // TODO: Re-enable question loading when implementing question progression
        // setQuestions(data.questions)
        // setCurrentQuestionText(data.questions[0]?.question_text || '')
        setLoading(false)
      } catch (error) {
        console.error('Error loading session:', error)
        setLoading(false)
      }
    }

    if (sessionId) {
      loadSession()
    }
  }, [sessionId, router])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (!loading) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [loading])

  // Progress polling effect
  useEffect(() => {
    if (!sessionId || loading) return

    const pollProgress = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        const response = await fetch(`/api/interview/${sessionId}/progress`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          credentials: 'include'
        })
        
        if (response.ok) {
          const apiProgressData = await response.json()
          setTotalQuestions(apiProgressData.totalQuestions)
          // Update enhanced progress data
          setProgressData({
            currentMainQuestion: apiProgressData.currentMainQuestion,
            mainQuestionsAsked: apiProgressData.mainQuestionsAsked,
            mainQuestionsCompleted: apiProgressData.mainQuestionsCompleted,
            currentQuestionType: apiProgressData.currentQuestionType,
            currentFollowupCount: apiProgressData.currentFollowupCount,
            followupLetter: apiProgressData.followupLetter,
            totalQuestionsAsked: apiProgressData.totalQuestionsAsked,
            progress: apiProgressData.progress
          })
        }
      } catch (error) {
        console.error('Error fetching progress:', error)
      }
    }

    // Poll immediately and then every 5 seconds
    pollProgress()
    const interval = setInterval(pollProgress, 5000)
    
    return () => clearInterval(interval)
  }, [sessionId, loading])

  // REMOVED: Old completion detection that was conflicting with new user-controlled system
  // The interview completion is now handled by the showEndButton system only

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }


  // const handleNextQuestion = () => {
  //   if (currentQuestion < totalQuestions) {
  //     const nextQuestion = currentQuestion + 1
  //     setCurrentQuestion(nextQuestion)
  //     setCurrentQuestionText(questions[nextQuestion - 1]?.question_text || '')
  //     setTranscription('')
  //   } else {
  //     // Interview complete
  //     handleStop()
  //   }
  // }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading interview session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Session Not Found</h1>
          <p className="text-muted-foreground mb-4">The interview session could not be found.</p>
          <Button onClick={() => router.push('/setup')}>
            Start New Interview
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Confetti celebration */}
      {showConfetti && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 1200}
          height={typeof window !== 'undefined' ? window.innerHeight : 800}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}
      
      
      {/* Voice Integration - client-side only */}
      {session && (
        <VoiceIntegration 
          onVoiceData={handleVoiceData} 
          interviewSessionId={sessionId}
          pipelineId={getPipelineId(session.voice_gender)}
        />
      )}
      
      <Header currentSessionId={sessionId} />
      
      {/* Voice Status Indicator - moved below header */}
      {voiceData.status && (
        <div className="max-w-7xl mx-auto px-6 py-2">
          <div className="flex justify-end">
            <div className="flex items-center space-x-2 px-3 py-1 bg-muted/30 rounded-full">
              <div className={`w-2 h-2 rounded-full ${voiceData.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-xs text-muted-foreground">Voice: {voiceData.status}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">LIVE INTERVIEW</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Interviewer Section - Live Transcription */}
        <Card className={`mb-6 transition-all ${voiceData.agentAudioAmplitude > 0 ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{interviewer.emoji}</div>
                <div>
                  <h2 className="text-lg font-medium">{interviewer.name}</h2>
                  {/* Question type indicator */}
                  <div className="flex items-center space-x-2 mt-1">
                    {progressData.currentQuestionType === 'main_question' ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center space-x-1">
                        <span>📋</span>
                        <span>Main Question {progressData.currentMainQuestion}</span>
                      </span>
                    ) : progressData.currentQuestionType === 'follow_up' ? (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center space-x-1">
                        <span>🔍</span>
                        <span>Follow-up to Q{progressData.currentMainQuestion}</span>
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full flex items-center space-x-1">
                        <span>👋</span>
                        <span>Getting Started</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {showEndButton ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-red-500 font-medium">Interview Ended</span>
                </div>
              ) : (
                voiceData.agentAudioAmplitude > 0 && (
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-primary animate-pulse"
                          style={{
                            height: `${Math.max(8, voiceData.agentAudioAmplitude * 15)}px`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">Speaking...</span>
                  </div>
                )
              )}
            </div>
            
            <div className="min-h-24">
              <p className="text-foreground leading-relaxed">
                {voiceData.agentTranscription && voiceData.agentTranscription.trim() ? (
                  <span>{voiceData.agentTranscription}</span>
                ) : (
                  <span className="italic text-muted-foreground">[AI transcription will appear here as the interviewer speaks...]</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* User Response Section - Live Transcription */}
        <Card className={`mb-6 transition-all ${userSpeaking ? 'ring-2 ring-blue-500/20 bg-blue-500/5' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Mic className="text-primary" size={20} />
                <h3 className="font-medium">Your Microphone</h3>
              </div>
              {showEndButton ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-red-500 font-medium">Interview Ended</span>
                </div>
              ) : (
                userSpeaking && (
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-blue-500 animate-pulse"
                          style={{
                            height: `${Math.max(8, voiceData.userAudioAmplitude * 15)}px`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">Speaking...</span>
                  </div>
                )
              )}
            </div>
            
            
          </CardContent>
        </Card>

        {/* Enhanced Progress Section */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4">
              {/* Main Questions Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Main Questions: {progressData.mainQuestionsCompleted || 0} of {totalQuestions} completed</span>
                  <span className="text-sm text-muted-foreground">{progressData.progress}%</span>
                </div>
                <Progress value={progressData.progress} className="mb-2" />
              </div>
              
              {/* Timer */}
              <div className="flex justify-end items-center text-sm text-muted-foreground">
                <span className="font-medium">Total Time: {formatTime(timeElapsed)}</span>
              </div>
            </div>
            
            {/* Show end button when interview is complete */}
            {showEndButton && (
              <div className="mt-6 text-center">
                <p className="text-muted-foreground mb-4">Interview completed! You can now view your results.</p>
                <Button 
                  onClick={() => {
                    setShowConfetti(true)
                    setTimeout(() => router.push(`/results/${sessionId}`), 2000)
                  }}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-3"
                >
                  View Results 🎉
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default InterviewSession