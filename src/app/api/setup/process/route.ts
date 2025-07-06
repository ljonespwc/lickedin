import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parsePDF } from '@/lib/pdf-parser'

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

    // Extract text from resume file
    let extractedText = ''
    
    try {
      if (resumeFile.type === 'text/plain') {
        // Handle text files
        extractedText = resumeText || ''
      } else if (resumeFile.type === 'application/pdf') {
        // Handle PDF files
        const arrayBuffer = await resumeFile.arrayBuffer()
        extractedText = await parsePDF(Buffer.from(arrayBuffer))
      } else {
        return NextResponse.json(
          { error: 'Unsupported file type. Please upload a TXT or PDF file.' },
          { status: 400 }
        )
      }
    } catch (error) {
      console.error('File parsing error:', error)
      return NextResponse.json(
        { error: 'Failed to extract text from resume. Please try uploading a different file.' },
        { status: 400 }
      )
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from resume. Please ensure the file contains readable text.' },
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
        parsed_content: extractedText,
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
        
        // Clean up the HTML content more thoroughly
        jobContent = html
          // Remove script and style tags completely
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          // Remove HTML tags
          .replace(/<[^>]*>/g, ' ')
          // Remove JavaScript artifacts and function definitions
          .replace(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*\}/g, '')
          // Remove window object assignments
          .replace(/window\.[\w.]+\s*=\s*[^;]+;/g, '')
          // Remove common web artifacts
          .replace(/\b(getDfd|lazyloader|tracking|impressionTracking|ingraphTracking|appDetection|pemTracking)\b[^;]*;?/g, '')
          // Clean up whitespace
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim()
      }
    } catch (error) {
      console.error('Job scraping error:', error)
      // Continue with limited info if scraping fails
      jobContent = `Job posting from ${jobUrl}`
    }

    // Step 3: Store job description
    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        url: jobUrl,
        job_content: jobContent.substring(0, 10000) // Increased limit for cleaned content
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

    // Step 4: Return success - questions will be generated later during interview creation
    return NextResponse.json({
      success: true,
      resumeId: resumeData.id,
      jobDescriptionId: jobData.id,
      message: 'Resume and job description processed successfully. Questions will be generated during interview setup.'
    })

  } catch (error) {
    console.error('Setup processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}