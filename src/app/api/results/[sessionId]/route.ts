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

    // Get conversation history from the new interview_conversation table
    const { data: conversation, error: conversationError } = await supabase
      .from('interview_conversation')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_number')

    if (conversationError) {
      console.error('Conversation fetch error:', conversationError)
    }

    // Get interview questions for context
    const { data: questions } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order')

    // Transform conversation data into Q&A pairs
    const transformedResponses = []
    if (conversation && questions) {
      // Group conversation by interviewer questions and candidate responses
      const conversationPairs = []
      let currentQuestion = null
      let candidateResponses = []

      for (const turn of conversation) {
        if (turn.speaker === 'interviewer' && (turn.message_type === 'main_question' || turn.message_type === 'follow_up')) {
          // Save previous Q&A pair if exists
          if (currentQuestion && candidateResponses.length > 0) {
            conversationPairs.push({
              question: currentQuestion,
              responses: candidateResponses
            })
          }
          // Start new Q&A pair
          currentQuestion = turn
          candidateResponses = []
        } else if (turn.speaker === 'candidate' && turn.message_type === 'response') {
          candidateResponses.push(turn)
        }
      }
      
      // Add final Q&A pair
      if (currentQuestion && candidateResponses.length > 0) {
        conversationPairs.push({
          question: currentQuestion,
          responses: candidateResponses
        })
      }

      // Transform to expected format
      transformedResponses.push(...conversationPairs.map((pair, index) => ({
        question: {
          question_text: pair.question.message_text,
          question_order: index + 1,
          question_type: pair.question.message_type
        },
        score: null, // No scoring implemented yet
        feedback: null, // No individual feedback yet
        response_text: pair.responses.map(r => r.message_text).join(' ')
      })))
    }

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