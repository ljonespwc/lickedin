'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Calendar, ExternalLink } from "lucide-react"
import Image from 'next/image'
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
  }>
}

const Dashboard = () => {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [data, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Get session and access token
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        
        if (!session?.user) {
          router.push('/')
          return
        }

        const accessToken = session.access_token
        
        const response = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error('Failed to load dashboard')
        }
        
        const dashboardData = await response.json()
        setDashboardData(dashboardData)
        setLoading(false)
      } catch (error) {
        console.error('Error loading dashboard:', error)
        setLoading(false)
      }
    }

    loadDashboard()
  }, [router])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 14) return '1 week ago'
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
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
        {/* Welcome Message */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome back!</h1>
        </div>

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
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardData.stats.totalInterviews}
                </div>
                <div className="text-sm text-muted-foreground">Interviews completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardData.stats.averageScore > 0 ? `${dashboardData.stats.averageScore}/100` : '--'}
                </div>
                <div className="text-sm text-muted-foreground">Average score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardData.stats.bestScore > 0 ? `${dashboardData.stats.bestScore}/100` : '--'}
                </div>
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
                      <TableHead>Position</TableHead>
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
                          {interview.job_title ? `${interview.job_title} @ ${interview.company_name}` : interview.position}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            {interview.score}/100
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatTimeAgo(interview.completed_at)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
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
                <div className="mt-4 text-center">
                  <Button variant="ghost" className="text-primary hover:text-primary/90">
                    <ExternalLink size={16} className="mr-2" />
                    View All
                  </Button>
                </div>
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