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
      .select('message_type, speaker, turn_number')
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

    // Count main questions that have been asked
    const mainQuestionTurns = conversation?.filter(turn => 
      turn.speaker === 'interviewer' && turn.message_type === 'main_question'
    ) || []
    
    const mainQuestionsAsked = mainQuestionTurns.length
    
    // Progress advances when the next main question is asked
    // If we're on Q1, progress is 0%. If we're on Q2, Q1 is complete (progress = 1/8)
    const mainQuestionsCompleted = Math.max(0, mainQuestionsAsked - 1)

    // Find the most recent interviewer question to determine current question type
    const recentInterviewerTurns = conversation?.filter(turn => 
      turn.speaker === 'interviewer' && 
      (turn.message_type === 'main_question' || turn.message_type === 'follow_up')
    ) || []
    
    const lastInterviewerTurn = recentInterviewerTurns[recentInterviewerTurns.length - 1]
    const currentQuestionType = lastInterviewerTurn?.message_type || 'intro'

    // Count follow-ups for the current main question
    let currentFollowupCount = 0
    if (mainQuestionsAsked > 0) {
      // Find the most recent main question turn number
      const mainQuestionTurns = conversation?.filter(turn => 
        turn.speaker === 'interviewer' && turn.message_type === 'main_question'
      ) || []
      
      if (mainQuestionTurns.length > 0) {
        const lastMainQuestionIndex = conversation?.findLastIndex(turn => 
          turn.speaker === 'interviewer' && turn.message_type === 'main_question'
        ) || -1
        
        // Count follow-ups after the last main question
        const followUpsAfterLastMain = conversation?.slice(lastMainQuestionIndex + 1).filter(turn => 
          turn.speaker === 'interviewer' && turn.message_type === 'follow_up'
        ).length || 0
        
        currentFollowupCount = followUpsAfterLastMain
      }
    }

    // Calculate current main question number (1-based)
    // For main questions: show the current question number being asked (mainQuestionsAsked)
    // For follow-ups: show the main question number being followed up (mainQuestionsAsked)
    const currentMainQuestion = Math.max(1, mainQuestionsAsked)
    
    // Generate follow-up letter (a, b, c, etc.)
    const followupLetter = currentFollowupCount > 0 ? String.fromCharCode(97 + currentFollowupCount - 1) : null
    
    // Total questions asked by interviewer
    const totalQuestionsAsked = conversation?.filter(turn => 
      turn.speaker === 'interviewer' && 
      (turn.message_type === 'main_question' || turn.message_type === 'follow_up')
    ).length || 0

    // Check if we're in closing section - if so, all questions are complete
    const isClosing = currentQuestionType === 'closing'
    const finalMainQuestionsCompleted = isClosing ? actualQuestionCount : mainQuestionsCompleted
    const finalProgress = isClosing ? 100 : Math.round((mainQuestionsCompleted / actualQuestionCount) * 100)

    return NextResponse.json({
      currentMainQuestion: Math.min(currentMainQuestion, actualQuestionCount),
      totalQuestions: actualQuestionCount,
      progress: Math.min(finalProgress, 100),
      mainQuestionsAsked,
      mainQuestionsCompleted: finalMainQuestionsCompleted,
      currentQuestionType,
      currentFollowupCount,
      followupLetter,
      totalQuestionsAsked,
      // Legacy fields for backward compatibility
      currentQuestion: Math.min(currentMainQuestion, actualQuestionCount)
    })

  } catch (error) {
    console.error('Progress fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}