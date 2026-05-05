import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  async function verifyAdminAccess(s: Session) {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
      if (res.ok || res.status !== 403) {
        setSession(s)
        setVerified(true)
      } else {
        await supabase.auth.signOut()
        setSession(null)
        setVerified(false)
      }
    } catch {
      setSession(null)
      setVerified(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void verifyAdminAccess(data.session)
      } else {
        setChecking(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        void verifyAdminAccess(s)
      } else {
        setSession(null)
        setVerified(false)
        setChecking(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Checking access...
      </div>
    )
  }

  if (!session || !verified) {
    return (
      <Login
        onLogin={() => {
          void supabase.auth.getSession().then(({ data }) => {
            if (data.session) void verifyAdminAccess(data.session)
          })
        }}
      />
    )
  }

  return <AdminPanel session={session} />
}
