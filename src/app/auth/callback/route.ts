import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    try {
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
        }
      )
      
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(`${requestUrl.origin}?error=auth_failed`)
      }
    } catch (error) {
      console.error('Auth callback exception:', error)
      return NextResponse.redirect(`${requestUrl.origin}?error=auth_exception`)
    }
  }

  // Redirect to home page after successful auth
  return NextResponse.redirect(requestUrl.origin)
}
