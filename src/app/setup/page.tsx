'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, Link, CheckCircle, User as UserIcon } from "lucide-react"
import Image from 'next/image'

const Setup = () => {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState<string>('')
  const [jobUrl, setJobUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string>('')

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      
      if (!session?.user) {
        router.push('/')
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.push('/')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const processingSteps = [
    "Analyzing your background and job requirements...",
    "Resume parsed successfully",
    "Extracting job requirements...",
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
    if (!resumeFile || !jobUrl) return
    
    // Double-check authentication before making API call
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      setError('Please sign in to continue')
      return
    }
    
    // Get the access token to pass in headers
    const accessToken = session.access_token
    
    setIsProcessing(true)
    setProcessingStep(0)
    setError('')
    
    try {
      // Create form data for file upload
      const formData = new FormData()
      formData.append('resume', resumeFile)
      formData.append('jobUrl', jobUrl)
      formData.append('resumeText', resumeText)

      // Call API to process resume and job URL
      const response = await fetch('/api/setup/process', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to process files')
      }

      await response.json()

      // Simulate processing steps for better UX
      const interval = setInterval(() => {
        setProcessingStep(prev => {
          if (prev < processingSteps.length - 1) {
            return prev + 1
          } else {
            clearInterval(interval)
            setIsProcessing(false)
            setIsComplete(true)
            return prev
          }
        })
      }, 1500)

    } catch {
      setError('Failed to process files. Please try again.')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Image 
              src="/lickedin-logo.png" 
              alt="LickedIn Logo" 
              width={101} 
              height={40} 
              className="h-10"
            />
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <UserIcon size={20} />
            <span>{user?.email || '[Profile▼]'}</span>
          </div>
        </div>
      </header>

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
                  <Input
                    placeholder="https://company.com/jobs/123"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    className="h-12"
                  />
                  <p className="text-sm text-muted-foreground">Paste job URL here</p>
                  
                  {jobUrl && (
                    <Button 
                      onClick={handleFetchJobDetails}
                      className="w-full"
                      disabled={!resumeFile || isProcessing}
                    >
                      Fetch Job Details
                    </Button>
                  )}
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
            </CardContent>
          </Card>
        )}

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            disabled={!isComplete}
            className="px-8"
            onClick={() => router.push('/setup/customize')}
          >
            Continue to Setup →
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Setup