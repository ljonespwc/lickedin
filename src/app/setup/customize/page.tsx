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
import { User, Flame, ArrowLeft, Briefcase } from "lucide-react"

const SetupCustomize = () => {
  const router = useRouter()
  const [difficulty, setDifficulty] = useState<number[]>([1])
  const [interviewType, setInterviewType] = useState('')
  const [voiceGender, setVoiceGender] = useState('')
  const [communicationStyle, setCommunicationStyle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        router.push('/')
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
      id: "technical_screen", 
      name: "Technical Screen",
      emoji: "💻",
      description: "Coding & technical skills"
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

    // Get session and access token
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      router.push('/')
      return
    }

    const accessToken = session.access_token
    setIsCreating(true)

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
          communicationStyle: communicationStyle,
          questionCount: 5
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
          <h1 className="text-2xl font-semibold text-foreground mb-2">Customize Your Interview</h1>
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
            <span>Back to Setup</span>
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
    </div>
  )
}

export default SetupCustomize