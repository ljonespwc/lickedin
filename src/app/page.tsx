'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    }
    
    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Check your email for the magic link!')
        setEmail('')
      }
    } catch {
      setMessage('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setMessage('Signed out successfully!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          LickedIn Interviews
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-Powered Mock Interview Platform
        </p>
        
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          {user ? (
            // Authenticated state
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Welcome! 🎉
              </h2>
              <p className="text-gray-600 mb-4">
                You&apos;re signed in as: <br />
                <span className="font-medium">{user.email}</span>
              </p>
              <button
                onClick={handleSignOut}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            // Unauthenticated state
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Auth Test
              </h2>
              <p className="text-gray-600 mb-6">
                Test Supabase magic link authentication
              </p>
              
              <form onSubmit={handleMagicLink} className="space-y-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </button>
              </form>
            </div>
          )}
          
          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes('Error') 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
