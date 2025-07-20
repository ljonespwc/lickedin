import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Dashboard API called')
    
    // Get authentication token
    const authHeader = request.headers.get('authorization')
    let accessToken: string | null = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    console.log('🔐 Auth token present:', !!accessToken)

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: { [key: string]: unknown }) {
            cookieStore.set({ 
              name, 
              value, 
              ...options,
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/'
            })
          },
          remove(name: string, options: { [key: string]: unknown }) {
            cookieStore.set({ 
              name, 
              value: '', 
              ...options,
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/'
            })
          },
        },
        // Set the access token if we have one
        global: {
          headers: accessToken ? {
            Authorization: `Bearer ${accessToken}`
          } : {}
        }
      }
    )

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken || undefined)
    
    if (authError || !user) {
      console.log('❌ Authentication failed:', authError?.message)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('✅ User authenticated:', user.email)

    // Get interview sessions for stats
    console.log('🔍 Fetching interview sessions for user:', user.id)
    
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select(`
        id,
        overall_score,
        completed_at,
        status,
        interview_type,
        job_descriptions (
          job_content,
          company_name,
          job_title
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (sessionsError) {
      console.error('❌ Sessions fetch error:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to load dashboard data' },
        { status: 500 }
      )
    }

    const completedSessions = sessions || []
    console.log('📈 Found completed sessions:', completedSessions.length)

    // Calculate stats
    const totalInterviews = completedSessions.length
    const scores = completedSessions
      .map(s => s.overall_score)
      .filter(score => score !== null) as number[]
    
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0
    
    const bestScore = scores.length > 0 
      ? Math.max(...scores)
      : 0

    // Format recent interviews using structured data
    const recentInterviews = completedSessions.slice(0, 10).map(session => {
      const jobDesc = Array.isArray(session.job_descriptions) 
        ? session.job_descriptions[0] 
        : session.job_descriptions;
      
      // Use structured fields with fallbacks
      const companyName = jobDesc?.company_name || 'Company';
      const jobTitle = jobDesc?.job_title || 'Position';
      
      return {
        id: session.id,
        position: `${jobTitle} @ ${companyName}`,
        score: session.overall_score || 0,
        completed_at: session.completed_at,
        company_name: companyName,
        job_title: jobTitle,
        interview_type: session.interview_type || 'behavioral_interview'
      };
    })

    const result = {
      stats: {
        totalInterviews,
        averageScore,
        bestScore
      },
      recentInterviews
    }

    console.log('📊 Dashboard response:', {
      totalInterviews,
      averageScore,
      bestScore,
      recentInterviewsCount: recentInterviews.length
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Dashboard fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}