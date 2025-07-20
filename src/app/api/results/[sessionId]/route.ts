import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Types for analysis
interface ConversationTurn {
  turn_number: number
  speaker: 'interviewer' | 'candidate'
  message_text: string
  message_type: 'main_question' | 'follow_up' | 'response' | 'transition' | 'closing'
  related_main_question_id?: string
  word_count?: number
}

interface InterviewContext {
  interview_type: string
  communication_style: string
  difficulty_level: string
  resume_content: string
  job_content: string
}

interface ResponseAnalysis {
  response_id: string
  question_text: string
  response_text: string
  quality_score: number
  strengths: string[]
  weaknesses: string[]
  improvement_suggestions: string[]
  keyword_alignment: string[]
  missed_opportunities: string[]
}

// Helper function to analyze individual response quality
async function analyzeResponseQuality(
  questionText: string,
  responseText: string,
  context: InterviewContext
): Promise<ResponseAnalysis> {
  const prompt = `You are an expert interview coach analyzing a candidate's response. 

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level}

CANDIDATE'S RESUME:
${context.resume_content}

JOB REQUIREMENTS:
${context.job_content}

INTERVIEW QUESTION:
${questionText}

CANDIDATE'S RESPONSE:
${responseText}

Please provide a comprehensive analysis of this response. Consider:
1. How well does it answer the question?
2. Does it demonstrate relevant skills from their resume?
3. How well does it align with the job requirements?
4. Are there specific examples and concrete details?
5. Is the communication style appropriate for the interview type?

For behavioral interviews specifically, also evaluate:
- STAR structure: Does the response include Situation, Task, Action, and Result?
- Specificity: Are examples concrete and detailed rather than vague generalizations?
- Quantified outcomes: Are results measurable and impactful?
- Learning/growth: Does the candidate show reflection and learning from experiences?

Respond with JSON only:
{
  "quality_score": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "improvement_suggestions": ["suggestion1", "suggestion2"],
  "keyword_alignment": ["keyword1", "keyword2"],
  "missed_opportunities": ["opportunity1", "opportunity2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert interview coach. For behavioral interviews, evaluate responses using STAR method criteria (Situation, Task, Action, Result). Look for specific examples, measurable outcomes, and clear problem-solving progression. Respond only with valid JSON.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(response)
    
    return {
      response_id: '',
      question_text: questionText,
      response_text: responseText,
      quality_score: analysis.quality_score || 75,
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      improvement_suggestions: analysis.improvement_suggestions || [],
      keyword_alignment: analysis.keyword_alignment || [],
      missed_opportunities: analysis.missed_opportunities || []
    }
  } catch (error) {
    console.error('Error analyzing response:', error)
    return {
      response_id: '',
      question_text: questionText,
      response_text: responseText,
      quality_score: 75,
      strengths: ['Response provided'],
      weaknesses: ['Could use more specific examples'],
      improvement_suggestions: ['Add concrete examples and metrics'],
      keyword_alignment: [],
      missed_opportunities: []
    }
  }
}

// Helper function to analyze resume utilization
async function analyzeResumeUtilization(
  resumeContent: string,
  conversation: ConversationTurn[],
  context: InterviewContext
): Promise<{
  skills_mentioned: string[]
  skills_missed: string[]
  experiences_mentioned: string[]
  experiences_missed: string[]
  utilization_score: number
  missed_opportunities: string[]
}> {
  const candidateResponses = conversation
    .filter(turn => turn.speaker === 'candidate')
    .map(turn => turn.message_text)
    .join('\n')

  const prompt = `You are an expert career coach analyzing how well a candidate utilized their resume during an interview.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}

CANDIDATE'S RESUME:
${resumeContent}

CANDIDATE'S INTERVIEW RESPONSES:
${candidateResponses}

