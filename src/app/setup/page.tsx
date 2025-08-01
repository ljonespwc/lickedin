'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, Link, CheckCircle } from "lucide-react"

const Setup = () => {
  const router = useRouter()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState<string>('')
  const [jobUrl, setJobUrl] = useState('')
  const [jobText, setJobText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string>('')
  const [validationResults, setValidationResults] = useState<{
    isValid: boolean
    reason?: string
    contentPreview?: string
    scrapingError?: string
    source?: string
  } | null>(null)
  const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null)

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
      } else {
        setSession(session) // Store session in state for button handler
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        router.push('/')
        setSession(null)
      } else {
        setSession(session) // Update session state on auth changes
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const processingSteps = [
    "Analyzing your background and job requirements...",
    "Resume parsed successfully",
    "Extracting job requirements...",
    "Validating job description quality...",
    "Setup complete - ready for customization"
  ]

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setError('')
    setResumeFile(file)

    // Parse text files on client, PDFs on server
    try {
      if (file.type === 'text/plain') {
        const text = await file.text()
        setResumeText(text)
      } else if (file.type === 'application/pdf') {
        // PDF will be processed on server
        setResumeText('') // Clear any previous text
      } else {
        setError('Please upload a TXT or PDF file')
        setResumeFile(null)
      }
    } catch (err) {
      setError('Error reading file. Please try again.')
      setResumeFile(null)
      console.error('File reading error:', err)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const handleFetchJobDetails = async () => {
    console.log('🔵 Fetch Job Details button clicked')
    
    if (!resumeFile || (!jobUrl && !jobText)) {
      console.log('❌ Missing required fields')
      return
    }
    
    if (isProcessing) {
      console.log('❌ Already processing, skipping')
      return
    }
    
    // Use stored session from page-level auth check (avoids hanging getSession() call)
    console.log('🔍 Using stored session:', !!session)
    
    if (!session?.user) {
      console.log('❌ No stored session, redirecting')
      setError('Authentication session expired. Please refresh the page.')
      router.push('/')
      return
    }

    const accessToken = session.access_token
    if (!accessToken) {
      console.log('❌ No access token available')
      setError('Authentication token missing. Please refresh the page.')
      return
    }
    
    console.log('✅ Got access token:', !!accessToken)
    
    console.log('🚀 Starting processing...')
    setIsProcessing(true)
    setProcessingStep(0)
    setError('')
    
    try {
      // Create form data for file upload
      const formData = new FormData()
      formData.append('resume', resumeFile)
      formData.append('jobUrl', jobUrl)
      formData.append('jobText', jobText)
      formData.append('resumeText', resumeText)

      // Call API to process resume and job URL (same as working pages)
      const response = await fetch('/api/setup/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData,
        credentials: 'include'
      })
      
      console.log('📡 API response:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to process files')
      }

      const responseData = await response.json()
      
      // Store validation results from API response
      if (responseData.jobValidation) {
        setValidationResults(responseData.jobValidation)
      }

      // Simulate processing steps for better UX
      const interval = setInterval(() => {
        setProcessingStep(prev => {
          const newStep = prev < processingSteps.length - 1 ? prev + 1 : prev
          
          if (newStep >= processingSteps.length - 1) {
            console.log('✅ Processing complete!')
            clearInterval(interval)
            setIsProcessing(false)
            setIsComplete(true)
          }
          
          return newStep
        })
      }, 1500)

    } catch (error) {
      console.error('Fetch job details error:', error)
      setError('Failed to process files. Please try again.')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Setup Your Interview</h1>
          <p className="text-muted-foreground">Step 1 of 2: Upload Files</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Resume Upload */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="text-primary" size={20} />
                  <h3 className="font-medium">Resume</h3>
                </div>
                
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto mb-4 text-muted-foreground" size={32} />
                  <p className="text-muted-foreground mb-2">
                    {isDragActive ? 'Drop the file here...' : 'Drop TXT or PDF file here'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  <Button variant="outline">
                    Browse Files
                  </Button>
                </div>
                
                {resumeFile && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle size={16} />
                    <span className="text-sm">{resumeFile.name} (uploaded)</span>
                  </div>
                )}

                {error && (
                  <div className="text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>

              {/* Job Description */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Link className="text-primary" size={20} />
                  <h3 className="font-medium">Job Description</h3>
                </div>
                
                <div className="space-y-4">
                  {/* Option 1: URL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Option 1: Paste Job URL</label>
                    <Input
                      placeholder="https://company.com/jobs/123"
                      value={jobUrl}
                      onChange={(e) => {
                        setJobUrl(e.target.value)
                        if (e.target.value && jobText) {
                          setJobText('') // Clear text if URL is entered
                          setIsComplete(false) // Reset completion state when switching input methods
                        }
                        setValidationResults(null) // Clear validation when input changes
                        setError('') // Clear any previous errors
                      }}
                      className="h-12"
                      disabled={!!jobText && jobText.trim().length > 0}
                    />
                  </div>
                  
                  {/* OR Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">OR</span>
                    </div>
                  </div>
                  
                  {/* Option 2: Manual Text */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Option 2: Paste Job Description</label>
                    <Textarea
                      placeholder="Paste the full job description here..."
                      value={jobText}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value.length <= 7500) {
                          setJobText(value)
                          if (value && jobUrl) {
                            setJobUrl('') // Clear URL if text is entered
                            setIsComplete(false) // Reset completion state when switching input methods
                          }
                          setValidationResults(null) // Clear validation when input changes
                          setError('') // Clear any previous errors
                        } else {
                          setError('Job description is too long. Please limit to 7500 characters.')
                        }
                      }}
                      className="min-h-[120px] resize-none"
                      disabled={!!jobUrl && jobUrl.trim().length > 0}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      <span className={jobText.length > 7500 ? 'text-red-500' : ''}>
                        {jobText.length}/7500 characters
                      </span>
                    </div>
                  </div>
                  
                  {/* Success indicators */}
                  {jobUrl && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle size={16} />
                      <span className="text-sm">Job URL ready for processing</span>
                    </div>
                  )}
                  
                  {jobText && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle size={16} />
                      <span className="text-sm">Job description ready ({jobText.length} characters)</span>
                    </div>
                  )}
                  
                  <Button 
                    type="button"
                    onClick={handleFetchJobDetails}
                    className="w-full"
                    disabled={!resumeFile || !(jobUrl || jobText) || isProcessing || (isComplete && validationResults?.isValid)}
                  >
                    {isProcessing ? 'Processing...' : (jobText ? 'Process Job Description' : 'Fetch Job Details')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {(isProcessing || isComplete) && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <h3 className="font-medium">AI Processing Status</h3>
              </div>
              
              <div className="space-y-3">
                {processingSteps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    {index <= processingStep ? (
                      <CheckCircle className="text-green-600" size={16} />
                    ) : (
                      <div className="w-4 h-4 border-2 border-muted rounded-full"></div>
                    )}
                    <span className={index <= processingStep ? "text-foreground" : "text-muted-foreground"}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              
              {isProcessing && (
                <Progress value={(processingStep + 1) / processingSteps.length * 100} className="mt-4" />
              )}
              
              {/* Validation Results - Only show for warnings/errors */}
              {validationResults && isComplete && !validationResults.isValid && (
                <div className="mt-4 p-4 rounded-lg border">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-amber-600">
                      <div className="w-4 h-4 border-2 border-amber-600 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">Job description needs attention</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      {validationResults.reason}
                    </p>
                    {validationResults.scrapingError && (
                      <p className="text-xs text-muted-foreground ml-6">
                        Scraping error: {validationResults.scrapingError}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground ml-6">
                      Please re-enter the job description to continue.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            disabled={!isComplete || !validationResults?.isValid}
            className="px-8"
            onClick={() => router.push('/setup/customize')}
          >
            Continue to Step 2 →
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Setup