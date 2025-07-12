'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { User, Flame, ArrowLeft } from "lucide-react"
import Image from 'next/image'

const SetupCustomize = () => {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [difficulty, setDifficulty] = useState<number[]>([0])
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


  // Map slider value to difficulty string
  const getDifficultyFromSlider = (value: number): string => {
    if (value <= 25) return "softball"
    if (value <= 50) return "medium"
    if (value <= 75) return "hard"
    return "hard_as_fck"
  }



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
    if (!difficultyValue || !interviewer) return

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
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
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
            disabled={difficulty[0] === undefined || !interviewer || isCreating}
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