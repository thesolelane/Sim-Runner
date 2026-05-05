import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  publicOnly?: boolean
}

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

export default function ProtectedRoute({ children, publicOnly = false }: ProtectedRouteProps) {
  const { session, loading, needsOnboarding } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />

  // User is logged in but hasn't completed onboarding (new OAuth user)
  if (session && needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  if (publicOnly && session) {
    return <Navigate to="/feed" replace />
  }

  if (!publicOnly && !session) {
    // In development builds, skip the redirect so pages are previewable without a session.
    // import.meta.env.DEV is automatically false in production (vite build).
    if (import.meta.env.DEV) {
      return <>{children}</>
    }
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
