import { useState, useEffect, FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    // Supabase injects the recovery token into the URL hash; getSession picks it up
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidSession(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setValidSession(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/feed', { replace: true }), 2500)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 17 17" fill="none" width={16} height={16}>
              <rect
                x="2"
                y="1.5"
                width="9"
                height="13"
                rx="1.5"
                fill="rgba(255,255,255,0.12)"
                stroke="white"
                strokeWidth="1.2"
              />
              <rect
                x="5"
                y="1.5"
                width="9"
                height="13"
                rx="1.5"
                fill="rgba(255,255,255,0.25)"
                stroke="white"
                strokeWidth="1.2"
              />
              <path
                d="M7 6h4M7 9h3M7 12h2"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="auth-logo-word">
            <span className="trayd">Trayd</span>
            <span className="book">Book</span>
          </div>
        </Link>

        <h1 className="auth-title">Set new password</h1>
        <p className="auth-subtitle">Choose a strong password for your account</p>

        {success ? (
          <div className="auth-success" style={{ textAlign: 'center', padding: '20px 0' }}>
            Password updated! Redirecting you to the app…
          </div>
        ) : !validSession ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px 0',
              color: 'var(--color-text-muted)',
              fontSize: 14,
            }}
          >
            This link may have expired.{' '}
            <Link to="/login" style={{ color: 'var(--color-brand)' }}>
              Request a new one
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="new-password">New password</label>
              <div className="password-wrap">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoFocus
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm password</label>
              <div className="password-wrap">
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowConfirm(p => !p)}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
