'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Header } from '@/components/Header'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, MessageSquare, Lightbulb, User, Target, Brain, TrendingUp, CheckCircle, XCircle, Star } from "lucide-react"

interface ResponseAnalysis {
  response_id: string
  question_text: string
  response_text: string
  quality_score: number
  strengths: string[]
  weaknesses: string[]
  improvement_suggestions: string[]
  keyword_alignment: string[]
  missed_opportunities: string[]
}

interface InterviewResults {
  session: {
    id: string
    overall_score: number
    status: string
    completed_at: string
    interview_type: string
    communication_style: string
    difficulty_level: string
  }
  analysis_status?: string
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
    analysis: ResponseAnalysis | null
  }>
  ai_analysis: {
    response_analyses: ResponseAnalysis[]
    resume_analysis: {
      skills_mentioned: string[]
      skills_missed: string[]
      experiences_mentioned: string[]
      experiences_missed: string[]
      utilization_score: number
      missed_opportunities: string[]
    }
    job_fit_analysis: {
      requirements_covered: string[]
      requirements_missed: string[]
      keyword_matches: string[]
      fit_score: number
      gap_analysis: string[]
    }
    coaching_feedback: {
      overall_feedback: string
      strengths: string[]
      areas_for_improvement: string[]
      suggested_next_steps: string[]
      communication_score: number
      content_score: number
      confidence_score: number
    }
    preparation_analysis: {
      preparation_score: number
      business_insights: string[]
      solutions_proposed: string[]
      problem_solving_approach: string
      research_quality: string[]
      strategic_thinking: string[]
      missed_opportunities: string[]
    }
  } | null
}

const MAX_POLLING_TIME = 5 * 60 * 1000 // 5 minutes maximum polling

// Helper function to check if analysis is complete
const isAnalysisComplete = (data: InterviewResults | null): boolean => {
  if (!data) return false
  
  // Check API analysis status field first (if available)
  if (data.analysis_status === "in_progress") return false
  
  // Check if we have ai_analysis data with key components
  const hasAiAnalysis = !!(data.ai_analysis && 
                          data.ai_analysis.coaching_feedback &&
                          data.ai_analysis.resume_analysis &&
                          data.ai_analysis.job_fit_analysis)
  
  // Check for analysis-in-progress indicators in feedback
  const isInProgress = data.feedback?.overall_feedback === "ANALYSIS_IN_PROGRESS" ||
                      (data.feedback?.overall_feedback?.includes("Analysis in progress") ?? false)
  
  return hasAiAnalysis && !isInProgress
}

