'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { User, Flame, ArrowLeft, Briefcase } from "lucide-react"

const SetupCustomize = () => {
  const router = useRouter()
  const [difficulty, setDifficulty] = useState<number[]>([1])
  const [interviewType, setInterviewType] = useState('')
  const [voiceGender, setVoiceGender] = useState('')
  const [communicationStyle, setCommunicationStyle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null)
  // Enhanced progress tracking
  const [progressStep, setProgressStep] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(8)

  // Progress steps configuration
  const progressSteps = [
    { 
      id: 0, 
      title: "Analyzing your background...", 
      description: "Loading resume and job requirements",
      duration: 2000, // 2 seconds
      emoji: "📋"
    },
    { 
      id: 1, 
      title: "Generating personalized questions...", 
      description: "Creating questions tailored to your experience",
      duration: 6000, // 6 seconds
      emoji: "🤖"
    },
    { 
      id: 2, 
      title: "Launching interview...", 
      description: "Setting up your interview session",
      duration: 1000, // 1 second
      emoji: "🚀"
    }
  ]

  // Progress simulation
  const simulateProgress = () => {
    let currentStep = 0
    let elapsedTime = 0
    const totalTime = progressSteps.reduce((sum, step) => sum + step.duration, 0)
    
    const updateProgress = () => {
      const currentStepData = progressSteps[currentStep]
      if (!currentStepData) return
      
      // Update step
      setProgressStep(currentStep)
      
      // Calculate overall progress
      const overallProgress = Math.min(100, (elapsedTime / totalTime) * 100)
      setProgressPercent(overallProgress)
      
      // Calculate time remaining
      const timeRemaining = Math.max(0, Math.ceil((totalTime - elapsedTime) / 1000))
      setEstimatedTimeRemaining(timeRemaining)
      
      elapsedTime += 200 // Update every 200ms
      
      // Move to next step if current step is complete
      if (elapsedTime >= progressSteps.slice(0, currentStep + 1).reduce((sum, step) => sum + step.duration, 0)) {
        currentStep++
      }
      
      // Continue simulation if not complete
      if (currentStep < progressSteps.length && elapsedTime < totalTime) {
        setTimeout(updateProgress, 200)
      }
    }
    
    updateProgress()
  }

  // Check authentication and cache session
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
      } else {
        setSession(session) // Cache session for button handler
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        router.push('/')
        setSession(null)
      } else {
        setSession(session) // Update cached session
      }
    })

    return () => subscription.unsubscribe()
  }, [router])


  // Map slider value (1-10) to difficulty string
  const getDifficultyFromSlider = (value: number): string => {
    if (value <= 2) return "softball"        // 1-2: Softball
    if (value <= 5) return "medium"          // 3-5: Medium  
    if (value <= 8) return "hard"            // 6-8: Hard
    return "hard_as_fck"                     // 9-10: Hard as F*ck
  }

  
  const interviewTypes = [
    {
      id: "phone_screening",
      name: "Phone Screening",
      emoji: "📞",
      description: "Initial recruiter call"
    },
    {
      id: "behavioral_interview", 
      name: "Behavioral Interview",
      emoji: "🧠",
      description: "Past experiences & problem-solving"
    },
    {
      id: "hiring_manager",
      name: "Hiring Manager",
      emoji: "👔", 
      description: "Role-specific discussion"
    },
    {
      id: "cultural_fit",
      name: "Cultural Fit",
      emoji: "🤝",
      description: "Team & values focus"
    }
  ]



  const communicationStyles = [
    {
      id: "corporate_professional",
      name: "Corporate Professional", 
      emoji: "💼",
      description: "Formal, traditional business style"
    },
    {
      id: "casual_conversational",
      name: "Casual Conversational",
      emoji: "💬", 
      description: "Relaxed, natural discussion flow"
    }
  ]

  const handleStartInterview = async () => {
    const difficultyValue = getDifficultyFromSlider(difficulty[0])
    if (!difficultyValue || !interviewType || !voiceGender || !communicationStyle) return

    let validSession = session
    
    // Check if cached session is valid and complete
    if (!session?.user?.id || !session?.access_token) {
      // Get fresh session if cached one is invalid
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      if (!freshSession?.user) {
        router.push('/')
        return
      }
      validSession = freshSession
    }

    // At this point validSession is guaranteed to be valid
    if (!validSession?.access_token) {
      router.push('/')
      return
    }

    const accessToken = validSession.access_token
    setIsCreating(true)
    
    // Reset and start progress simulation
    setProgressStep(0)
    setProgressPercent(0)
    setEstimatedTimeRemaining(9)
    simulateProgress()

    try {
      // Create interview session
      const response = await fetch('/api/interview/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          difficulty: difficultyValue,
          interviewType: interviewType,
          voiceGender: voiceGender,
          communicationStyle: communicationStyle
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to create interview session')
      }

      const { sessionId } = await response.json()
      router.push(`/interview/${sessionId}`)

    } catch (error) {
      console.error('Error creating interview session:', error)
      setIsCreating(false)
      // TODO: Show error message to user
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Setup Your Interview</h1>
          <p className="text-muted-foreground">Step 2 of 2: Customize</p>
        </div>

        {/* Interview Difficulty */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Flame className="text-orange-500" size={20} />
              <h3 className="font-medium text-lg">Interview Difficulty</h3>
            </div>
            
            <div className="space-y-6">
              
              {/* Slider with anchor labels */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-medium mb-2">
                  <div className="flex items-center space-x-1">
                    <span>🥎</span>
                    <span>Softball</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>🔥</span>
                    <span>Good luck!</span>
                  </div>
                </div>
                
                <Slider
                  value={difficulty}
                  onValueChange={setDifficulty}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                
                {/* Current difficulty level indicator */}
                <div className="text-center mt-3">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-primary/10 rounded-full">
                    <span className="text-sm font-medium text-primary">Level {difficulty[0]}</span>
                    <span className="text-xs text-muted-foreground">of 10</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interview Type */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Briefcase className="text-blue-500" size={20} />
              <h3 className="font-medium text-lg">Interview Type</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {interviewTypes.map((type) => (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-colors ${
                    interviewType === type.id 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setInterviewType(type.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-2">{type.emoji}</div>
                    <h4 className="font-medium mb-1 text-sm">{type.name}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{type.description}</p>
                    <Button 
                      variant={interviewType === type.id ? "default" : "outline"} 
                      size="sm" 
                      className="text-xs w-full"
                    >
                      {interviewType === type.id ? 'Selected' : 'Select'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Interviewer Voice & Style */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <User className="text-primary" size={20} />
              <h3 className="font-medium text-lg">Interviewer Voice & Style</h3>
            </div>
            
            {/* Interviewer Voice Selection */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-3">Interviewer Voice</h4>
              <RadioGroup 
                value={voiceGender} 
                onValueChange={setVoiceGender}
                className="flex space-x-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="flex items-center space-x-2 cursor-pointer">
                    <span>🎤</span>
                    <span>Male</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="flex items-center space-x-2 cursor-pointer">
                    <span>🎵</span>
                    <span>Female</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Communication Style Selection */}
            <div>
              <h4 className="font-medium mb-3">Communication Style</h4>
              <div className="grid grid-cols-2 gap-4">
                {communicationStyles.map((style) => (
                  <Card 
                    key={style.id}
                    className={`cursor-pointer transition-colors ${
                      communicationStyle === style.id 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setCommunicationStyle(style.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl mb-2">{style.emoji}</div>
                      <h5 className="font-medium mb-1 text-sm">{style.name}</h5>
                      <p className="text-xs text-muted-foreground mb-3">{style.description}</p>
                      <Button 
                        variant={communicationStyle === style.id ? "default" : "outline"} 
                        size="sm" 
                        className="text-xs w-full"
                      >
                        {communicationStyle === style.id ? 'Selected' : 'Select'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Start Interview Button */}
        <div className="flex justify-between items-center">
          <Button 
            variant="outline"
            onClick={() => router.push('/setup')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft size={16} />
            <span>Back to Step 1</span>
          </Button>
          
          <Button 
            size="lg" 
            disabled={!difficulty[0] || difficulty[0] < 1 || !interviewType || !voiceGender || !communicationStyle || isCreating}
            className="px-8 bg-primary hover:bg-primary/90"
            onClick={handleStartInterview}
          >
            {isCreating ? 'Creating Interview...' : 'Start Interview →'}
          </Button>
        </div>
      </div>

      {/* Enhanced Loading Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {/* Header */}
                <div>
                  <h2 className="text-xl font-semibold mb-2">Creating Your Interview</h2>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we prepare your personalized interview
                  </p>
                </div>

                {/* Current Step Indicator */}
                <div className="space-y-3">
                  <div className="flex items-center justify-center space-x-3">
                    <span className="text-2xl">{progressSteps[progressStep]?.emoji}</span>
                    <div className="text-left">
                      <div className="font-medium text-sm">{progressSteps[progressStep]?.title}</div>
                      <div className="text-xs text-muted-foreground">{progressSteps[progressStep]?.description}</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{Math.round(progressPercent)}% complete</span>
                    <span>{estimatedTimeRemaining}s remaining</span>
                  </div>
                  <Progress value={progressPercent} className="w-full" />
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SetupCustomize