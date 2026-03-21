'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function SignInContent() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (err) {
      setError('Wrong email or password.')
      setLoading(false)
    } else {
      window.location.href = '/'
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
        .email-input { caret-color: #FFCC00; caret-shape: block; }
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
            <form onSubmit={signIn} className="fade-up-2 flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="Email"
                autoFocus
                required
                className="email-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-zinc-600 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="Password"
                required
                className="email-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-zinc-600 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
                }}
              />
              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #FFCC00 0%, #FF9500 100%)',
                  color: '#000',
                  boxShadow: '0 4px 16px rgba(255,204,0,0.2)',
                }}
              >
                {loading
                  ? <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  : 'Sign in'
                }
              </button>
            </form>
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
