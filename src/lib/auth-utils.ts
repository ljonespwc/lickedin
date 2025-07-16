import { supabase } from '@/lib/supabase'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { User } from '@supabase/supabase-js'

// Centralized sign out handler with proper error handling and redirect
export async function handleSignOut(
  router: AppRouterInstance,
  setUserState?: (user: User | null) => void
): Promise<boolean> {
  console.log('🔓 Starting sign out process...')
  
  try {
    // Clear user state immediately to avoid UI flickering
    if (setUserState) {
      setUserState(null)
    }

    // Clear Supabase-specific localStorage only
    if (typeof window !== 'undefined') {
      // Clear Supabase-specific storage - the actual keys start with 'sb-'
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => {
        console.log(`🗑️ Removing localStorage key: ${key}`)
        localStorage.removeItem(key)
      })
      
      console.log('🗑️ Cleared Supabase localStorage keys')
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('❌ Sign out error:', error)
      return false
    }

    console.log('✅ Successfully signed out from Supabase')

    // SIMPLE: Just redirect to home page immediately
    console.log('🔄 Redirecting to home page...')
    window.location.href = '/'
    
    return true
  } catch (error) {
    console.error('❌ Sign out exception:', error)
    return false
  }
}

// Helper function for pages that don't need user state management
export async function handleSignOutSimple(router: AppRouterInstance): Promise<boolean> {
  console.log('🔓 handleSignOutSimple called')
  return handleSignOut(router)
}