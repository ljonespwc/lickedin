'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import type { User } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Image from 'next/image'
import { Play } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    }
    
    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Check your email for the magic link!')
        setEmail('')
      }
    } catch {
      setMessage('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }


  const handleStartInterview = () => {
    router.push('/setup')
  }

  if (user) {
    // Authenticated - show main landing page
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <div className="max-w-4xl mx-auto px-6 py-16">
          <Card className="text-center">
            <CardContent className="p-12">
              <div className="text-6xl mb-8">🎯</div>
              
              <h1 className="text-4xl font-bold mb-4 text-foreground">
                Practice Interviews That Don&apos;t Suck
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                AI-powered mock interviews with real-time voice conversations. 
                Upload your resume, customize the difficulty, and practice with engaging personas.
              </p>
              
              <Button 
                size="lg" 
                onClick={handleStartInterview}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg mb-12"
              >
                <Play className="mr-2" size={20} />
                Start Your Interview Prep
              </Button>
              
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">📄 Upload & Analyze</h3>
                  <p className="text-sm text-muted-foreground">
                    Drop in your resume and job description for personalized questions
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">🎭 Choose Your Interviewer</h3>
                  <p className="text-sm text-muted-foreground">
                    From Michael Scott to Tech Leads - pick your practice partner
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">🗣️ Practice Speaking</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time voice conversations with instant feedback
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Unauthenticated - show auth form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image 
                src="/lickedin-logo.png" 
                alt="LickedIn Logo" 
                width={124} 
                height={60} 
                className="h-15"
              />
            </div>
            <p className="text-muted-foreground">
              AI-Powered Mock Interview Platform
            </p>
          </div>
          
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </form>
          
          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes('Error') 
                ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
