'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Mic, Square, Pause, Play } from "lucide-react"

interface InterviewSession {
  id: string
  persona: string
  difficulty_level: string
  question_count: number
  status: string
}

interface Question {
  id: string
  question_text: string
  question_order: number
  question_type: string
}

const InterviewSession = () => {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [transcription, setTranscription] = useState('')
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionText, setCurrentQuestionText] = useState('')
  const [loading, setLoading] = useState(true)

  const interviewer = {
    name: session?.persona === 'michael_scott' ? 'Michael Scott' : 
          session?.persona === 'tech_lead' ? 'Tech Lead' :
          session?.persona === 'friendly_mentor' ? 'Friendly Mentor' : 'Professional Interviewer',
    emoji: session?.persona === 'michael_scott' ? '😎' : 
           session?.persona === 'tech_lead' ? '💻' :
           session?.persona === 'friendly_mentor' ? '😊' : '👔'
  }

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
        setQuestions(data.questions)
        setTotalQuestions(data.questions.length)
        setCurrentQuestionText(data.questions[0]?.question_text || '')
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
    if (!isPaused && !loading) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPaused, loading])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false)
      // TODO: Stop voice recording and process response
    } else {
      setIsRecording(true)
      setIsPaused(false)
      // TODO: Start voice recording
    }
  }

  const handlePause = () => {
    setIsPaused(!isPaused)
    // TODO: Pause/resume interview session
  }

  const handleStop = () => {
    setIsRecording(false)
    setIsPaused(false)
    // TODO: End interview and navigate to results
    router.push(`/results/${sessionId}`)
  }

  const handleNextQuestion = () => {
    if (currentQuestion < totalQuestions) {
      const nextQuestion = currentQuestion + 1
      setCurrentQuestion(nextQuestion)
      setCurrentQuestionText(questions[nextQuestion - 1]?.question_text || '')
      setTranscription('')
      setIsRecording(false)
    } else {
      // Interview complete
      handleStop()
    }
  }

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
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2">LIVE INTERVIEW</h1>
        </div>

        {/* Interviewer Section */}
        <Card className="mb-6">
          <CardContent className="p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="text-2xl">{interviewer.emoji}</div>
              <h2 className="text-lg font-medium">{interviewer.name}</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-foreground leading-relaxed">
                &quot;{currentQuestionText}&quot;
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Speaking...</span>
            </div>
          </CardContent>
        </Card>

        {/* User Response Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Mic className="text-primary" size={20} />
              <h3 className="font-medium">Your Response</h3>
            </div>
            
            <div className="min-h-24 p-4 bg-muted/30 rounded-lg border text-muted-foreground text-sm mb-4">
              {transcription || "[Transcription appears here as you speak...]"}
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                onClick={handleRecordToggle}
                className="flex items-center space-x-2"
              >
                {isRecording ? (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    <span>Record</span>
                  </>
                )}
              </Button>
              
              {isRecording && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePause}
                    className="flex items-center space-x-2"
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleNextQuestion}
                    className="flex items-center space-x-2"
                  >
                    <span>Next Question</span>
                  </Button>
                </>
              )}
              
              <Button
                variant="outline"
                onClick={handleStop}
                className="flex items-center space-x-2"
              >
                <Square size={16} />
                <span>End Interview</span>
              </Button>
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