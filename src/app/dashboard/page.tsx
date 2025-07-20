'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Header } from '@/components/Header'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Calendar } from "lucide-react"
import { ProgressRing } from "@/components/ui/progress-ring"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DashboardData {
  stats: {
    totalInterviews: number
    averageScore: number
    bestScore: number
  }
  recentInterviews: Array<{
    id: string
    position: string
    score: number
    completed_at: string
    company_name: string
    job_title: string
    interview_type: string
  }>
}

const Dashboard = () => {
  const router = useRouter()
  const [data, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [session, setSession] = useState<Session | null>(null) // Cache session to avoid hanging getSession() calls

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
      } else {
        setSession(session) // Cache session for API calls
        loadDashboard(session)
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
        loadDashboard(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const loadDashboard = async (sessionToUse: Session) => {
    try {
      const accessToken = sessionToUse.access_token
        
        // Add timeout to prevent endless loading
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const response = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Dashboard API error: ${response.status} ${response.statusText}`)
        }
        
        const dashboardData = await response.json()
        setDashboardData(dashboardData)
        
      } catch (error) {
        console.error('Error loading dashboard:', error)
        // Set empty data on error so UI shows "No interviews yet"
        setDashboardData({
          stats: {
            totalInterviews: 0,
            averageScore: 0,
            bestScore: 0
          },
          recentInterviews: []
        })
      } finally {
        // Always set loading to false
        setLoading(false)
      }
    }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const getInterviewTypeDisplay = (type: string) => {
    const typeMap = {
      'phone_screening': 'Phone Screen',
      'behavioral_interview': 'Behavioral',
      'hiring_manager': 'Hiring Manager',
      'cultural_fit': 'Cultural Fit'
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100' 
    return 'text-red-600 bg-red-100'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Default data if no data available
  const defaultData: DashboardData = {
    stats: {
      totalInterviews: 0,
      averageScore: 0,
      bestScore: 0
    },
    recentInterviews: []
  }

  const dashboardData = data || defaultData

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Your Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="text-primary" size={20} />
              <span>Your Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-foreground mb-2">
                  {dashboardData.stats.totalInterviews}
                </div>
                <div className="text-sm text-muted-foreground">Interviews completed</div>
              </div>
              <div className="flex flex-col items-center">
                <ProgressRing 
                  progress={dashboardData.stats.averageScore} 
                  size={90}
                  strokeWidth={8}
                  showValue={true}
                  className="mb-2"
                />
                <div className="text-sm text-muted-foreground">Average score</div>
              </div>
              <div className="flex flex-col items-center">
                <ProgressRing 
                  progress={dashboardData.stats.bestScore} 
                  size={90}
                  strokeWidth={8}
                  showValue={true}
                  className="mb-2"
                />
                <div className="text-sm text-muted-foreground">Best performance</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Interviews */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="text-primary" size={20} />
                <span>Recent Interviews</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.recentInterviews.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Role/Position</TableHead>
                      <TableHead>Interview Type</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.recentInterviews.map((interview) => (
                      <TableRow 
                        key={interview.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/results/${interview.id}`)}
                      >
                        <TableCell className="font-medium">
                          {interview.company_name || 'Company'}
                        </TableCell>
                        <TableCell>
                          {interview.job_title || interview.position}
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                            {getInterviewTypeDisplay(interview.interview_type)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getScoreColor(interview.score)}`}>
                            {interview.score}/100
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(interview.completed_at)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="default"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/results/${interview.id}`)
                            }}
                          >
                            View Results
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-foreground mb-2">No interviews yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start your first interview to see your progress here.
                </p>
                <Button onClick={() => router.push('/setup')}>
                  Start Your First Interview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Start New Interview CTA */}
        <div className="text-center">
          <Button 
            size="lg"
            onClick={() => router.push('/setup')}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3"
          >
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard