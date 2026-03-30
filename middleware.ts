import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/api/')) {
    const noteId = request.nextUrl.searchParams.get('noteId')
    if (noteId) {
      // Only redirect to share page if accessing from outside the app (no auth cookies at all)
      // If cookies exist but session expired, send to login to re-auth
      const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('auth-token') || c.name.includes('sb-'))
      if (!hasAuthCookie) {
        const url = request.nextUrl.clone()
        url.pathname = '/share'
        url.search = `?noteId=${encodeURIComponent(noteId)}`
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon\\.svg|apple-icon\\.svg|api/auth/callback|share|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