Analyze how effectively the candidate used their resume content during the interview. Consider:
1. Which skills from their resume were mentioned vs. omitted?
2. Which work experiences were referenced vs. missed?
3. What stories or achievements could they have shared but didn't?
4. How well did they tailor their resume content to the interview type?

Respond with JSON only:
{
  "skills_mentioned": ["skill1", "skill2"],
  "skills_missed": ["skill3", "skill4"],
  "experiences_mentioned": ["experience1", "experience2"],
  "experiences_missed": ["experience3", "experience4"],
  "utilization_score": 0-100,
  "missed_opportunities": ["opportunity1", "opportunity2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert career coach. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 600
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(response)
    
    return {
      skills_mentioned: analysis.skills_mentioned || [],
      skills_missed: analysis.skills_missed || [],
      experiences_mentioned: analysis.experiences_mentioned || [],
      experiences_missed: analysis.experiences_missed || [],
      utilization_score: analysis.utilization_score || 70,
      missed_opportunities: analysis.missed_opportunities || []
    }
  } catch (error) {
    console.error('Error analyzing resume utilization:', error)
    return {
      skills_mentioned: [],
      skills_missed: [],
      experiences_mentioned: [],
      experiences_missed: [],
      utilization_score: 70,
      missed_opportunities: []
    }
  }
}