const Results = () => {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const [results, setResults] = useState<InterviewResults | null>(null)
  const [loading, setLoading] = useState(true)
  const hasLoadedResults = useRef(false)
  const pollingStartTime = useRef<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [session, setSession] = useState<Session | null>(null) // Cache session to avoid hanging getSession() calls

  const loadResults = useCallback(async (sessionToUse: Session) => {
    if (hasLoadedResults.current) {
      return
    }
    
    try {
      const accessToken = sessionToUse.access_token
        
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
      
      // Only mark as loaded and stop loading if analysis is complete
      if (isAnalysisComplete(data)) {
        hasLoadedResults.current = true
        setLoading(false)
        pollingStartTime.current = null // Reset polling timer
        console.log('✅ Analysis complete - showing results')
      } else {
        // Start polling timer if not already started
        if (!pollingStartTime.current) {
          pollingStartTime.current = Date.now()
        }
        
        // Check if we've exceeded maximum polling time
        const elapsedTime = Date.now() - pollingStartTime.current
        if (elapsedTime > MAX_POLLING_TIME) {
          console.warn('⚠️ Analysis polling timeout reached - showing partial results')
          hasLoadedResults.current = true
          setLoading(false)
          pollingStartTime.current = null
        } else {
          console.log(`⏳ Analysis in progress (${Math.round(elapsedTime/1000)}s elapsed) - will retry in 3 seconds`)
          // Analysis is still in progress - retry after delay
          setTimeout(() => {
            hasLoadedResults.current = false // Allow retry
            loadResults(sessionToUse)
          }, 3000) // Retry every 3 seconds
        }
      }
    } catch (error) {
      console.error('Error loading results:', error)
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
      } else {
        setSession(session) // Cache session for API calls
        loadResults(session)
      }
    }
    
    if (sessionId) {
      getUser()
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        router.push('/')
        setSession(null)
      } else {
        setSession(session) // Update cached session
        // Only load results if we haven't loaded them yet to prevent duplicate calls
        if (sessionId && !hasLoadedResults.current) {
          loadResults(session)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [sessionId, router, loadResults])


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground mb-2">
            {results ? "Analyzing your interview responses..." : "Loading results..."}
          </p>
          {results && (
            <p className="text-sm text-muted-foreground">
              This usually takes 1-2 minutes. Please wait...
            </p>
          )}
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

  // Helper function to get interview type display name
  const getInterviewTypeDisplay = (type: string) => {
    const typeMap = {
      'phone_screening': 'Phone Screening',
      'behavioral_interview': 'Behavioral Interview',
      'hiring_manager': 'Hiring Manager',
      'cultural_fit': 'Cultural Fit'
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  // Helper function to get communication style display name
  const getCommunicationStyleDisplay = (style: string) => {
    const styleMap = {
      'corporate_professional': 'Corporate Professional',
      'casual_conversational': 'Casual Conversational'
    }
    return styleMap[style as keyof typeof styleMap] || style
  }

  return (
    <div className="min-h-screen bg-background">
      <Header currentSessionId={sessionId} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Celebration Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-2xl font-semibold text-foreground">Interview Complete!</h1>
          <p className="text-muted-foreground mt-2">
            {getInterviewTypeDisplay(results.session.interview_type)} • {getCommunicationStyleDisplay(results.session.communication_style)} • Level {results.session.difficulty_level}
          </p>
        </div>

        {/* Tabbed Interface */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 size={16} />
              Overview
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <MessageSquare size={16} />
              Conversation
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex items-center gap-2">
              <User size={16} />
              Skills & Experience
            </TabsTrigger>
            <TabsTrigger value="job-fit" className="flex items-center gap-2">
              <Target size={16} />
              Job Fit
            </TabsTrigger>
            <TabsTrigger value="preparation" className="flex items-center gap-2">
              <Lightbulb size={16} />
              Preparation
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Overall Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="text-primary" size={20} />
                  <span>Overall Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold text-foreground mb-2">
                    {results.session?.overall_score ? Math.round(Number(results.session.overall_score)) : 'N/A'}/100
                  </div>
                  <div className="text-muted-foreground">Overall Score</div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Communication:</span>
                    <span className="text-sm font-semibold">
                      {results.feedback?.communication_score || results.ai_analysis?.coaching_feedback?.communication_score || 'N/A'}/100
                    </span>
                  </div>
                  <Progress 
                    value={results.feedback?.communication_score || results.ai_analysis?.coaching_feedback?.communication_score || 0} 
                    className={`h-2 ${
                      (results.feedback?.communication_score || results.ai_analysis?.coaching_feedback?.communication_score || 0) >= 80 
                        ? '[&>div]:bg-green-500' 
                        : (results.feedback?.communication_score || results.ai_analysis?.coaching_feedback?.communication_score || 0) >= 60 
                          ? '[&>div]:bg-yellow-500' 
                          : '[&>div]:bg-red-500'
                    }`} 
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Content:</span>
                    <span className="text-sm font-semibold">
                      {results.feedback?.content_score || results.ai_analysis?.coaching_feedback?.content_score || 'N/A'}/100
                    </span>
                  </div>
                  <Progress 
                    value={results.feedback?.content_score || results.ai_analysis?.coaching_feedback?.content_score || 0} 
                    className={`h-2 ${
                      (results.feedback?.content_score || results.ai_analysis?.coaching_feedback?.content_score || 0) >= 80 
                        ? '[&>div]:bg-green-500' 
                        : (results.feedback?.content_score || results.ai_analysis?.coaching_feedback?.content_score || 0) >= 60 
                          ? '[&>div]:bg-yellow-500' 
                          : '[&>div]:bg-red-500'
                    }`} 
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Confidence:</span>
                    <span className="text-sm font-semibold">
                      {results.feedback?.confidence_score || results.ai_analysis?.coaching_feedback?.confidence_score || 'N/A'}/100
                    </span>
                  </div>
                  <Progress 
                    value={results.feedback?.confidence_score || results.ai_analysis?.coaching_feedback?.confidence_score || 0} 
                    className={`h-2 ${
                      (results.feedback?.confidence_score || results.ai_analysis?.coaching_feedback?.confidence_score || 0) >= 80 
                        ? '[&>div]:bg-green-500' 
                        : (results.feedback?.confidence_score || results.ai_analysis?.coaching_feedback?.confidence_score || 0) >= 60 
                          ? '[&>div]:bg-yellow-500' 
                          : '[&>div]:bg-red-500'
                    }`} 
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Preparation:</span>
                    <span className="text-sm font-semibold">
                      {results.ai_analysis?.preparation_analysis?.preparation_score || 'N/A'}/100
                    </span>
                  </div>
                  <Progress 
                    value={results.ai_analysis?.preparation_analysis?.preparation_score || 0} 
                    className={`h-2 ${
                      (results.ai_analysis?.preparation_analysis?.preparation_score || 0) >= 80 
                        ? '[&>div]:bg-green-500' 
                        : (results.ai_analysis?.preparation_analysis?.preparation_score || 0) >= 60 
                          ? '[&>div]:bg-yellow-500' 
                          : '[&>div]:bg-red-500'
                    }`} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="text-primary" size={20} />
                  <span>Key Insights</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enhanced Feedback Section */}
                <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-primary">
                  <h4 className="font-semibold text-foreground mb-3">Performance Summary</h4>
                  <div className="text-sm leading-relaxed text-muted-foreground space-y-2">
                    {(results.feedback?.overall_feedback || results.ai_analysis?.coaching_feedback?.overall_feedback || "Analysis not yet available.").split('. ').map((sentence, index, array) => (
                      <p key={index}>
                        {sentence.trim()}{index < array.length - 1 && !sentence.endsWith('.') ? '.' : ''}
                      </p>
                    ))}
                  </div>
                </div>
                
                {/* Enhanced Strengths and Areas Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths Card */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <h4 className="font-semibold text-green-700 mb-4 flex items-center gap-2">
                      <CheckCircle size={18} />
                      What You Did Well
                    </h4>
                    <div className="space-y-3">
                      {(results.feedback?.strengths?.length > 0 ? results.feedback.strengths : [
                        "Clear communication",
                        "Good examples"
                      ]).map((strength, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-green-800 leading-relaxed">{strength}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Areas for Improvement Card */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <h4 className="font-semibold text-yellow-700 mb-4 flex items-center gap-2">
                      <TrendingUp size={18} />
                      Growth Opportunities
                    </h4>
                    <div className="space-y-3">
                      {(results.feedback?.areas_for_improvement?.length > 0 ? results.feedback.areas_for_improvement : [
                        "More specific examples",
                        "Company research"
                      ]).map((area, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-yellow-800 leading-relaxed">{area}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversation Analysis Tab */}
          <TabsContent value="conversation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="text-primary" size={20} />
                  <span>Conversation Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.responses && results.responses.length > 0 ? (
                  results.responses.map((response, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Q{response.question.question_order}: &quot;{response.question.question_text}&quot;
                        </span>
                        <span className="font-bold text-primary">
                          {response.analysis?.quality_score || 'N/A'}/100
                        </span>
                      </div>
                      
                      {response.analysis && (
                        <>
                          {response.analysis.strengths.length > 0 && (
                            <div className="flex items-start space-x-2">
                              <CheckCircle className="text-green-600 mt-0.5" size={16} />
                              <div>
                                <div className="text-sm font-medium text-green-600 mb-1">Strengths</div>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {response.analysis.strengths.map((strength, i) => (
                                    <li key={i}>• {strength}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                          
                          {response.analysis.improvement_suggestions.length > 0 && (
                            <div className="flex items-start space-x-2">
                              <Lightbulb className="text-primary mt-0.5" size={16} />
                              <div>
                                <div className="text-sm font-medium text-primary mb-1">Improvement Suggestions</div>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {response.analysis.improvement_suggestions.map((suggestion, i) => (
                                    <li key={i}>• {suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No conversation data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills & Experience Tab */}
          <TabsContent value="skills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="text-primary" size={20} />
                  <span>Resume Utilization</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.ai_analysis?.resume_analysis ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {results.ai_analysis.resume_analysis.utilization_score}/100
                      </div>
                      <div className="text-muted-foreground">Resume Utilization Score</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                          <CheckCircle size={16} />
                          Skills Mentioned
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.resume_analysis.skills_mentioned.map((skill, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm">{skill}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-yellow-600 mb-3 flex items-center gap-2">
                          <XCircle size={16} />
                          Skills Missed
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.resume_analysis.skills_missed.map((skill, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-sm">{skill}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {results.ai_analysis.resume_analysis.missed_opportunities.length > 0 && (
                      <div>
                        <h4 className="font-medium text-primary mb-3 flex items-center gap-2">
                          <Lightbulb size={16} />
                          Missed Opportunities
                        </h4>
                        <ul className="space-y-2">
                          {results.ai_analysis.resume_analysis.missed_opportunities.map((opportunity, index) => (
                            <li key={index} className="text-sm text-muted-foreground">• {opportunity}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Analysis in progress...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Fit Tab */}
          <TabsContent value="job-fit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="text-primary" size={20} />
                  <span>Job Fit Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.ai_analysis?.job_fit_analysis ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {results.ai_analysis.job_fit_analysis.fit_score}/100
                      </div>
                      <div className="text-muted-foreground">Job Fit Score</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                          <CheckCircle size={16} />
                          Requirements Covered
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.job_fit_analysis.requirements_covered.map((req, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm">{req}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-red-600 mb-3 flex items-center gap-2">
                          <XCircle size={16} />
                          Requirements Missed
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.job_fit_analysis.requirements_missed.map((req, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-sm">{req}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {results.ai_analysis.job_fit_analysis.gap_analysis.length > 0 && (
                      <div>
                        <h4 className="font-medium text-primary mb-3 flex items-center gap-2">
                          <TrendingUp size={16} />
                          Gap Analysis
                        </h4>
                        <ul className="space-y-2">
                          {results.ai_analysis.job_fit_analysis.gap_analysis.map((gap, index) => (
                            <li key={index} className="text-sm text-muted-foreground">• {gap}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Analysis in progress...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preparation & Problem-Solving Tab */}
          <TabsContent value="preparation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="text-primary" size={20} />
                  <span>Preparation & Problem-Solving</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.ai_analysis?.preparation_analysis ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {results.ai_analysis.preparation_analysis.preparation_score}/100
                      </div>
                      <div className="text-muted-foreground">Preparation Score</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-blue-600 mb-3 flex items-center gap-2">
                          <CheckCircle size={16} />
                          Business Insights
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.preparation_analysis.business_insights.map((insight, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              <span className="text-sm">{insight}</span>
                            </div>
                          ))}
                          {results.ai_analysis.preparation_analysis.business_insights.length === 0 && (
                            <p className="text-sm text-muted-foreground">No specific business insights identified</p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                          <Star size={16} />
                          Solutions Proposed
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.preparation_analysis.solutions_proposed.map((solution, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                              <span className="text-sm">{solution}</span>
                            </div>
                          ))}
                          {results.ai_analysis.preparation_analysis.solutions_proposed.length === 0 && (
                            <p className="text-sm text-muted-foreground">No specific solutions proposed</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-purple-600 mb-3 flex items-center gap-2">
                          <Brain size={16} />
                          Research Quality
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.preparation_analysis.research_quality.map((quality, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                              <span className="text-sm">{quality}</span>
                            </div>
                          ))}
                          {results.ai_analysis.preparation_analysis.research_quality.length === 0 && (
                            <p className="text-sm text-muted-foreground">Research quality analysis not available</p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-orange-600 mb-3 flex items-center gap-2">
                          <TrendingUp size={16} />
                          Strategic Thinking
                        </h4>
                        <div className="space-y-2">
                          {results.ai_analysis.preparation_analysis.strategic_thinking.map((thinking, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                              <span className="text-sm">{thinking}</span>
                            </div>
                          ))}
                          {results.ai_analysis.preparation_analysis.strategic_thinking.length === 0 && (
                            <p className="text-sm text-muted-foreground">Strategic thinking analysis not available</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-primary mb-3 flex items-center gap-2">
                        <Target size={16} />
                        Problem-Solving Approach
                      </h4>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        {results.ai_analysis.preparation_analysis.problem_solving_approach}
                      </p>
                    </div>
                    
                    {results.ai_analysis.preparation_analysis.missed_opportunities.length > 0 && (
                      <div>
                        <h4 className="font-medium text-yellow-600 mb-3 flex items-center gap-2">
                          <XCircle size={16} />
                          Missed Opportunities
                        </h4>
                        <ul className="space-y-2">
                          {results.ai_analysis.preparation_analysis.missed_opportunities.map((opportunity, index) => (
                            <li key={index} className="text-sm text-muted-foreground">• {opportunity}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Analysis in progress...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coaching Tab */}
          <TabsContent value="coaching" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="text-primary" size={20} />
                  <span>Personalized Coaching</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Star className="text-primary" size={16} />
                      Recommended Next Steps
                    </h4>
                    <ul className="space-y-2">
                      {results.feedback?.suggested_next_steps?.map((step, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm">{step}</span>
                        </li>
                      )) || [
                        <li key="1" className="flex items-start space-x-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm">Practice answering with specific examples</span>
                        </li>,
                        <li key="2" className="flex items-start space-x-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm">Research the company&apos;s values and mission</span>
                        </li>
                      ]}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <Button 
            variant="outline"
            onClick={() => router.push('/setup/customize')}
            className="flex-1 sm:flex-none"
          >
            New Interview
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