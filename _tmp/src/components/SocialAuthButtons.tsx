import type { Provider } from '@supabase/supabase-js'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

interface Props {
  label?: string
}

export default function SocialAuthButtons({ label = 'Or continue with' }: Props) {
  const { signInWithOAuth } = useAuth()
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  async function handleOAuth(provider: Provider) {
    setError('')
    setLoading(provider)
    const { error } = await signInWithOAuth(provider)
    setLoading(null)
    if (error) setError(error)
  }

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'var(--font-body)',
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleOAuth('google')}
          style={{ ...btnBase, opacity: loading && loading !== 'google' ? 0.5 : 1 }}
        >
          <GoogleIcon />
          {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleOAuth('apple')}
          style={{ ...btnBase, opacity: loading && loading !== 'apple' ? 0.5 : 1 }}
        >
          <AppleIcon />
          {loading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
        </button>

        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleOAuth('linkedin_oidc')}
          style={{ ...btnBase, opacity: loading && loading !== 'linkedin_oidc' ? 0.5 : 1 }}
        >
          <LinkedInIcon />
          {loading === 'linkedin_oidc' ? 'Redirecting…' : 'Continue with LinkedIn'}
        </button>
      </div>

      {error && (
        <p style={{ marginTop: 10, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <path d="M12.53 3.27c.74-.9.95-2.16.95-3.27-1.1.06-2.36.74-3.13 1.65-.7.83-.99 2.04-.86 3.12 1.14.09 2.3-.6 3.04-1.5ZM15.03 9.61c-.03-2.68 2.19-3.98 2.28-4.04-.29-1.46-1.47-2.44-2.85-2.44-1.27-.05-2.4.73-3 .73-.64 0-1.59-.69-2.63-.67-1.35.02-2.6.79-3.29 1.99C3.73 7.48 4.57 11.31 6.42 13.5c.86 1.07 1.89 2.28 3.22 2.23 1.29-.05 1.78-.83 3.33-.83 1.56 0 2 .83 3.34.8 1.38-.02 2.26-1.1 3.1-2.18.4-.54.71-1.15.93-1.77-2.39-.97-2.29-4.09-2.31-4.14Z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="#0077B5">
      <rect width="18" height="18" rx="3" fill="#0077B5" />
      <path
        d="M5.4 7.2H3.6V14h1.8V7.2ZM4.5 6.3a1.05 1.05 0 1 0 0-2.1 1.05 1.05 0 0 0 0 2.1ZM14.4 14h-1.8v-3.3c0-.79-.66-1.5-1.5-1.5-.83 0-1.5.71-1.5 1.5V14H7.8V7.2h1.8v.9c.42-.63 1.17-1.05 1.95-1.05C13.04 7.05 14.4 8.43 14.4 10v4Z"
        fill="white"
      />
    </svg>
  )
}
