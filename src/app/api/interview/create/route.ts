import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { difficulty, persona, questionCount } = await request.json()

    if (!difficulty || !persona) {
      return NextResponse.json(
        { error: 'Difficulty and persona are required' },
        { status: 400 }
      )
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

    // Get the most recent resume and job description for this user
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (resumeError || !resumeData) {
      return NextResponse.json(
        { error: 'No resume found. Please upload a resume first.' },
        { status: 400 }
      )
    }

    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (jobError || !jobData) {
      return NextResponse.json(
        { error: 'No job description found. Please process a job URL first.' },
        { status: 400 }
      )
    }

    // Create interview session
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        resume_id: resumeData.id,
        job_description_id: jobData.id,
        persona,
        difficulty_level: difficulty,
        question_count: questionCount || 5,
        status: 'pending'
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create interview session' },
        { status: 500 }
      )
    }

    // TODO: Generate interview questions and store them
    // For now, we'll create placeholder questions
    const placeholderQuestions = [
      {
        session_id: sessionData.id,
        question_text: "Tell me about yourself and your background.",
        question_order: 1,
        question_type: "behavioral"
      },
      {
        session_id: sessionData.id,
        question_text: "Why are you interested in this position?",
        question_order: 2,
        question_type: "behavioral"
      },
      {
        session_id: sessionData.id,
        question_text: "Describe a challenging project you worked on.",
        question_order: 3,
        question_type: "behavioral"
      },
      {
        session_id: sessionData.id,
        question_text: "What are your technical strengths?",
        question_order: 4,
        question_type: "technical"
      },
      {
        session_id: sessionData.id,
        question_text: "Where do you see yourself in 5 years?",
        question_order: 5,
        question_type: "behavioral"
      }
    ]

    const { error: questionsError } = await supabase
      .from('interview_questions')
      .insert(placeholderQuestions)

    if (questionsError) {
      console.error('Questions creation error:', questionsError)
      // Continue anyway - questions can be generated later
    }

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id
    })

  } catch (error) {
    console.error('Interview creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}