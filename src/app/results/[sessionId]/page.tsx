'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { User, BarChart3, MessageSquare, Award, AlertTriangle, Lightbulb } from "lucide-react"

interface InterviewResults {
  session: {
    id: string
    overall_score: number
    status: string
    completed_at: string
  }
  feedback: {
    overall_feedback: string
    strengths: string[]
    areas_for_improvement: string[]
    suggested_next_steps: string[]
    confidence_score: number
    communication_score: number
    content_score: number
  }
  responses: Array<{
    question: {
      question_text: string
      question_order: number
    }
    score: number
    feedback: string
  }>
}

const Results = () => {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const [results, setResults] = useState<InterviewResults | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadResults = async () => {
      try {
        // Get session and access token
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          router.push('/')
          return
        }

        const accessToken = session.access_token
        
        const response = await fetch(`/api/results/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error('Failed to load results')
        }
        
        const data = await response.json()
        setResults(data)
        setLoading(false)
      } catch (error) {
        console.error('Error loading results:', error)
        setLoading(false)
      }
    }

    if (sessionId) {
      loadResults()
    }
  }, [sessionId, router])

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

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Results Not Found</h1>
          <p className="text-muted-foreground mb-4">The interview results could not be found.</p>
          <Button onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-primary">LickedIn Interviews</h2>
            <span className="text-lg font-medium text-foreground">Interview Results</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <User size={20} />
            <span>[Profile▼]</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Celebration Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-2xl font-semibold text-foreground">Interview Complete!</h1>
        </div>

        {/* Overall Performance */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="text-primary" size={20} />
              <span>Overall Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-foreground mb-2">
                {results.session.overall_score || 78}/100
              </div>
              <div className="text-muted-foreground">Score</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Communication:</span>
                <span className="text-sm font-semibold">
                  {results.feedback?.communication_score || 82}/100
                </span>
              </div>
              <Progress value={results.feedback?.communication_score || 82} className="h-2" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Content:</span>
                <span className="text-sm font-semibold">
                  {results.feedback?.content_score || 74}/100
                </span>
              </div>
              <Progress value={results.feedback?.content_score || 74} className="h-2" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence:</span>
                <span className="text-sm font-semibold">
                  {results.feedback?.confidence_score || 80}/100
                </span>
              </div>
              <Progress value={results.feedback?.confidence_score || 80} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Question-by-Question Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="text-primary" size={20} />
              <span>Question-by-Question Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.responses && results.responses.length > 0 ? (
              results.responses.map((response, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Q{response.question.question_order}: &quot;{response.question.question_text}&quot;
                    </span>
                    <span className="font-bold text-primary">
                      {response.score || 75}/100
                    </span>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    {(response.score || 75) >= 80 ? (
                      <Award className="text-green-600 mt-0.5" size={16} />
                    ) : (
                      <AlertTriangle className="text-yellow-500 mt-0.5" size={16} />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {response.feedback || "Good structure and clear examples"}
                    </span>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Lightbulb className="text-primary mt-0.5" size={16} />
                    <span className="text-sm text-muted-foreground">
                      Try to mention specific metrics next time
                    </span>
                  </div>
                </div>
              ))
            ) : (
              // Placeholder data if no responses available
              [
                {
                  id: "Q1",
                  text: "Tell me about yourself",
                  score: 85,
                  feedback: "Good structure and clear examples",
                  tip: "Try to mention specific metrics next time",
                  status: "good"
                },
                {
                  id: "Q2", 
                  text: "Why do you want this role?",
                  score: 72,
                  feedback: "Answer was too generic",
                  tip: "Research the company's recent projects",
                  status: "warning"
                }
              ].map((question) => (
                <div key={question.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{question.id}: &quot;{question.text}&quot;</span>
                    <span className="font-bold text-primary">{question.score}/100</span>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    {question.status === "good" ? (
                      <Award className="text-green-600 mt-0.5" size={16} />
                    ) : (
                      <AlertTriangle className="text-yellow-500 mt-0.5" size={16} />
                    )}
                    <span className="text-sm text-muted-foreground">{question.feedback}</span>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Lightbulb className="text-primary mt-0.5" size={16} />
                    <span className="text-sm text-muted-foreground">{question.tip}</span>
                  </div>
                </div>
              ))
            )}
            
            <div className="text-center pt-2">
              <Button variant="ghost" className="text-primary hover:text-primary/90">
                View All Questions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🚀</span>
              <span>Recommended Next Steps</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {results.feedback?.suggested_next_steps && results.feedback.suggested_next_steps.length > 0 ? (
                results.feedback.suggested_next_steps.map((step, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))
              ) : (
                // Default suggestions
                [
                  "Practice answering with specific examples",
                  "Research the company's values and mission",
                  "Try a &quot;Hard&quot; difficulty interview next"
                ].map((step, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Button 
            variant="outline"
            onClick={() => router.push('/setup/customize')}
            className="flex-1 sm:flex-none"
          >
            New Interview
          </Button>
          <Button 
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            Share Results
          </Button>
          <Button 
            onClick={() => router.push('/dashboard')}
            className="bg-primary hover:bg-primary/90 text-white flex-1 sm:flex-none"
          >
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Results