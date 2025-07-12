'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { User, Flame, ArrowLeft, Briefcase } from "lucide-react"
import Image from 'next/image'

const SetupCustomize = () => {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [difficulty, setDifficulty] = useState<number[]>([1])
  const [interviewType, setInterviewType] = useState('')
  const [interviewer, setInterviewer] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      
      if (!session?.user) {
        router.push('/')
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
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

  // TODO: Backend integration needed:
  // 1. Update /api/interview/create to accept interviewType parameter
  // 2. Modify question generation logic to consider interview type
  // 3. Update database schema to store interview type in interview_sessions table
  // 4. Adjust AI prompts based on interview type (e.g., technical questions for technical_screen)
  
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
      id: "panel_interview",
      name: "Panel Interview", 
      emoji: "👥",
      description: "Multiple interviewers"
    },
    {
      id: "cultural_fit",
      name: "Cultural Fit",
      emoji: "🤝",
      description: "Team & values focus"
    },
    {
      id: "executive_round",
      name: "Executive Round",
      emoji: "🎯", 
      description: "Senior leadership"
    }
  ]



  const interviewers = [
    { 
      id: "michael_scott", 
      name: "Michael Scott", 
      emoji: "😎", 
      description: "Fun but professional"
    },
    { 
      id: "professional", 
      name: "Generic Pro", 
      emoji: "👔", 
      description: "Standard corporate"
    },
    { 
      id: "friendly_mentor", 
      name: "Friendly Mentor", 
      emoji: "😊", 
      description: "Supportive guidance"
    },
    { 
      id: "tech_lead", 
      name: "Tech Lead", 
      emoji: "💻", 
      description: "Technical focus"
    }
  ]

  const handleStartInterview = async () => {
    const difficultyValue = getDifficultyFromSlider(difficulty[0])
    if (!difficultyValue || !interviewType || !interviewer) return

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
          interviewType: interviewType, // TODO: Backend needs to handle interview type in question generation
          persona: interviewer,
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
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

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
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

        {/* Choose Interviewer */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <User className="text-primary" size={20} />
              <h3 className="font-medium text-lg">Choose Your Interviewer</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {interviewers.map((person) => (
                <Card 
                  key={person.id}
                  className={`cursor-pointer transition-colors ${
                    interviewer === person.id 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setInterviewer(person.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl mb-2">{person.emoji}</div>
                    <h4 className="font-medium mb-1">{person.name}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{person.description}</p>
                    <Button 
                      variant={interviewer === person.id ? "default" : "outline"} 
                      size="sm" 
                      className="text-xs"
                    >
                      {interviewer === person.id ? 'Selected' : 'Select'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
            disabled={!difficulty[0] || difficulty[0] < 1 || !interviewType || !interviewer || isCreating}
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