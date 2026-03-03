import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/welcome-email'

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  const origin = rawOrigin.replace('0.0.0.0', 'localhost')
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const next  = searchParams.get('next') ?? '/'

  console.log('[auth/callback] url:', request.url, '| origin:', origin, '| code:', !!code, '| error:', error)

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${error}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchangeError:', exchangeError?.message ?? 'none', '| redirecting to:', `${origin}${next}`)

    if (!exchangeError) {
      // Fire welcome email for brand-new users (created within last 10 seconds)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          const ageMs = Date.now() - new Date(user.created_at).getTime()
          if (ageMs < 10_000) {
            sendWelcomeEmail(user.email, user.user_metadata?.full_name).catch(() => {})
          }
        }
      } catch {}

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
}
