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
    // Get base URL for API calls
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    // Step 1: Use API endpoint to get latest interview info (no hanging Supabase calls)
    const latestResponse = await fetch(`${baseUrl}/api/latest-interview`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!latestResponse.ok) {
      if (latestResponse.status === 401) {
        return {
          success: false,
          message: 'Authentication required',
          hasInterviews: false
        }
      }
      
      const errorData = await latestResponse.json().catch(() => ({ message: 'Unknown error' }))
      return {
        success: false,
        message: errorData.message || 'Failed to check latest interview',
        hasInterviews: false
      }
    }

    const latestData = await latestResponse.json()
    
    if (!latestData.success) {
      return {
        success: false,
        message: latestData.message,
        hasInterviews: latestData.hasInterviews
      }
    }

    // Step 2: If feedback exists, navigate directly
    if (latestData.hasFeedback) {
      return {
        success: true,
        sessionId: latestData.sessionId,
        message: 'Navigating to latest results',
        hasInterviews: true
      }
    }

    // Step 3: No feedback exists - trigger results generation
    const resultsResponse = await fetch(`${baseUrl}/api/results/${latestData.sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (resultsResponse.ok) {
      return {
        success: true,
        sessionId: latestData.sessionId,
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