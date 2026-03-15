import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/welcome-email'

async function fireWelcomeEmail(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const ageMs = Date.now() - new Date(user.created_at).getTime()
      if (ageMs < 10_000) sendWelcomeEmail(user.email, user.user_metadata?.full_name).catch(() => {})
    }
  } catch {}
}

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  const origin = rawOrigin.replace('0.0.0.0', 'localhost')
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const error      = searchParams.get('error')
  const next       = searchParams.get('next') ?? '/'

  console.log('[auth/callback] url:', request.url, '| code:', !!code, '| token_hash:', !!token_hash, '| type:', type, '| error:', error)

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${error}`)
  }

  const supabase = await createClient()

  // Magic link / OTP flow — newer Supabase uses token_hash + type
  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    console.log('[auth/callback] verifyOtp error:', otpError?.message ?? 'none')
    if (!otpError) {
      await fireWelcomeEmail(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // OAuth / PKCE flow — Google sign-in uses code
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchangeCodeForSession error:', exchangeError?.message ?? 'none')
    if (!exchangeError) {
      await fireWelcomeEmail(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
}
