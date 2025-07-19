import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get authentication token
    const authHeader = request.headers.get('authorization')
    let accessToken: string | null = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Step 1: Get user's completed interview sessions
    const { data: userSessions, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (sessionsError || !userSessions || userSessions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No interviews yet',
        hasInterviews: false
      })
    }

    const sessionIds = userSessions.map(s => s.id)
    
    // Step 2: Check for existing feedback (most recent first)
    const { data: feedback, error: feedbackError } = await supabase
      .from('interview_feedback')
      .select('session_id, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (feedback && !feedbackError) {
      // Has feedback - return session ID for direct navigation
      return NextResponse.json({
        success: true,
        sessionId: feedback.session_id,
        message: 'Latest results with feedback found',
        hasInterviews: true,
        hasFeedback: true
      })
    }

    // Step 3: No feedback exists - return most recent session for generation
    const mostRecentSession = userSessions[0]
    
    return NextResponse.json({
      success: true,
      sessionId: mostRecentSession.id,
      message: 'Most recent session found, feedback will be generated',
      hasInterviews: true,
      hasFeedback: false
    })

  } catch (error) {
    console.error('Latest interview API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}