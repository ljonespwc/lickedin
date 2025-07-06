import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
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
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: { [key: string]: unknown }) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get interview sessions for stats
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select(`
        id,
        overall_score,
        completed_at,
        status,
        job_descriptions (
          company_name,
          job_title
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (sessionsError) {
      console.error('Sessions fetch error:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to load dashboard data' },
        { status: 500 }
      )
    }

    const completedSessions = sessions || []

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

    // Format recent interviews
    const recentInterviews = completedSessions.slice(0, 10).map(session => {
      const jobDesc = Array.isArray(session.job_descriptions) 
        ? session.job_descriptions[0] 
        : session.job_descriptions;
      
      return {
        id: session.id,
        position: jobDesc 
          ? `${jobDesc.job_title} @ ${jobDesc.company_name}`
          : 'Interview Session',
        score: session.overall_score || 0,
        completed_at: session.completed_at,
        company_name: jobDesc?.company_name || 'Company',
        job_title: jobDesc?.job_title || 'Position'
      };
    })

    return NextResponse.json({
      stats: {
        totalInterviews,
        averageScore,
        bestScore
      },
      recentInterviews
    })

  } catch (error) {
    console.error('Dashboard fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}