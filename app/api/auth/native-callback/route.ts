import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/native-callback
 * OAuth callback for the native macOS app.
 * Exchanges the code for a session, then redirects to stickiesnative:// with tokens.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return NextResponse.json({ error: 'No code' }, { status: 400 })
    }

    const response = NextResponse.json({})
    const supabase = createServerClient(
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.session) {
        return NextResponse.json({ error: error?.message || 'Failed to exchange code' }, { status: 400 })
    }

    // Redirect to native app with tokens
    const nativeURL = `stickiesnative://auth/callback?access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}&email=${encodeURIComponent(data.session.user.email || '')}`

    return NextResponse.redirect(nativeURL)
}
