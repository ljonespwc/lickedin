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
    const formData = await request.formData()
    const resumeFile = formData.get('resume') as File
    const jobUrl = formData.get('jobUrl') as string
    const resumeText = formData.get('resumeText') as string

    if (!resumeFile || !jobUrl) {
      return NextResponse.json(
        { error: 'Resume file and job URL are required' },
        { status: 400 }
      )
    }

    // For now, only support text files - PDF parsing will be added later
    if (resumeFile.type === 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF parsing is temporarily disabled. Please upload a text file (.txt) instead.' },
        { status: 400 }
      )
    }

    if (!resumeText) {
      return NextResponse.json(
        { error: 'Could not extract text from resume' },
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

    // Step 1: Store resume data
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        filename: resumeFile.name,
        file_url: '', // Will be populated when we implement file storage
        parsed_content: resumeText,
        file_size_bytes: resumeFile.size
      })
      .select()
      .single()

    if (resumeError) {
      console.error('Resume storage error:', resumeError)
      return NextResponse.json(
        { error: 'Failed to store resume' },
        { status: 500 }
      )
    }

    // Step 2: Scrape and analyze job description
    let jobContent = ''
    let companyName = ''
    let jobTitle = ''
    
    try {
      // For now, we'll use a simple approach to extract job info
      // In production, you'd want a more robust scraping solution
      const response = await fetch(jobUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LickedIn-Interviews/1.0)'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        // Basic extraction - this would need to be more sophisticated
        jobContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        
        // Try to extract company and job title from URL or content
        const urlParts = new URL(jobUrl)
        companyName = urlParts.hostname.split('.')[0] || 'Company'
        jobTitle = 'Position' // Would extract from content in production
      }
    } catch (error) {
      console.error('Job scraping error:', error)
      // Continue with limited info if scraping fails
      jobContent = `Job posting from ${jobUrl}`
      companyName = 'Company'
      jobTitle = 'Position'
    }

    // Step 3: Store job description
    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        url: jobUrl,
        company_name: companyName,
        job_title: jobTitle,
        job_content: jobContent.substring(0, 5000) // Limit content length
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job description storage error:', jobError)
      return NextResponse.json(
        { error: 'Failed to store job description' },
        { status: 500 }
      )
    }

    // Step 4: Generate initial interview questions using OpenAI
    try {
      const questionPrompt = `
Based on this resume and job description, generate 5 interview questions that would be appropriate for this role.

Resume Summary:
${resumeText.substring(0, 1000)}

Job Description:
${jobContent.substring(0, 1000)}

Company: ${companyName}
Position: ${jobTitle}

Please generate questions that are:
1. Relevant to the specific role and company
2. Based on the candidate's background
3. Mix of behavioral and technical questions
4. Appropriate difficulty level

Return the questions in JSON format:
{
  "questions": [
    {
      "text": "question text",
      "type": "behavioral|technical|situational",
      "expectedPoints": ["key point 1", "key point 2"]
    }
  ]
}
`

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert interviewer who creates personalized interview questions."
          },
          {
            role: "user",
            content: questionPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })

      const questionsData = JSON.parse(completion.choices[0].message.content || '{"questions": []}')
      
      return NextResponse.json({
        success: true,
        resumeId: resumeData.id,
        jobDescriptionId: jobData.id,
        questions: questionsData.questions,
        companyName,
        jobTitle
      })

    } catch (openaiError) {
      console.error('OpenAI error:', openaiError)
      // Return success even if question generation fails
      return NextResponse.json({
        success: true,
        resumeId: resumeData.id,
        jobDescriptionId: jobData.id,
        questions: [],
        companyName,
        jobTitle,
        warning: 'Question generation failed, but files were processed successfully'
      })
    }

  } catch (error) {
    console.error('Setup processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}