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
      .select('id, question_count')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get actual question count from interview_questions table
    const { data: questions } = await supabase
      .from('interview_questions')
      .select('id')
      .eq('session_id', sessionId)

    const actualQuestionCount = questions?.length || session.question_count

    // Get conversation progress
    const { data: conversation, error: conversationError } = await supabase
      .from('interview_conversation')
      .select('message_type, speaker')
      .eq('session_id', sessionId)
      .order('turn_number')

    if (conversationError) {
      console.error('Conversation fetch error:', conversationError)
      return NextResponse.json({
        currentQuestion: 1,
        totalQuestions: actualQuestionCount,
        progress: 20
      })
    }

    // Count main questions asked
    const mainQuestionsAsked = conversation?.filter(turn => 
      turn.speaker === 'interviewer' && turn.message_type === 'main_question'
    ).length || 0

    // Current question number = number of questions asked (1-based)
    // If 0 questions asked, we're on question 1
    // If 1 question asked, we're still on question 1 (until it's answered)
    const currentQuestion = Math.max(1, mainQuestionsAsked)
    const totalQuestions = actualQuestionCount
    const progress = Math.round((mainQuestionsAsked / totalQuestions) * 100)

    return NextResponse.json({
      currentQuestion: Math.min(currentQuestion, totalQuestions),
      totalQuestions,
      progress: Math.min(progress, 100),
      mainQuestionsAsked
    })

  } catch (error) {
    console.error('Progress fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}