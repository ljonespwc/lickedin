'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMostRecentInterview } from '@/lib/interview-utils'
import { handleSignOut } from '@/lib/auth-utils'
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'

interface HeaderProps {
  currentSessionId?: string
}

export const Header = ({ currentSessionId }: HeaderProps) => {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [mostRecentInterviewId, setMostRecentInterviewId] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Load user and recent interview
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const recentInterviewId = await getMostRecentInterview(session.user.id)
        setMostRecentInterviewId(recentInterviewId)
      }
    }
    
    loadUserData()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const recentInterviewId = await getMostRecentInterview(session.user.id)
        setMostRecentInterviewId(recentInterviewId)
      } else {
        setMostRecentInterviewId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOutClick = async () => {
    if (isSigningOut) return
    
    setIsSigningOut(true)
    
    try {
      // Use the proper auth-utils function that clears localStorage
      const success = await handleSignOut(router, setUser)
      
      if (success) {
        // Clear local state
        setMostRecentInterviewId(null)
      } else {
        // Reset state on error
        setIsSigningOut(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      // Reset state on error
      setIsSigningOut(false)
    }
  }

  const handleLogoClick = () => {
    router.push('/')
  }

  const handleLatestResults = () => {
    if (mostRecentInterviewId) {
      router.push(`/results/${mostRecentInterviewId}`)
    }
  }

  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <button 
            type="button" 
            onClick={handleLogoClick}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Image 
              src="/lickedin-logo.png" 
              alt="LickedIn Logo" 
              width={83} 
              height={40} 
              className="h-10"
            />
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          {user?.email && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
          )}
          
          {mostRecentInterviewId && mostRecentInterviewId !== currentSessionId && (
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              onClick={handleLatestResults}
              className="flex items-center gap-2"
            >
              <FileText size={16} />
              Latest Results
            </Button>
          )}
          
          {user && (
            <Button 
              type="button"
              variant="outline" 
              onClick={handleSignOutClick}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}