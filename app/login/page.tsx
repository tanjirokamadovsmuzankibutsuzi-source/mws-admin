'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Red glow blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-brand opacity-5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-accent opacity-5 rounded-full blur-[100px]" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-brand/30 bg-brand/10 mb-4 glow-red">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 8h20v2H6zM6 15h14v2H6zM6 22h20v2H6z" fill="#E50914"/>
              <circle cx="24" cy="16" r="4" fill="none" stroke="#FF6B35" strokeWidth="2"/>
              <path d="M27 19l3 3" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">MWS Admin</h1>
          <p className="text-muted text-sm mt-1">Muxing WorkStation</p>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted/50 focus:outline-none focus:border-brand/50 focus:bg-panel transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted/50 focus:outline-none focus:border-brand/50 focus:bg-panel transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm tracking-wide glow-red"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-muted/50 text-xs mt-6">
            © MWS • Dev END!
          </p>
        </div>
      </div>
    </div>
  )
}
