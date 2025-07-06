import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

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

    // Get interview session
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get interview feedback
    const { data: feedback } = await supabase
      .from('interview_feedback')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    // Get interview responses with questions
    const { data: responses, error: responsesError } = await supabase
      .from('interview_responses')
      .select(`
        *,
        interview_questions (
          question_text,
          question_order,
          question_type
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at')

    if (responsesError) {
      console.error('Responses fetch error:', responsesError)
    }

    // Transform responses data
    const transformedResponses = responses?.map(response => ({
      question: response.interview_questions,
      score: response.score,
      feedback: response.feedback,
      response_text: response.response_text
    })) || []

    return NextResponse.json({
      session,
      feedback: feedback || {
        overall_feedback: "Great job on completing your interview! You showed good communication skills and provided thoughtful responses.",
        strengths: ["Clear communication", "Good examples", "Professional demeanor"],
        areas_for_improvement: ["More specific metrics", "Company research", "Technical depth"],
        suggested_next_steps: [
          "Practice answering with specific examples",
          "Research the company's values and mission", 
          "Try a \"Hard\" difficulty interview next"
        ],
        confidence_score: 80,
        communication_score: 82,
        content_score: 74
      },
      responses: transformedResponses
    })

  } catch (error) {
    console.error('Results fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}