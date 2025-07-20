'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { handleSmartResultsNavigation } from '@/lib/interview-utils'
import { handleSignOut } from '@/lib/auth-utils'
import { Button } from "@/components/ui/button"
import { FileText, BarChart3 } from "lucide-react"
import Image from 'next/image'
import type { User, Session } from '@supabase/supabase-js'

interface HeaderProps {
  currentSessionId?: string // Keep for potential future use
}

export const Header = ({ currentSessionId }: HeaderProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = currentSessionId // Acknowledge unused prop
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isLoadingResults, setIsLoadingResults] = useState(false)

  // Load user authentication state
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setSession(session) // Cache session for button handlers
    }
    
    loadUserData()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      setSession(session) // Cache session for button handlers
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOutClick = async () => {
    if (isSigningOut) return
    
    setIsSigningOut(true)
    
    try {
      // Use the proper auth-utils function that clears localStorage
      const success = await handleSignOut(router, setUser)
      
      if (!success) {
        // Reset state on error
        setIsSigningOut(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      // Reset state on error
      setIsSigningOut(false)
    }
  }

  const handleSmartResults = async () => {
    if (!user || !session || isLoadingResults) return
    
    setIsLoadingResults(true)
    
    try {
      // Use cached session instead of calling getSession()
      if (!session?.access_token) {
        router.push('/')
        return
      }

      const result = await handleSmartResultsNavigation(user.id, session.access_token)
      
      if (result.success) {
        router.push(result.route)
      }
    } catch (error) {
      console.error('Error handling smart results:', error)
      // Don't show alert, just log the error
    } finally {
      setIsLoadingResults(false)
    }
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Image 
            src="/lickedin-logo.png" 
            alt="LickedIn Logo" 
            width={83} 
            height={40} 
            className="h-10"
          />
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              onClick={handleDashboard}
              className="flex items-center gap-2"
            >
              <BarChart3 size={16} />
              Dashboard
            </Button>
          )}
          
          {user && (
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              onClick={handleSmartResults}
              disabled={isLoadingResults}
              className="flex items-center gap-2"
            >
              <FileText size={16} />
              {isLoadingResults ? 'Loading...' : 'Latest Results'}
            </Button>
          )}
          
          {user?.email && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
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