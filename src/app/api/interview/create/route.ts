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
    const { difficulty, interviewType, voiceGender, communicationStyle, questionCount } = await request.json()

    if (!difficulty || !interviewType || !voiceGender || !communicationStyle) {
      return NextResponse.json(
        { error: 'Difficulty, interview type, voice gender, and communication style are required' },
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
        difficulty_level: difficulty,
        interview_type: interviewType,
        voice_gender: voiceGender,
        communication_style: communicationStyle,
        question_count: questionCount || 8,
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
      // Map 10-point difficulty scale to descriptive levels
      const getDifficultyDescription = (level: string): string => {
        const numLevel = parseInt(level) || 5
        if (numLevel <= 2) return "easy and encouraging, basic level questions suitable for entry-level candidates"
        if (numLevel <= 5) return "standard professional level with moderate complexity and clear expectations"
        if (numLevel <= 8) return "challenging and detailed, requiring specific examples and deep technical knowledge"
        return "extremely difficult and technical, expert-level depth with complex problem-solving scenarios"
      }

      // Legacy support for old difficulty strings
      const difficultyMap = {
        softball: "easy and encouraging, basic level questions",
        medium: "standard professional level with moderate complexity", 
        hard: "challenging and detailed, requiring specific examples",
        hard_as_fck: "extremely difficult and technical, expert-level depth"
      }

      const interviewTypeMap = {
        phone_screening: "initial screening focused on cultural fit, basic qualifications, and motivation",
        technical_screen: "technical assessment focusing on role-specific skills, tools, methodologies, and problem-solving approaches relevant to the candidate's field",
        hiring_manager: "role-specific deep-dive covering past experiences, leadership situations, and job-specific scenarios",
        cultural_fit: "team dynamics, company values alignment, work style preferences, and interpersonal skills"
      }

      const communicationStyleMap = {
        corporate_professional: "formal business tone, structured questions, professional language",
        casual_conversational: "relaxed, natural conversation style, friendly approach, informal language"
      }

      const questionPrompt = `
Generate ${questionCount || 8} personalized interview questions based on the following context:

CANDIDATE BACKGROUND:
${resumeData.parsed_content || 'No resume content available'}

JOB REQUIREMENTS:
${jobData.job_content || 'No job description available'}

INTERVIEW CONFIGURATION:
- DIFFICULTY: ${difficultyMap[difficulty as keyof typeof difficultyMap] || getDifficultyDescription(difficulty)}
- INTERVIEW TYPE: ${interviewTypeMap[interviewType as keyof typeof interviewTypeMap]}
- COMMUNICATION STYLE: ${communicationStyleMap[communicationStyle as keyof typeof communicationStyleMap]}

Requirements:
- Questions should be ${difficultyMap[difficulty as keyof typeof difficultyMap] || getDifficultyDescription(difficulty)}
- Focus on ${interviewTypeMap[interviewType as keyof typeof interviewTypeMap]}
- Use ${communicationStyleMap[communicationStyle as keyof typeof communicationStyleMap]}
- Tailor questions to match both the candidate's experience and job requirements
- Include specific follow-up points that probe deeper into each response
- Ensure questions align with the interview type focus area
- Include 2-3 "briefcase technique" questions that test preparation and problem-solving

QUESTION TYPE DISTRIBUTION (8 questions total):
${interviewType === 'technical_screen' ? '- 3 technical/problem-solving questions\n- 2 behavioral questions\n- 1 situational question\n- 2 preparation/briefcase questions' : 
  interviewType === 'phone_screening' ? '- 3 cultural fit questions\n- 2 motivation questions\n- 1 basic qualifications question\n- 2 preparation/briefcase questions' :
  interviewType === 'hiring_manager' ? '- 3 role-specific experience questions\n- 2 leadership/scenarios questions\n- 1 technical question\n- 2 preparation/briefcase questions' :
  '- 3 cultural fit questions\n- 2 team dynamics questions\n- 1 work style question\n- 2 preparation/briefcase questions'}

BRIEFCASE TECHNIQUE QUESTIONS:
Include 2-3 questions that test the candidate's preparation and problem-solving abilities:
- "What specific challenges or opportunities do you see in this role/company based on your research?"
- "If you were to start in this position, what would be your first priority and why?"
- "What improvements or ideas do you have for [specific company/department area]?"
- "Based on your research, what do you think are the biggest challenges facing [company/industry]?"

Return in JSON format:
{
  "questions": [
    {
      "text": "question text",
      "type": "behavioral|technical|situational|cultural|preparation",
      "expectedPoints": ["key point 1", "key point 2", "key point 3"],
      "followUp": "specific follow-up question to probe deeper"
    }
  ]
}
`

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates personalized interview questions. Your questions must perfectly match the specified difficulty level, interview type focus, and communication style. 

For technical screens, interpret "technical" based on the candidate's professional background and role level:
- Marketing professionals: focus on MarTech, analytics, testing methodologies, tool selection, data interpretation, automation platforms
- Engineering professionals: focus on coding, architecture, algorithms, system design  
- Leadership roles: focus on technical decision-making, team technical guidance, tool evaluation, strategic technical choices
- Sales professionals: focus on CRM systems, sales tools, process optimization, data analysis
- Other roles: adapt technical focus to field-specific tools, methodologies, and problem-solving approaches

You understand that technical competency varies by role - a marketing director's technical skills involve different tools and concepts than a software engineer's.`
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
        expected_answer_points: q.expectedPoints || null
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