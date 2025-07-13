'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Mic, Settings } from "lucide-react"
import Image from 'next/image'
import type { User as SupabaseUser } from '@supabase/supabase-js'
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
  
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [timeElapsed, setTimeElapsed] = useState(0)
  // const [transcription] = useState('') // TODO: Implement live transcription
  const [session, setSession] = useState<InterviewSession | null>(null)
  // const [questions] = useState<Question[]>([]) // TODO: Load and use questions
  // const [currentQuestionText, setCurrentQuestionText] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  
  // Interview completion state
  const [showConfetti, setShowConfetti] = useState(false)
  const [interviewCompleted, setInterviewCompleted] = useState(false)
  const prevStatusRef = useRef<string>('disconnected')

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
    interviewComplete?: boolean;
  }) => {
    // Handle interview completion immediately
    if (data.interviewComplete && !interviewCompleted) {
      console.log('🎉 Interview completion triggered by custom event')
      setInterviewCompleted(true)
      setShowConfetti(true)
    }
    
    // Merge with existing data instead of overwriting
    setVoiceData(prevData => ({
      agentAudioAmplitude: data.agentAudioAmplitude !== undefined ? data.agentAudioAmplitude : prevData.agentAudioAmplitude,
      userAudioAmplitude: data.userAudioAmplitude !== undefined ? data.userAudioAmplitude : prevData.userAudioAmplitude,
      status: data.status !== undefined ? data.status : prevData.status,
      agentTranscription: data.agentTranscription !== undefined ? data.agentTranscription : prevData.agentTranscription,
      userTranscription: data.userTranscription !== undefined ? data.userTranscription : prevData.userTranscription
    }))
  }, [interviewCompleted])

  // Create interviewer display info based on new customization fields
  const getInterviewerInfo = () => {
    if (!session?.interview_type) {
      return { name: 'Professional Interviewer', emoji: '👔' }
    }

    const interviewTypeMap = {
      phone_screening: { name: 'Phone Screener', emoji: '📞' },
      technical_screen: { name: 'Technical Interviewer', emoji: '💻' },
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
        setUser(session?.user ?? null)
        
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
        // TODO: Re-enable question loading when implementing question progression
        // setQuestions(data.questions)
        // setTotalQuestions(data.questions.length)
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
          const progressData = await response.json()
          setCurrentQuestion(progressData.currentQuestion)
          setTotalQuestions(progressData.totalQuestions)
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

  // Interview completion detection effect
  useEffect(() => {
    const prevStatus = prevStatusRef.current
    const currentStatus = voiceData.status

    // Detect voice session end: connected -> disconnected (and not initial load)
    if (prevStatus === 'connected' && currentStatus === 'disconnected' && !interviewCompleted) {
      console.log('🎉 Interview completed - voice session ended')
      setInterviewCompleted(true)
      setShowConfetti(true)
      
      // Auto-navigate to results after 4 seconds
      setTimeout(() => {
        router.push(`/results/${sessionId}`)
      }, 4000)
    }

    // Update previous status reference
    prevStatusRef.current = currentStatus
  }, [voiceData.status, interviewCompleted, router, sessionId])

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
      
      {/* Interview completion overlay */}
      {interviewCompleted && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 text-center max-w-md mx-4">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete!</h2>
            <p className="text-gray-600 mb-6">
              Great job! You&apos;ve successfully completed your interview.
            </p>
            <Button 
              onClick={() => router.push(`/results/${sessionId}`)}
              className="mt-4"
            >
              View Results Now
            </Button>
          </div>
        </div>
      )}
      
      {/* Voice Integration - client-side only */}
      <VoiceIntegration onVoiceData={handleVoiceData} interviewSessionId={sessionId} />
      
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Image 
              src="/lickedin-logo.png" 
              alt="LickedIn Logo" 
              width={83} 
              height={40} 
              className="h-10"
            />
          </div>
          <div className="flex items-center space-x-4">
            {/* Voice Status Indicator */}
            {voiceData.status && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-muted/30 rounded-full">
                <div className={`w-2 h-2 rounded-full ${voiceData.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                <span className="text-xs text-muted-foreground">Voice: {voiceData.status}</span>
              </div>
            )}
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-center">
            {currentQuestion === 1 && (
              <Button
                variant="outline"
                onClick={() => router.push('/setup/customize')}
                className="flex items-center space-x-2"
              >
                <Settings size={16} />
                <span>Change Settings</span>
              </Button>
            )}
            {!(currentQuestion === 1) && <div></div>}
            
            <h1 className="text-2xl font-semibold">LIVE INTERVIEW</h1>
            <div></div>
          </div>
        </div>

        {/* Interviewer Section - Live Transcription */}
        <Card className={`mb-6 transition-all ${voiceData.agentAudioAmplitude > 0 ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{interviewer.emoji}</div>
                <h2 className="text-lg font-medium">{interviewer.name}</h2>
              </div>
              {voiceData.agentAudioAmplitude > 0 && (
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
                <h3 className="font-medium">Your Response</h3>
              </div>
              {userSpeaking && (
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
              )}
            </div>
            
            <div className="min-h-24 p-4 bg-muted/30 rounded-lg border text-muted-foreground text-sm mb-4">
              {voiceData.userTranscription ? (
                <span className="text-foreground">{voiceData.userTranscription}</span>
              ) : (
                <span className="italic">[Your voice transcription will appear here as you speak...]</span>
              )}
            </div>
            
          </CardContent>
        </Card>

        {/* Progress Section */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progress: Question {currentQuestion} of {totalQuestions}</span>
                  <span className="text-sm text-muted-foreground">{Math.round((currentQuestion / totalQuestions) * 100)}%</span>
                </div>
                <Progress value={(currentQuestion / totalQuestions) * 100} className="mb-2" />
              </div>
              
              <div className="text-right">
                <span className="text-sm font-medium">Time: {formatTime(timeElapsed)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default InterviewSession