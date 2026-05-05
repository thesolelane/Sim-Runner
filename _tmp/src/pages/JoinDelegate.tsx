import { useState, useEffect, FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/auth.css'

interface InviteInfo {
  id: string
  principal_id: string
  role: string
  invite_email: string
  principal_name: string
  principal_avatar: string | null
}

export default function JoinDelegate() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(true)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setInviteError('Invalid invite link.')
      setInviteLoading(false)
      return
    }
    async function loadInvite() {
      const { data: delegation, error: dlgErr } = await supabase
        .from('account_delegations')
        .select('id, principal_id, role, invite_email, invite_expires_at, status')
        .eq('invite_token', token)
        .maybeSingle()

      if (dlgErr || !delegation) {
        setInviteError('This invite link is invalid or has already been used.')
        setInviteLoading(false)
        return
      }

      if (delegation.status !== 'pending') {
        setInviteError('This invite has already been accepted or has been revoked.')
        setInviteLoading(false)
        return
      }

      if (new Date(delegation.invite_expires_at) < new Date()) {
        setInviteError(
          'This invite link has expired. Please ask the account owner to send a new invite.'
        )
        setInviteLoading(false)
        return
      }

      const { data: principal } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', delegation.principal_id)
        .single()

      setInvite({
        id: delegation.id,
        principal_id: delegation.principal_id,
        role: delegation.role,
        invite_email: delegation.invite_email,
        principal_name: principal?.display_name ?? 'Unknown',
        principal_avatar: principal?.avatar_url ?? null,
      })
      setInviteLoading(false)
    }
    loadInvite()
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    setError('')

    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: invite.invite_email,
        password,
        options: { emailRedirectTo: undefined },
      })

      if (signUpErr) throw new Error(signUpErr.message)
      if (!authData.user) throw new Error('Account creation failed. Please try again.')

      const uid = authData.user.id

      const { error: profileError } = await supabase.from('users').insert({
        id: uid,
        display_name: fullName.trim(),
        handle: `delegate_${uid.slice(0, 8)}`,
        avatar_url: null,
        account_type: 'project_owner',
        location_city: null,
        location_state: null,
        location_zip: null,
        credit_balance: 0,
        deleted_at: null,
        is_delegate: true,
        delegate_principal_id: invite.principal_id,
      })

      if (profileError) throw new Error(profileError.message)

      const { error: delegationUpdateErr } = await supabase
        .from('account_delegations')
        .update({
          delegate_id: uid,
          status: 'active',
          invite_token: null,
        })
        .eq('id', invite.id)

      if (delegationUpdateErr) throw new Error(delegationUpdateErr.message)

      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (inviteLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Verifying invite link…
          </div>
        </div>
      </div>
    )
  }

  if (inviteError) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 480 }}>
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
          <h1 className="auth-title">Invalid Invite</h1>
          <p className="auth-subtitle" style={{ color: '#DC2626' }}>
            {inviteError}
          </p>
          <p className="auth-footer-text" style={{ marginTop: 20 }}>
            <Link to="/login">Go to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 480 }}>
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
          <h1 className="auth-title">You're all set!</h1>
          <p className="auth-subtitle">
            Your account has been created. Sign in below to start working as{' '}
            <strong>{invite?.principal_name}</strong>'s team member.
          </p>
          <button
            className="btn-primary btn-full"
            style={{ marginTop: 20 }}
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
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

        <h1 className="auth-title">Join {invite?.principal_name}'s team</h1>
        <p className="auth-subtitle">
          You've been invited as a{' '}
          <strong>{invite?.role === 'admin' ? 'Team Admin' : 'Contributor'}</strong>. Create your
          account to get started.
        </p>

        <div
          style={{
            background: 'rgba(232,93,4,0.06)',
            border: '1px solid rgba(232,93,4,0.2)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--color-text)', display: 'block', marginBottom: 4 }}>
            Notice
          </strong>
          {invite?.principal_name} has accepted full responsibility for all content, messages, bids,
          and actions you take on their behalf. All activity is recorded and attributed to their
          account.
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              required
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={invite?.invite_email ?? ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account & Join'}
          </button>
        </form>

        <p className="auth-footer-text" style={{ marginTop: 20 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