// Helper function to analyze job fit
async function analyzeJobFit(
  jobContent: string,
  conversation: ConversationTurn[],
  context: InterviewContext
): Promise<{
  requirements_covered: string[]
  requirements_missed: string[]
  keyword_matches: string[]
  fit_score: number
  gap_analysis: string[]
}> {
  const candidateResponses = conversation
    .filter(turn => turn.speaker === 'candidate')
    .map(turn => turn.message_text)
    .join('\n')

  const prompt = `You are an expert talent acquisition specialist analyzing how well a candidate's interview responses align with job requirements.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}

JOB DESCRIPTION:
${jobContent}

CANDIDATE'S INTERVIEW RESPONSES:
${candidateResponses}

Analyze how well the candidate's responses align with the job requirements. Consider:
1. Which job requirements were directly addressed?
2. Which key requirements were not covered?
3. What job-relevant keywords did they use?
4. How well do they fit the role based on their responses?
5. What are the main gaps between their responses and job needs?

Respond with JSON only:
{
  "requirements_covered": ["requirement1", "requirement2"],
  "requirements_missed": ["requirement3", "requirement4"],
  "keyword_matches": ["keyword1", "keyword2"],
  "fit_score": 0-100,
  "gap_analysis": ["gap1", "gap2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert talent acquisition specialist. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 600
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(response)
    
    return {
      requirements_covered: analysis.requirements_covered || [],
      requirements_missed: analysis.requirements_missed || [],
      keyword_matches: analysis.keyword_matches || [],
      fit_score: analysis.fit_score || 75,
      gap_analysis: analysis.gap_analysis || []
    }
  } catch (error) {
    console.error('Error analyzing job fit:', error)
    return {
      requirements_covered: [],
      requirements_missed: [],
      keyword_matches: [],
      fit_score: 75,
      gap_analysis: []
    }
  }
}

// Helper function to store AI analysis results in database
async function storeAnalysisResults(
  supabaseClient: SupabaseClient,
  sessionId: string,
  aiAnalysis: {
    response_analyses: ResponseAnalysis[]
    resume_analysis: {
      skills_mentioned: string[]
      skills_missed: string[]
      experiences_mentioned: string[]
      experiences_missed: string[]
      utilization_score: number
      missed_opportunities: string[]
    }
    job_fit_analysis: {
      requirements_covered: string[]
      requirements_missed: string[]
      keyword_matches: string[]
      fit_score: number
      gap_analysis: string[]
    }
    coaching_feedback: {
      overall_feedback: string
      strengths: string[]
      areas_for_improvement: string[]
      suggested_next_steps: string[]
      communication_score: number
      content_score: number
      confidence_score: number
    }
    preparation_analysis: {
      preparation_score: number
      business_insights: string[]
      solutions_proposed: string[]
      problem_solving_approach: string
      research_quality: string[]
      strategic_thinking: string[]
      missed_opportunities: string[]
    }
  }
): Promise<boolean> {
  try {
    console.log('🔄 Starting analysis storage for session:', sessionId)
    
    // Log the data being stored for debugging
    console.log('📊 Analysis data summary:', {
      sessionId,
      hasResponseAnalyses: !!aiAnalysis.response_analyses,
      responseAnalysesCount: aiAnalysis.response_analyses?.length || 0,
      hasResumeAnalysis: !!aiAnalysis.resume_analysis,
      hasJobFitAnalysis: !!aiAnalysis.job_fit_analysis,
      hasCoachingFeedback: !!aiAnalysis.coaching_feedback,
      hasPreparationAnalysis: !!aiAnalysis.preparation_analysis,
      communicationScore: aiAnalysis.coaching_feedback?.communication_score,
      contentScore: aiAnalysis.coaching_feedback?.content_score,
      confidenceScore: aiAnalysis.coaching_feedback?.confidence_score
    })

    const { data, error } = await supabaseClient
      .from('interview_feedback')
      .upsert({
        session_id: sessionId,
        overall_feedback: aiAnalysis.coaching_feedback.overall_feedback,
        strengths: aiAnalysis.coaching_feedback.strengths,
        areas_for_improvement: aiAnalysis.coaching_feedback.areas_for_improvement,
        suggested_next_steps: aiAnalysis.coaching_feedback.suggested_next_steps,
        confidence_score: aiAnalysis.coaching_feedback.confidence_score,
        communication_score: aiAnalysis.coaching_feedback.communication_score,
        content_score: aiAnalysis.coaching_feedback.content_score,
        preparation_score: aiAnalysis.preparation_analysis.preparation_score,
        business_insights: aiAnalysis.preparation_analysis.business_insights,
        solutions_proposed: aiAnalysis.preparation_analysis.solutions_proposed,
        problem_solving_approach: aiAnalysis.preparation_analysis.problem_solving_approach,
        preparation_analysis: aiAnalysis.preparation_analysis,
        response_analyses: aiAnalysis.response_analyses,
        resume_analysis: aiAnalysis.resume_analysis,
        job_fit_analysis: aiAnalysis.job_fit_analysis,
        ai_analysis_completed_at: new Date().toISOString(),
        ai_analysis_version: 1
      }, {
        onConflict: 'session_id'
      })

    if (error) {
      console.error('❌ CRITICAL: Database write failed for session:', sessionId)
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return false
    } else {
      console.log('✅ AI analysis results cached successfully for session:', sessionId)
      console.log('✅ Database response:', data)
      return true
    }
  } catch (error) {
    console.error('❌ CRITICAL: Exception storing analysis results for session:', sessionId)
    console.error('❌ Exception details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return false
  }
}

// Helper function to generate overall coaching feedback
async function generateCoachingFeedback(
  conversation: ConversationTurn[],
  context: InterviewContext,
  responseAnalyses: ResponseAnalysis[],
  resumeAnalysis: {
    utilization_score: number
    missed_opportunities: string[]
  },
  jobFitAnalysis: {
    fit_score: number
    gap_analysis: string[]
  }
): Promise<{
  overall_feedback: string
  strengths: string[]
  areas_for_improvement: string[]
  suggested_next_steps: string[]
  communication_score: number
  content_score: number
  confidence_score: number
}> {
  const candidateResponses = conversation
    .filter(turn => turn.speaker === 'candidate')
    .map(turn => turn.message_text)
    .join('\n')

  const prompt = `You are an expert interview coach providing comprehensive feedback to a candidate.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level}

CONVERSATION SUMMARY:
${candidateResponses}

