'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function SignInContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    }
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
      `}</style>

      {/* Floating sticky notes */}
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
            top: n.top, left: (n as any).left, right: (n as any).right,
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

          <div className="text-center mb-6">
            <h1 className="text-white text-2xl font-bold tracking-tight">Stickies</h1>
          </div>

          {process.env.NODE_ENV === 'development' ? (
            <a href="/"
              className="fade-up-2 w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #FFCC00 0%, #FF9500 100%)',
                color: '#000',
                boxShadow: '0 4px 16px rgba(255,204,0,0.25)',
              }}>
              Go in (dev)
            </a>
          ) : (
            <div className="fade-up-2 flex flex-col gap-3">
              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                style={{
                  background: '#fff',
                  color: '#1a1a1a',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          )}

        </div>
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
