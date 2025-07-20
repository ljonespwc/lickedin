'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, TrendingUp } from "lucide-react"
import type { Session } from '@supabase/supabase-js'

interface LatestInterview {
  id: string
  company_name: string | null
  job_title: string | null
  interview_type: string
  overall_score: number | null
  completed_at: string
}

const ResultsPage = () => {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [session, setSession] = useState<Session | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [latestInterview, setLatestInterview] = useState<LatestInterview | null>(null)
  const [loading, setLoading] = useState(true)

  const loadLatestInterview = useCallback(async (sessionToUse: Session) => {
    try {
      const response = await fetch('/api/latest-interview', {
        headers: {
          'Authorization': `Bearer ${sessionToUse.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.sessionId) {
          // Redirect to specific results page if we have an interview
          // Don't set loading to false - we're redirecting
          router.push(`/results/${data.sessionId}`)
          return
        }
      }
      
      // No interviews found - stay on this page
      setLatestInterview(null)
      setLoading(false)
    } catch (error) {
      console.error('Error loading latest interview:', error)
      setLatestInterview(null)
      setLoading(false)
    }
  }, [router, setLatestInterview])

  useEffect(() => {
    let mounted = true
    
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (!session?.user) {
          router.push('/')
        } else {
          setSession(session)
          await loadLatestInterview(session)
        }
      } catch (error) {
        console.error('Auth error on results page:', error)
        if (mounted) {
          router.push('/')
        }
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      
      if (!session?.user) {
        router.push('/')
        setSession(null)
      } else {
        setSession(session)
        await loadLatestInterview(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, loadLatestInterview])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* No Interviews Yet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="text-primary" size={20} />
              <span>Interview Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-6xl mb-6">📊</div>
              <h3 className="text-2xl font-medium text-foreground mb-4">No interview results yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Complete your first interview to see detailed feedback, scores, and personalized recommendations for improvement.
              </p>
              <div className="space-y-4">
                <Button 
                  size="lg"
                  onClick={() => router.push('/setup')}
                  className="bg-primary hover:bg-primary/90 text-white px-8"
                >
                  <TrendingUp className="mr-2" size={18} />
                  Start Your First Interview
                </Button>
                <div>
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ResultsPage