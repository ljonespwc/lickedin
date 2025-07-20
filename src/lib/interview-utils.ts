import { supabase } from '@/lib/supabase'

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

// Simple results navigation - just route to /results and let that page handle the logic
export async function handleSmartResultsNavigation(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accessToken: string
): Promise<{ success: boolean; route: string }> {
  // Always route to /results - that page will handle checking for interviews
  // and either show the latest results or "no interviews yet" message
  return {
    success: true,
    route: '/results'
  }
}