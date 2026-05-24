'use client'

import Image from 'next/image'
import { Suspense, useState, useTransition, type FormEvent } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // CRITICAL FIX: Use createBrowserClient from @supabase/ssr
  // This ensures the session is saved to browser COOKIES so the Middleware can see it!
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authErr) {
        setError(authErr.message)
        return
      }

      if (data?.user) {
        // FORCE the browser to reload at the dashboard
        // This ensures the middleware sees the new session cookie immediately
        window.location.href = '/dashboard'
      }
    })
  }

  return (
    <main style={{ backgroundColor: '#F9F4EB', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Image src="/sabbath-logo.png" alt="Sabbath Spa" width={180} height={90} priority style={{ objectFit: 'contain', margin: '0 auto 20px' }} />
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#1A1A1A', margin: '0 0 32px' }}>Staff Portal</h1>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: '40px 32px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)', border: '1px solid rgba(26,26,26,0.05)' }}>
          {error && <div style={{ marginBottom: 20, padding: '12px', backgroundColor: '#FFF5F5', color: '#C53030', borderRadius: 12, fontSize: 14 }}>{error}</div>}

          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(26,26,26,0.4)', marginBottom: 8, display: 'block' }}>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', height: 60, padding: '0 18px', backgroundColor: '#FAF7F0', border: '1.5px solid rgba(26,26,26,0.12)', borderRadius: 14 }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(26,26,26,0.4)', marginBottom: 8, display: 'block' }}>Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', height: 60, padding: '0 18px', backgroundColor: '#FAF7F0', border: '1.5px solid rgba(26,26,26,0.12)', borderRadius: 14 }} />
            </div>
            <button type="submit" disabled={isPending} style={{ height: 60, borderRadius: 14, backgroundColor: '#1A1A1A', color: '#C58F3B', fontWeight: 700, cursor: 'pointer', width: '100%', border: 'none' }}>
              {isPending ? 'Signing in...' : 'SIGN IN'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() { return <Suspense><LoginContent /></Suspense> }