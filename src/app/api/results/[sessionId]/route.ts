import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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

interface PointCoverageAnalysis {
  expected_point: string
  addressed: boolean
  score: number
  evidence: string
}

interface ScoringBreakdown {
  point_coverage_score: number
  depth_detail_score: number
  communication_score: number
  structure_score: number
}

interface ResponseAnalysis {
  response_id: string
  question_text: string
  response_text: string
  point_coverage_analysis: PointCoverageAnalysis[]
  scoring_breakdown: ScoringBreakdown
  overall_score: number
  difficulty_adjusted_score: number
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
  expectedAnswerPoints: string[],
  questionType: string,
  context: InterviewContext
): Promise<ResponseAnalysis> {
  // Create difficulty adjustment factor
  const difficultyLevel = parseInt(context.difficulty_level) || 5
  const difficultyContext = difficultyLevel <= 3 ? "LENIENT (Easy)" : 
                           difficultyLevel <= 6 ? "STANDARD (Medium)" : 
                           "STRICT (Hard)"
  
  const prompt = `You are an expert interview coach using a structured rubric to analyze a candidate's response.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level} (${difficultyContext} expectations)
- Question Type: ${questionType}

CANDIDATE'S RESUME:
${context.resume_content}

JOB REQUIREMENTS:
${context.job_content}

INTERVIEW QUESTION:
${questionText}

EXPECTED ANSWER POINTS (PRIMARY SCORING RUBRIC):
${expectedAnswerPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

CANDIDATE'S RESPONSE:
${responseText}

SCORING INSTRUCTIONS:

1. POINT COVERAGE ANALYSIS (40% of total score):
   - For each expected answer point, determine if candidate addressed it (true/false)
   - Score each addressed point 0-100 based on depth and quality
   - Provide specific evidence (quote) showing how they addressed it
   - Unaddressed points get score 0

2. DEPTH & DETAIL SCORE (25% of total score):
   - Specific examples and concrete details (0-100)
   - Quantified outcomes and measurable results (0-100)
   - Personal insights and reflection (0-100)

3. COMMUNICATION SCORE (20% of total score):
   - Clarity and structure of response (0-100)
   - Appropriate tone for interview type (0-100)
   - Professional communication style (0-100)

4. STRUCTURE SCORE (15% of total score):
   ${questionType === 'behavioral' ? 
     '- STAR methodology (Situation, Task, Action, Result) (0-100)' :
     '- Logical flow and organization (0-100)'}
   - Complete answer addressing the question (0-100)

DIFFICULTY ADJUSTMENTS:
- LENIENT (1-3): Accept general examples, be encouraging, +10 point boost
- STANDARD (4-6): Expect specific examples, standard expectations
- STRICT (7-10): Require detailed examples, quantified results, strategic insights

Calculate overall_score as weighted average: (point_coverage * 0.4) + (depth_detail * 0.25) + (communication * 0.2) + (structure * 0.15)
Apply difficulty adjustment to get difficulty_adjusted_score.

Respond with JSON only:`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert interview coach. Look for specific examples, measurable outcomes, and clear problem-solving progression in candidate responses.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "response_analysis",
          schema: {
            type: "object",
            properties: {
              point_coverage_analysis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    expected_point: { type: "string" },
                    addressed: { type: "boolean" },
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    evidence: { type: "string" }
                  },
                  required: ["expected_point", "addressed", "score", "evidence"]
                }
              },
              scoring_breakdown: {
                type: "object",
                properties: {
                  point_coverage_score: { type: "integer", minimum: 0, maximum: 100 },
                  depth_detail_score: { type: "integer", minimum: 0, maximum: 100 },
                  communication_score: { type: "integer", minimum: 0, maximum: 100 },
                  structure_score: { type: "integer", minimum: 0, maximum: 100 }
                },
                required: ["point_coverage_score", "depth_detail_score", "communication_score", "structure_score"]
              },
              overall_score: { type: "integer", minimum: 0, maximum: 100 },
              difficulty_adjusted_score: { type: "integer", minimum: 0, maximum: 100 },
              strengths: {
                type: "array",
                items: { type: "string" }
              },
              weaknesses: {
                type: "array",
                items: { type: "string" }
              },
              improvement_suggestions: {
                type: "array",
                items: { type: "string" }
              },
              keyword_alignment: {
                type: "array",
                items: { type: "string" }
              },
              missed_opportunities: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["point_coverage_analysis", "scoring_breakdown", "overall_score", "difficulty_adjusted_score", "strengths", "weaknesses", "improvement_suggestions", "keyword_alignment", "missed_opportunities"]
          }
        }
      },
      temperature: 0.1,
      max_tokens: 800
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(response)
    
    return {
      response_id: '',
      question_text: questionText,
      response_text: responseText,
      point_coverage_analysis: analysis.point_coverage_analysis || [],
      scoring_breakdown: analysis.scoring_breakdown || {
        point_coverage_score: 70,
        depth_detail_score: 70,
        communication_score: 75,
        structure_score: 70
      },
      overall_score: analysis.overall_score || 71,
      difficulty_adjusted_score: analysis.difficulty_adjusted_score || 71,
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
      point_coverage_analysis: expectedAnswerPoints.map(point => ({
        expected_point: point,
        addressed: false,
        score: 0,
        evidence: 'Analysis failed - could not determine coverage'
      })),
      scoring_breakdown: {
        point_coverage_score: 70,
        depth_detail_score: 70,
        communication_score: 75,
        structure_score: 70
      },
      overall_score: 71,
      difficulty_adjusted_score: 71,
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

  // Create difficulty adjustment factor
  const difficultyLevel = parseInt(context.difficulty_level) || 5
  const difficultyContext = difficultyLevel <= 3 ? "LENIENT (Easy)" : 
                           difficultyLevel <= 6 ? "STANDARD (Medium)" : 
                           "STRICT (Hard)"

  const prompt = `You are an expert career coach analyzing how well a candidate utilized their resume during an interview.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level} (${difficultyContext} expectations)

CANDIDATE'S RESUME:
${resumeContent}

CANDIDATE'S INTERVIEW RESPONSES:
${candidateResponses}

Analyze how effectively the candidate used their resume content during the interview. Consider:
1. Which skills from their resume were mentioned vs. omitted?
2. Which work experiences were referenced vs. missed?
3. What stories or achievements could they have shared but didn't?
4. How well did they tailor their resume content to the interview type?

DIFFICULTY ADJUSTMENTS:
- LENIENT (1-3): Accept general mentions of skills/experiences, be encouraging, +10 point boost
- STANDARD (4-6): Expect clear connections between resume and responses, standard expectations
- STRICT (7-10): Require detailed strategic use of resume content with specific examples

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
          content: "You are an expert career coach analyzing resume utilization."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "resume_analysis",
          schema: {
            type: "object",
            properties: {
              skills_mentioned: {
                type: "array",
                items: { type: "string" }
              },
              skills_missed: {
                type: "array",
                items: { type: "string" }
              },
              experiences_mentioned: {
                type: "array",
                items: { type: "string" }
              },
              experiences_missed: {
                type: "array",
                items: { type: "string" }
              },
              utilization_score: {
                type: "integer",
                minimum: 0,
                maximum: 100
              },
              missed_opportunities: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["skills_mentioned", "skills_missed", "experiences_mentioned", "experiences_missed", "utilization_score", "missed_opportunities"]
          }
        }
      },
      temperature: 0.1,
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

  // Create difficulty adjustment factor
  const difficultyLevel = parseInt(context.difficulty_level) || 5
  const difficultyContext = difficultyLevel <= 3 ? "LENIENT (Easy)" : 
                           difficultyLevel <= 6 ? "STANDARD (Medium)" : 
                           "STRICT (Hard)"

  const prompt = `You are an expert talent acquisition specialist analyzing how well a candidate's interview responses align with job requirements.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level} (${difficultyContext} expectations)

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

DIFFICULTY ADJUSTMENTS:
- LENIENT (1-3): Accept broad alignment and general connections, be encouraging, +10 point boost
- STANDARD (4-6): Expect clear job-relevant examples, standard expectations  
- STRICT (7-10): Require precise alignment with detailed role-specific demonstrations

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
          content: "You are an expert talent acquisition specialist analyzing job fit."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "job_fit_analysis",
          schema: {
            type: "object",
            properties: {
              requirements_covered: {
                type: "array",
                items: { type: "string" }
              },
              requirements_missed: {
                type: "array", 
                items: { type: "string" }
              },
              keyword_matches: {
                type: "array",
                items: { type: "string" }
              },
              fit_score: {
                type: "integer",
                minimum: 0,
                maximum: 100
              },
              gap_analysis: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["requirements_covered", "requirements_missed", "keyword_matches", "fit_score", "gap_analysis"]
          }
        }
      },
      temperature: 0.1,
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
        overall_feedback: aiAnalysis.coaching_feedback?.overall_feedback || 'Analysis completed',
        strengths: aiAnalysis.coaching_feedback?.strengths || [],
        areas_for_improvement: aiAnalysis.coaching_feedback?.areas_for_improvement || [],
        suggested_next_steps: aiAnalysis.coaching_feedback?.suggested_next_steps || [],
        confidence_score: aiAnalysis.coaching_feedback?.confidence_score || 0,
        communication_score: aiAnalysis.coaching_feedback?.communication_score || 0,
        content_score: aiAnalysis.coaching_feedback?.content_score || 0,
        preparation_score: aiAnalysis.preparation_analysis?.preparation_score || 0,
        business_insights: aiAnalysis.preparation_analysis?.business_insights || [],
        solutions_proposed: aiAnalysis.preparation_analysis?.solutions_proposed || [],
        problem_solving_approach: aiAnalysis.preparation_analysis?.problem_solving_approach || 'No analysis available',
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
      console.error('❌ Failed data summary:', {
        sessionId,
        hasOverallFeedback: !!aiAnalysis.coaching_feedback?.overall_feedback,
        hasStrengths: !!aiAnalysis.coaching_feedback?.strengths,
        hasAreasForImprovement: !!aiAnalysis.coaching_feedback?.areas_for_improvement,
        communicationScore: aiAnalysis.coaching_feedback?.communication_score,
        contentScore: aiAnalysis.coaching_feedback?.content_score,
        confidenceScore: aiAnalysis.coaching_feedback?.confidence_score,
        preparationScore: aiAnalysis.preparation_analysis?.preparation_score
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
Average Quality Score: ${responseAnalyses.reduce((sum, r) => sum + r.overall_score, 0) / responseAnalyses.length}
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
- Story structure and completeness of examples
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
          content: "You are an expert interview coach specializing in strategic thinking and preparation assessment. Focus on business insights, problem-solving approach, and demonstration of preparation through concrete examples."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coaching_feedback",
          schema: {
            type: "object",
            properties: {
              overall_feedback: {
                type: "string"
              },
              strengths: {
                type: "array",
                items: { type: "string" }
              },
              areas_for_improvement: {
                type: "array",
                items: { type: "string" }
              },
              suggested_next_steps: {
                type: "array",
                items: { type: "string" }
              },
              communication_score: {
                type: "integer",
                minimum: 0,
                maximum: 100
              },
              content_score: {
                type: "integer",
                minimum: 0,
                maximum: 100
              },
              confidence_score: {
                type: "integer",
                minimum: 0,
                maximum: 100
              }
            },
            required: ["overall_feedback", "strengths", "areas_for_improvement", "suggested_next_steps", "communication_score", "content_score", "confidence_score"]
          }
        }
      },
      temperature: 0.1,
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

  // Create difficulty adjustment factor
  const difficultyLevel = parseInt(context.difficulty_level) || 5
  const difficultyContext = difficultyLevel <= 3 ? "LENIENT (Easy)" : 
                           difficultyLevel <= 6 ? "STANDARD (Medium)" : 
                           "STRICT (Hard)"

  const prompt = `You are an expert interviewer analyzing a candidate's preparation and problem-solving demonstration.

INTERVIEW CONTEXT:
- Interview Type: ${context.interview_type}
- Communication Style: ${context.communication_style}
- Difficulty Level: ${context.difficulty_level} (${difficultyContext} expectations)

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

DIFFICULTY ADJUSTMENTS:
- LENIENT (1-3): Accept basic preparation and general insights, be encouraging, +10 point boost
- STANDARD (4-6): Expect solid research and clear problem-solving approach, standard expectations
- STRICT (7-10): Require deep strategic insights, innovative solutions, and sophisticated analysis

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
          content: "You are an expert interviewer evaluating preparation and problem-solving."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "preparation_analysis",
          schema: {
            type: "object",
            properties: {
              preparation_score: {
                type: "integer",
                minimum: 0,
                maximum: 100
              },
              business_insights: {
                type: "array",
                items: { type: "string" }
              },
              solutions_proposed: {
                type: "array",
                items: { type: "string" }
              },
              problem_solving_approach: {
                type: "string"
              },
              research_quality: {
                type: "array",
                items: { type: "string" }
              },
              strategic_thinking: {
                type: "array",
                items: { type: "string" }
              },
              missed_opportunities: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["preparation_score", "business_insights", "solutions_proposed", "problem_solving_approach", "research_quality", "strategic_thinking", "missed_opportunities"]
          }
        }
      },
      temperature: 0.1,
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
    const { data: feedback, error: feedbackError } = await supabase
      .from('interview_feedback')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    
    if (feedbackError && feedbackError.code !== 'PGRST116') { // PGRST116 = no rows found, which is expected
      console.error('❌ Feedback query error:', feedbackError)
    }
    
    console.log('🔍 Feedback query result:', {
      sessionId,
      hasFeedback: !!feedback,
      feedbackId: feedback?.id,
      hasAnalysisCompleted: !!feedback?.ai_analysis_completed_at,
      error: feedbackError?.code === 'PGRST116' ? 'No feedback found (expected)' : feedbackError?.message
    })

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
    
    // Check if we have cached analysis (more lenient check)
    const hasCachedAnalysis = feedback?.ai_analysis_completed_at && 
                             feedback?.response_analyses
    
    // Check if analysis is currently being generated (prevent concurrent generation)
    const analysisInProgress = feedback?.ai_analysis_completed_at === null && 
                              feedback?.response_analyses === null &&
                              feedback?.overall_feedback === 'ANALYSIS_IN_PROGRESS'
    
    console.log('🔍 Cached analysis check:', {
      sessionId,
      hasFeedback: !!feedback,
      hasCompletedAt: !!feedback?.ai_analysis_completed_at,
      hasResponseAnalyses: !!feedback?.response_analyses,
      hasResumeAnalysis: !!feedback?.resume_analysis,
      hasJobFitAnalysis: !!feedback?.job_fit_analysis,
      hasPreparationAnalysis: !!feedback?.preparation_analysis,
      hasCachedAnalysis,
      analysisInProgress
    })
    
    if (hasCachedAnalysis) {
      console.log('✅ Using cached AI analysis for session:', sessionId)
      
      // Map cached database analysis to aiAnalysis structure
      aiAnalysis = {
        response_analyses: feedback.response_analyses || [],
        resume_analysis: feedback.resume_analysis || {
          skills_mentioned: [],
          skills_missed: [],
          experiences_mentioned: [],
          experiences_missed: [],
          utilization_score: 0,
          missed_opportunities: []
        },
        job_fit_analysis: feedback.job_fit_analysis || {
          requirements_covered: [],
          requirements_missed: [],
          keyword_matches: [],
          fit_score: 0,
          gap_analysis: []
        },
        coaching_feedback: {
          overall_feedback: feedback.overall_feedback || '',
          strengths: feedback.strengths || [],
          areas_for_improvement: feedback.areas_for_improvement || [],
          suggested_next_steps: feedback.suggested_next_steps || [],
          communication_score: feedback.communication_score || 0,
          content_score: feedback.content_score || 0,
          confidence_score: feedback.confidence_score || 0
        },
        preparation_analysis: feedback.preparation_analysis || {
          preparation_score: feedback.preparation_score || 0,
          business_insights: [],
          solutions_proposed: [],
          problem_solving_approach: '',
          research_quality: [],
          strategic_thinking: [],
          missed_opportunities: []
        }
      }
    } else if (analysisInProgress) {
      console.log('⏳ Analysis already in progress for session:', sessionId)
      // Return a clear in-progress response for frontend to detect
      return NextResponse.json({
        session: session,
        feedback: {
          overall_feedback: "ANALYSIS_IN_PROGRESS",
          strengths: ["Analysis being generated..."],
          areas_for_improvement: ["Please wait..."],
          suggested_next_steps: ["Analysis will complete shortly"],
          confidence_score: 0,
          communication_score: 0,
          content_score: 0
        },
        responses: [],
        ai_analysis: null,
        analysis_status: "in_progress",
        analysis_message: "Your interview analysis is being generated. This usually takes 1-2 minutes."
      })
    } else if (conversation && conversation.length > 0) {
      console.log('🔄 Generating fresh AI analysis for session:', sessionId)
      
      // Mark analysis as in progress to prevent concurrent generation
      await supabase
        .from('interview_feedback')
        .upsert({
          session_id: sessionId,
          overall_feedback: 'ANALYSIS_IN_PROGRESS',
          ai_analysis_completed_at: null
        }, { onConflict: 'session_id' })
      
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
        
        // Fetch expected answer points and question type for this question
        let expectedAnswerPoints: string[] = []
        let questionType = 'general'
        
        if (pair.question.related_main_question_id) {
          try {
            const { data: questionData } = await supabase
              .from('interview_questions')
              .select('expected_answer_points, question_type')
              .eq('id', pair.question.related_main_question_id)
              .single()
            
            if (questionData) {
              expectedAnswerPoints = questionData.expected_answer_points || []
              questionType = questionData.question_type || 'general'
            }
          } catch (error) {
            console.error('Error fetching question data:', error)
            // Use fallback values
            expectedAnswerPoints = ['Relevant experience demonstration', 'Clear communication', 'Job alignment']
            questionType = 'general'
          }
        } else {
          // Fallback for questions without related_main_question_id
          expectedAnswerPoints = ['Clear response to question', 'Relevant examples', 'Professional communication']
          questionType = 'general'
        }
        
        const analysis = await analyzeResponseQuality(
          pair.question.message_text,
          combinedResponse,
          expectedAnswerPoints,
          questionType,
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
      
      
      // Store the analysis results in the database for future use
      const storageSuccess = await storeAnalysisResults(supabase, sessionId, aiAnalysis)
      
      if (storageSuccess) {
        // Calculate and store overall score
        const overallScore = Math.round((
          aiAnalysis.coaching_feedback.communication_score +
          aiAnalysis.coaching_feedback.content_score +
          aiAnalysis.coaching_feedback.confidence_score +
          aiAnalysis.preparation_analysis.preparation_score
        ) / 4)
        
        await supabase
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