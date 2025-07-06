import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { difficulty, persona, questionCount } = await request.json()

    if (!difficulty || !persona) {
      return NextResponse.json(
        { error: 'Difficulty and persona are required' },
        { status: 400 }
      )
    }

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

    // Get the most recent resume and job description for this user
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .select('id, parsed_content')
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
      .select('id, job_content')
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

    // Generate personalized interview questions using OpenAI
    try {
      const difficultyMap = {
        softball: "easy and encouraging",
        medium: "standard professional level",
        hard: "challenging and detailed",
        hard_as_fck: "extremely difficult and technical"
      }

      const personaMap = {
        michael_scott: "friendly and slightly humorous but professional",
        professional: "standard corporate and formal",
        friendly_mentor: "supportive and encouraging",
        tech_lead: "technical and detail-oriented"
      }

      const questionPrompt = `
Generate ${questionCount || 5} personalized interview questions based on the following context:

RESUME:
${resumeData.parsed_content?.substring(0, 1500) || 'No resume content available'}

JOB DESCRIPTION:
${jobData.job_content?.substring(0, 1500) || 'No job description available'}

DIFFICULTY LEVEL: ${difficultyMap[difficulty as keyof typeof difficultyMap] || 'medium'}
INTERVIEWER PERSONA: ${personaMap[persona as keyof typeof personaMap] || 'professional'}

Requirements:
- Questions should be ${difficultyMap[difficulty as keyof typeof difficultyMap] || 'medium'} in nature
- Style should match a ${personaMap[persona as keyof typeof personaMap] || 'professional'} interviewer
- Mix behavioral, technical, and situational questions based on the role
- Questions should be relevant to both the candidate's background and the job requirements
- Include follow-up points that the interviewer should look for in responses

Return in JSON format:
{
  "questions": [
    {
      "text": "question text",
      "type": "behavioral|technical|situational",
      "expectedPoints": ["key point 1", "key point 2", "key point 3"],
      "followUp": "optional follow-up question"
    }
  ]
}
`

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates personalized interview questions. Your questions should match the specified difficulty level and interviewer persona while being relevant to the candidate's background and the job requirements.`
          },
          {
            role: "user",
            content: questionPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })

      const questionsResponse = JSON.parse(completion.choices[0].message.content || '{"questions": []}')
      const generatedQuestions = questionsResponse.questions || []

      // Store the generated questions in the database
      const questionsToInsert = generatedQuestions.map((q: { text: string; type?: string; expectedPoints?: string[]; followUp?: string }, index: number) => ({
        session_id: sessionData.id,
        question_text: q.text,
        question_order: index + 1,
        question_type: q.type || 'behavioral',
        expected_points: q.expectedPoints ? JSON.stringify(q.expectedPoints) : null,
        follow_up: q.followUp || null
      }))

      const { error: questionsError } = await supabase
        .from('interview_questions')
        .insert(questionsToInsert)

      if (questionsError) {
        console.error('Questions creation error:', questionsError)
        return NextResponse.json(
          { error: 'Failed to store generated questions' },
          { status: 500 }
        )
      }

    } catch (openaiError) {
      console.error('OpenAI error:', openaiError)
      return NextResponse.json(
        { error: 'Failed to generate questions' },
        { status: 500 }
      )
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