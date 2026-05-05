import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdminLevel } from '../lib/roles'

function Spinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-brand)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />
  if (!session) {
    if (import.meta.env.DEV) return <>{children}</>
    return <Navigate to="/login" replace />
  }
  if (!isAdminLevel(profile?.account_type)) return <Navigate to="/feed" replace />

  return <>{children}</>
}