RESPONSE ANALYSIS SUMMARY:
Average Quality Score: ${responseAnalyses.reduce((sum, r) => sum + r.quality_score, 0) / responseAnalyses.length}
Key Strengths: ${responseAnalyses.flatMap(r => r.strengths).join(', ')}
Key Weaknesses: ${responseAnalyses.flatMap(r => r.weaknesses).join(', ')}

RESUME UTILIZATION:
Utilization Score: ${resumeAnalysis.utilization_score}/100
Missed Opportunities: ${resumeAnalysis.missed_opportunities.join(', ')}

JOB FIT ANALYSIS:
Fit Score: ${jobFitAnalysis.fit_score}/100
Gap Analysis: ${jobFitAnalysis.gap_analysis.join(', ')}

Provide comprehensive coaching feedback considering the interview type and style. Be encouraging but honest about areas for improvement.

For behavioral interviews, specifically evaluate:
- STAR methodology usage (Situation, Task, Action, Result structure)
- Story quality and specificity of examples provided
- Evidence of self-reflection and learning from experiences
- Leadership and problem-solving demonstration through concrete examples

Respond with JSON only:
{
  "overall_feedback": "Comprehensive paragraph about overall performance",
  "strengths": ["strength1", "strength2", "strength3"],
  "areas_for_improvement": ["area1", "area2", "area3"],
  "suggested_next_steps": ["step1", "step2", "step3"],
  "communication_score": 0-100,
  "content_score": 0-100,
  "confidence_score": 0-100
}`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert interview coach specializing in behavioral interview assessment. For behavioral interviews, focus on STAR methodology evaluation, story quality, and demonstration of competencies through specific examples. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(response)
    
    return {
      overall_feedback: analysis.overall_feedback || 'Great job completing your interview!',
      strengths: analysis.strengths || [],
      areas_for_improvement: analysis.areas_for_improvement || [],
      suggested_next_steps: analysis.suggested_next_steps || [],
      communication_score: analysis.communication_score || 75,
      content_score: analysis.content_score || 75,
      confidence_score: analysis.confidence_score || 75
    }
  } catch (error) {
    console.error('Error generating coaching feedback:', error)
    return {
      overall_feedback: 'Great job completing your interview!',
      strengths: [],
      areas_for_improvement: [],
      suggested_next_steps: [],
      communication_score: 75,
      content_score: 75,
      confidence_score: 75
    }
  }
}

// Helper function to analyze preparation and problem-solving demonstration
async function analyzePreparationAndProblemSolving(
  conversation: ConversationTurn[],
  context: InterviewContext,
  resumeContent: string,
  jobContent: string
): Promise<{
  preparation_score: number
  business_insights: string[]
  solutions_proposed: string[]
  problem_solving_approach: string
  research_quality: string[]
  strategic_thinking: string[]
  missed_opportunities: string[]
}> {
  // Filter for preparation-related responses (questions and follow-ups)
  const allResponses = conversation
    .filter(turn => turn.speaker === 'candidate')
    .map(turn => turn.message_text)
    .join('\n')

  const preparationQuestions = conversation
    .filter(turn => 
      turn.speaker === 'interviewer' && 
      (turn.message_text.includes('research') || 
       turn.message_text.includes('challenge') || 
       turn.message_text.includes('improvement') || 
       turn.message_text.includes('priority') || 
       turn.message_text.includes('opportunity'))
    )
    .map(turn => turn.message_text)
    .join('\n')

  const prompt = `You are an expert interviewer analyzing a candidate's preparation and problem-solving demonstration.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level}

CANDIDATE'S RESUME:
${resumeContent}

JOB REQUIREMENTS:
${jobContent}

PREPARATION-RELATED QUESTIONS ASKED:
${preparationQuestions}

CANDIDATE'S RESPONSES:
${allResponses}

Analyze how well the candidate demonstrated preparation and problem-solving abilities. Consider:
1. Quality of company/role research shown
2. Specific business insights or challenges identified
3. Concrete solutions or improvements proposed
4. Strategic thinking and proactive approach
5. Depth of preparation beyond surface-level research
6. Problem-solving methodology demonstrated

