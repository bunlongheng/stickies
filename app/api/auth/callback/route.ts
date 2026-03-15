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

  // In production behind a reverse proxy (Vercel etc.), construct correct origin
  const forwardedHost  = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : rawOrigin.replace('0.0.0.0', 'localhost')

  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const error      = searchParams.get('error')
  const next       = searchParams.get('next') ?? '/'

  console.log('[auth/callback] origin:', origin, '| code:', !!code, '| token_hash:', !!token_hash, '| type:', type, '| error:', error)

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error)}`)
  }

  const supabase = await createClient()

  // Magic link / OTP flow — token_hash + type (no PKCE cookie needed)
  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    console.log('[auth/callback] verifyOtp error:', otpError?.message ?? 'none')
    if (!otpError) {
      await fireWelcomeEmail(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.log('[auth/callback] verifyOtp failed, falling through to code check')
  }

  // OAuth / PKCE flow — Google + magic links when verifier cookie is present
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchangeCodeForSession error:', exchangeError?.message ?? 'none')
    if (!exchangeError) {
      await fireWelcomeEmail(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  console.log('[auth/callback] all methods failed — redirecting to sign-in')
  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
}
