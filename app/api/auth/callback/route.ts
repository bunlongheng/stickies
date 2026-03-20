import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/welcome-email'

export async function GET(request: NextRequest) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  const origin     = rawOrigin.replace('0.0.0.0', 'localhost')
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const error      = searchParams.get('error')
  const next       = searchParams.get('next') ?? '/'

  console.log('[auth/callback] origin:', origin, '| code:', !!code, '| token_hash:', !!token_hash, '| type:', type, '| error:', error)

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error)}`)
  }

  // Build the redirect response first — we'll set cookies directly on it
  // so they survive the 307/302 redirect (Next.js cookies() API doesn't attach to redirects).
  const redirectOk   = NextResponse.redirect(`${origin}${next}`)
  const redirectFail = NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)

  function makeSupabase(response: NextResponse) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )
  }

  // Magic link / OTP — token_hash + type
  if (token_hash && type) {
    const supabase = makeSupabase(redirectOk)
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    console.log('[auth/callback] verifyOtp error:', otpError?.message ?? 'none')
    if (!otpError) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          const ageMs = Date.now() - new Date(user.created_at).getTime()
          if (ageMs < 10_000) sendWelcomeEmail(user.email, user.user_metadata?.full_name).catch(() => {})
        }
      } catch {}
      return redirectOk
    }
    return redirectFail
  }

  // OAuth / PKCE — Google sign-in
  if (code) {
    const supabase = makeSupabase(redirectOk)
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchangeCodeForSession error:', exchangeError?.message ?? 'none')
    if (!exchangeError) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          const ageMs = Date.now() - new Date(user.created_at).getTime()
          if (ageMs < 10_000) sendWelcomeEmail(user.email, user.user_metadata?.full_name).catch(() => {})
        }
      } catch {}
      return redirectOk
    }
    return redirectFail
  }

  return redirectFail
}
