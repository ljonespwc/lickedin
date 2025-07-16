import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parsePDF } from '@/lib/pdf-parser'

// Validate job description content quality
function validateJobContent(content: string): { isValid: boolean; reason?: string } {
  if (!content || content.length < 100) {
    return { isValid: false, reason: 'Content too short (less than 100 characters)' }
  }
  
  // Skip LinkedIn-specific validation - rely on general job keyword validation below
  
  // Check for job-related keywords - require multiple matches for better validation
  const jobKeywords = [
    /\b(role|position|job|career)\b/i,                    // Job titles
    /\b(responsibilities|duties|tasks)\b/i,               // Job functions  
    /\b(requirements|qualifications|skills|experience)\b/i, // Job criteria
    /\b(team|company|organization|department)\b/i,        // Work environment
    /\b(salary|benefits|compensation|remote|office)\b/i   // Job conditions
  ]
  
  const matchedCategories = jobKeywords.filter(regex => regex.test(content)).length
  
  if (matchedCategories < 2) {
    return { isValid: false, reason: 'Content appears to be incomplete or not a job posting (insufficient job-related keywords)' }
  }
  
  return { isValid: true }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const resumeFile = formData.get('resume') as File
    const jobUrl = formData.get('jobUrl') as string
    const jobText = formData.get('jobText') as string
    const resumeText = formData.get('resumeText') as string

    if (!resumeFile || (!jobUrl && !jobText)) {
      return NextResponse.json(
        { error: 'Resume file and either job URL or job description text are required' },
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

    // Get authentication token (same as working endpoints)
    const authHeader = request.headers.get('authorization')
    let accessToken: string | null = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    // Create Supabase client (same as working endpoints)
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
        // Set the access token if we have one (same as working endpoints)
        global: {
          headers: accessToken ? {
            Authorization: `Bearer ${accessToken}`
          } : {}
        }
      }
    )

    // Get current user (same as working endpoints)
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

    // Step 2: Get job description content (either from manual text or URL scraping)
    let jobContent = ''
    let scrapingError = ''
    
    if (jobText && jobText.trim()) {
      // Use manual job description text (no scraping needed)
      jobContent = jobText.trim()
      console.log('Using manual job description text')
    } else if (jobUrl) {
      // Scrape job description from URL
      try {
        // Use realistic browser headers to avoid bot detection
        const response = await fetch(jobUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        if (response.ok) {
          const html = await response.text()
          
          // Check if this is a LinkedIn job posting URL
          const isLinkedInJob = jobUrl.includes('linkedin.com/jobs')
          
          if (isLinkedInJob) {
            // LinkedIn-specific parsing: extract "About the job" content
            console.log('LinkedIn job detected - extracting job description section')
            
            // Look for job description content patterns
            const jobDescriptionPatterns = [
              /About the job([\s\S]*?)(?=Show more|Show less|Similar jobs|$)/i,
              /Job description([\s\S]*?)(?=Show more|Show less|Similar jobs|$)/i,
              /About The Role([\s\S]*?)(?=About You|You Might Thrive|What You'll|Why You Should|$)/i,
              /About the role([\s\S]*?)(?=About you|You might thrive|What you'll|Why you should|$)/i
            ]
            
            let extractedContent = ''
            for (const pattern of jobDescriptionPatterns) {
              const match = html.match(pattern)
              if (match && match[1].trim()) {
                extractedContent = match[1].trim()
                break
              }
            }
            
            // If no specific pattern found, try to extract main content section
            if (!extractedContent) {
              // Remove navigation and login elements, keep job content
              const cleanHtml = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
              
              // Extract text and look for job content after company name
              const textContent = cleanHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
              
              // Try to find job content after role title
              const roleMatch = textContent.match(/(?:About The Role|About the role|Job description|About the job)([\s\S]*?)(?:About You|You Might Thrive|What You'll|Why You Should|Similar jobs|$)/i)
              if (roleMatch) {
                extractedContent = roleMatch[1].trim()
              }
            }
            
            jobContent = extractedContent || html
          } else {
            // Non-LinkedIn: use existing general cleaning
            jobContent = html
          }
          
          // Apply general cleaning to all content
          jobContent = jobContent
            // Remove script and style tags completely
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            // Remove HTML tags but preserve spaces
            .replace(/<[^>]*>/g, ' ')
            // Remove JavaScript artifacts and function definitions
            .replace(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*\}/g, '')
            // Remove window object assignments
            .replace(/window\.[\w.]+\s*=\s*[^;]+;/g, '')
            // Remove LinkedIn-specific artifacts
            .replace(/\b(getDfd|lazyloader|tracking|impressionTracking|ingraphTracking|appDetection|pemTracking)\b[^;]*;?/g, '')
            // Remove common navigation/footer text
            .replace(/Skip to main content|Join now|Sign in|Privacy Policy|Cookie Policy/gi, '')
            // Clean up whitespace
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim()
        } else {
          scrapingError = `HTTP ${response.status}: ${response.statusText}`
          jobContent = `Job posting from ${jobUrl} (scraping failed: ${scrapingError})`
        }
      } catch (error) {
        console.error('Job scraping error:', error)
        if (error instanceof Error) {
          scrapingError = error.message
        } else {
          scrapingError = 'Unknown scraping error'
        }
        jobContent = `Job posting from ${jobUrl} (scraping failed: ${scrapingError})`
      }
    }

    // Step 3: Validate job content quality
    const validation = validateJobContent(jobContent)
    
    // Step 4: Store job description (even if validation fails, for debugging)
    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        url: jobUrl || 'Manual text input',
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

    // Step 5: Return success with validation status
    return NextResponse.json({
      success: true,
      resumeId: resumeData.id,
      jobDescriptionId: jobData.id,
      jobValidation: {
        isValid: validation.isValid,
        reason: validation.reason,
        contentPreview: jobContent.substring(0, 200),
        scrapingError: scrapingError || null,
        source: jobText ? 'manual_text' : 'url_scraping'
      },
      message: validation.isValid 
        ? `Resume and job description processed successfully${jobText ? ' (manual text)' : ' (URL scraping)'}. Questions will be generated during interview setup.`
        : `Resume processed successfully. Job description may need review: ${validation.reason}`
    })

  } catch (error) {
    console.error('Setup processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}