Respond with JSON only:
{
  "preparation_score": 0-100,
  "business_insights": ["insight1", "insight2"],
  "solutions_proposed": ["solution1", "solution2"],
  "problem_solving_approach": "description of their approach",
  "research_quality": ["quality1", "quality2"],
  "strategic_thinking": ["example1", "example2"],
  "missed_opportunities": ["opportunity1", "opportunity2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert interviewer evaluating preparation and problem-solving. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(response)
    
    return {
      preparation_score: analysis.preparation_score || 70,
      business_insights: analysis.business_insights || [],
      solutions_proposed: analysis.solutions_proposed || [],
      problem_solving_approach: analysis.problem_solving_approach || 'Limited problem-solving demonstration',
      research_quality: analysis.research_quality || [],
      strategic_thinking: analysis.strategic_thinking || [],
      missed_opportunities: analysis.missed_opportunities || []
    }
  } catch (error) {
    console.error('Error analyzing preparation and problem-solving:', error)
    return {
      preparation_score: 70,
      business_insights: [],
      solutions_proposed: [],
      problem_solving_approach: 'Analysis unavailable',
      research_quality: [],
      strategic_thinking: [],
      missed_opportunities: []
    }
  }
}

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
    
    // Debug authentication context
    console.log('🔐 Authentication context:', {
      sessionId,
      hasAccessToken: !!accessToken,
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    })
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get interview session with related data
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select(`
        *,
        resumes!inner(parsed_content),
        job_descriptions!inner(job_content)
      `)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get interview feedback (check for cached analysis first)
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

    // Check for cached AI analysis first, then generate if needed
    let aiAnalysis = null
    
    // Check if we have cached analysis
    const hasCachedAnalysis = feedback?.ai_analysis_completed_at && 
                             feedback?.response_analyses && 
                             feedback?.resume_analysis && 
                             feedback?.job_fit_analysis &&
                             (feedback?.preparation_analysis || feedback?.preparation_score !== null)
    
    if (hasCachedAnalysis) {
      console.log('✅ Using cached AI analysis for session:', sessionId)
      
      // Reconstruct aiAnalysis from cached data
      aiAnalysis = {
        response_analyses: feedback.response_analyses,
        resume_analysis: feedback.resume_analysis,
        job_fit_analysis: feedback.job_fit_analysis,
        coaching_feedback: {
          overall_feedback: feedback.overall_feedback,
          strengths: feedback.strengths,
          areas_for_improvement: feedback.areas_for_improvement,
          suggested_next_steps: feedback.suggested_next_steps,
          communication_score: feedback.communication_score,
          content_score: feedback.content_score,
          confidence_score: feedback.confidence_score
        },
        preparation_analysis: feedback.preparation_analysis || {
          preparation_score: feedback.preparation_score || 70,
          business_insights: feedback.business_insights || [],
          solutions_proposed: feedback.solutions_proposed || [],
          problem_solving_approach: feedback.problem_solving_approach || 'Analysis unavailable',
          research_quality: [],
          strategic_thinking: [],
          missed_opportunities: []
        }
      }
    } else if (conversation && conversation.length > 0) {
      console.log('🔄 Generating fresh AI analysis for session:', sessionId)
      
      const interviewContext: InterviewContext = {
        interview_type: session.interview_type,
        communication_style: session.communication_style,
        difficulty_level: session.difficulty_level,
        resume_content: session.resumes?.parsed_content || '',
        job_content: session.job_descriptions?.job_content || ''
      }

      // Group conversation into Q&A pairs for analysis
      const qaPairs = []
      let currentQuestion = null
      let candidateResponses = []

      for (const turn of conversation) {
        if (turn.speaker === 'interviewer' && (turn.message_type === 'main_question' || turn.message_type === 'follow_up')) {
          if (currentQuestion && candidateResponses.length > 0) {
            qaPairs.push({
              question: currentQuestion,
              responses: candidateResponses
            })
          }
          currentQuestion = turn
          candidateResponses = []
        } else if (turn.speaker === 'candidate' && turn.message_type === 'response') {
          candidateResponses.push(turn)
        }
      }
      
      if (currentQuestion && candidateResponses.length > 0) {
        qaPairs.push({
          question: currentQuestion,
          responses: candidateResponses
        })
      }

      // Analyze each Q&A pair
      const responseAnalyses = []
      for (const pair of qaPairs) {
        const combinedResponse = pair.responses.map(r => r.message_text).join(' ')
        const analysis = await analyzeResponseQuality(
          pair.question.message_text,
          combinedResponse,
          interviewContext
        )
        analysis.response_id = pair.question.related_main_question_id || `turn_${pair.question.turn_number}`
        responseAnalyses.push(analysis)
      }

      // Analyze resume utilization
      const resumeAnalysis = await analyzeResumeUtilization(
        interviewContext.resume_content,
        conversation,
        interviewContext
      )

      // Analyze job fit
      const jobFitAnalysis = await analyzeJobFit(
        interviewContext.job_content,
        conversation,
        interviewContext
      )

      // Analyze preparation and problem-solving
      const preparationAnalysis = await analyzePreparationAndProblemSolving(
        conversation,
        interviewContext,
        interviewContext.resume_content,
        interviewContext.job_content
      )

      // Generate overall coaching feedback
      const coachingFeedback = await generateCoachingFeedback(
        conversation,
        interviewContext,
        responseAnalyses,
        resumeAnalysis,
        jobFitAnalysis
      )

      aiAnalysis = {
        response_analyses: responseAnalyses,
        resume_analysis: resumeAnalysis,
        job_fit_analysis: jobFitAnalysis,
        coaching_feedback: coachingFeedback,
        preparation_analysis: preparationAnalysis
      }
      
      // Create service role client for database writes (bypasses RLS)
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      
      // Store the analysis results in the database for future use
      const storageSuccess = await storeAnalysisResults(serviceSupabase, sessionId, aiAnalysis)
      
      if (storageSuccess) {
        // Calculate and store overall score
        const overallScore = Math.round((
          aiAnalysis.coaching_feedback.communication_score +
          aiAnalysis.coaching_feedback.content_score +
          aiAnalysis.coaching_feedback.confidence_score +
          aiAnalysis.preparation_analysis.preparation_score
        ) / 4)
        
        await serviceSupabase
          .from('interview_sessions')
          .update({ overall_score: overallScore })
          .eq('id', sessionId)
          
        console.log('✅ Overall score calculated and stored:', overallScore)
      } else {
        console.error('⚠️ WARNING: Analysis generated but failed to save to database for session:', sessionId)
      }
    }

    // Transform conversation data for the response
    const enhancedResponses = transformedResponses.map((response, index) => {
      const analysis = aiAnalysis?.response_analyses?.[index]
      return {
        ...response,
        analysis: analysis || null
      }
    })

    // Use freshly calculated overall score, not potentially stale database value
    const freshOverallScore = aiAnalysis?.coaching_feedback ? Math.round((
      aiAnalysis.coaching_feedback.communication_score +
      aiAnalysis.coaching_feedback.content_score +
      aiAnalysis.coaching_feedback.confidence_score +
      aiAnalysis.preparation_analysis.preparation_score
    ) / 4) : null
    
    // Include calculated overall score in session data
    const sessionWithScore = {
      ...session,
      overall_score: freshOverallScore || session.overall_score
    }

    return NextResponse.json({
      session: sessionWithScore,
      feedback: aiAnalysis?.coaching_feedback || feedback || {
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
      responses: enhancedResponses,
      ai_analysis: aiAnalysis
    })

  } catch (error) {
    console.error('Results fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}