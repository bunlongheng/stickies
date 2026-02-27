'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function SignInContent() {
  const searchParams = useSearchParams()
  const errorParam   = searchParams.get('error')
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')

  async function signIn(provider: 'apple' | 'google') {
    setLoading(provider)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${siteUrl}/api/auth/callback`,
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : undefined,
      },
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-4">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .note-float { animation: float 4s ease-in-out infinite; }
        .fade-up    { animation: fadeUp 0.5s ease forwards; }
        .fade-up-2  { animation: fadeUp 0.5s ease 0.1s forwards; opacity: 0; }
        .fade-up-3  { animation: fadeUp 0.5s ease 0.2s forwards; opacity: 0; }
        .btn-apple:hover  { background: #1a1a1a !important; }
        .btn-google:hover { background: #2a2a2e !important; }
      `}</style>

      {/* Floating sticky notes (decoration) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {[
          { top: '12%', left: '8%',  color: '#FF9500', rotate: '-8deg',  scale: '0.7', delay: '0s'   },
          { top: '20%', right: '10%', color: '#007AFF', rotate: '6deg',  scale: '0.6', delay: '0.8s' },
          { top: '65%', left: '6%',  color: '#34C759', rotate: '10deg',  scale: '0.5', delay: '1.6s' },
          { top: '70%', right: '8%', color: '#FF2D55', rotate: '-5deg',  scale: '0.65',delay: '0.4s' },
          { top: '45%', left: '3%',  color: '#AF52DE', rotate: '14deg',  scale: '0.45',delay: '1.2s' },
          { top: '38%', right: '5%', color: '#FFCC00', rotate: '-12deg', scale: '0.55',delay: '2s'   },
        ].map((n, i) => (
          <div key={i} className="absolute note-float" style={{
            top: n.top, left: n.left, right: n.right,
            animationDelay: n.delay,
            transform: `rotate(${n.rotate}) scale(${n.scale})`,
            opacity: 0.18,
          }}>
            <div style={{
              width: 80, height: 80,
              background: n.color,
              borderRadius: '2px 2px 2px 12px',
              boxShadow: '3px 4px 12px rgba(0,0,0,0.4)',
            }} />
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="fade-up relative z-10 w-full max-w-sm">
        <div style={{
          background: 'rgba(24,24,27,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '1.5rem',
          padding: '2.5rem 2rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        }}>

          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div style={{
              width: 64, height: 64,
              background: '#FFCC00',
              borderRadius: '14px 14px 14px 32px',
              boxShadow: '0 8px 24px rgba(255,204,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem',
            }}>
              📝
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-1">
            <h1 className="text-white text-2xl font-bold tracking-tight">Stickies</h1>
          </div>
          <p className="text-center text-zinc-500 text-sm mb-8">
            Your personal note board
          </p>

          {/* Error */}
          {errorParam && (
            <div className="mb-5 px-4 py-3 rounded-xl text-center text-xs text-red-400"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {errorParam === 'unauthorized'
                ? 'Access denied — this board is private.'
                : 'Sign-in failed. Please try again.'}
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3 fade-up-2">

            {/* Apple */}
            <button
              className="btn-apple w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: '#000', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => signIn('apple')}
              disabled={!!loading}
            >
              {loading === 'apple' ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.29.07 2.18.77 2.94.8 1.12-.23 2.2-.96 3.4-.82 1.43.19 2.52.8 3.23 2.04-2.93 1.76-2.23 5.61.28 6.72-.56 1.51-1.3 3.01-1.85 4.12zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Continue with Apple
            </button>

            {/* Google */}
            <button
              className="btn-google w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => signIn('google')}
              disabled={!!loading}
            >
              {loading === 'google' ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>
          </div>

          <p className="fade-up-3 text-center text-zinc-600 text-xs mt-6">
            Sign up or sign in — it's the same button.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-700 text-xs mt-6">
          Personal note board · built with{' '}
          <span style={{ color: '#3ECF8E' }}>Supabase</span>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
