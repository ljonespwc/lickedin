import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Get most recent completed interview for a user
export async function getMostRecentInterview(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return data.id
  } catch (error) {
    console.error('Error getting most recent interview:', error)
    return null
  }
}

// Check if user has any completed interviews
export async function hasCompletedInterviews(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1)

    if (error || !data || data.length === 0) {
      return false
    }

    return true
  } catch (error) {
    console.error('Error checking for completed interviews:', error)
    return false
  }
}

// Smart results navigation - handles feedback generation and routing
export async function handleSmartResultsNavigation(
  userId: string,
  accessToken: string
): Promise<{ success: boolean; sessionId?: string; message: string; hasInterviews: boolean }> {
  try {
    // Step 1: Check for most recent feedback for user's sessions
    const { data: userSessions } = await supabase
      .from('interview_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (!userSessions || userSessions.length === 0) {
      return {
        success: false,
        message: 'No interviews yet',
        hasInterviews: false
      }
    }

    const sessionIds = userSessions.map(s => s.id)
    
    const { data: feedback, error: feedbackError } = await supabase
      .from('interview_feedback')
      .select('session_id')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (feedback && !feedbackError) {
      // Has feedback - navigate directly to results
      return {
        success: true,
        sessionId: feedback.session_id,
        message: 'Navigating to latest results',
        hasInterviews: true
      }
    }

    // Step 2: Use most recent session (already have it from step 1)
    const mostRecentSession = userSessions[0]

    // Step 3: Session exists without feedback - trigger results generation
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/results/${mostRecentSession.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      return {
        success: true,
        sessionId: mostRecentSession.id,
        message: 'Results generated successfully',
        hasInterviews: true
      }
    } else {
      return {
        success: false,
        message: 'Failed to generate results',
        hasInterviews: true
      }
    }

  } catch (error) {
    console.error('Error in smart results navigation:', error)
    return {
      success: false,
      message: 'Error accessing results',
      hasInterviews: false
    }
  }
}