import { useState, useEffect, FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getRoleLabel, isStaff } from '../lib/roles'
import { Shield, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import '../styles/auth.css'

interface InviteInfo {
  id: string
  email: string
  role: string
  expires_at: string
  users: { display_name: string; avatar_url: string | null } | null
}

export default function StaffInvite() {
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
    fetch(`/api/admin/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setInviteError(data.error)
        } else {
          setInvite(data.invite)
        }
      })
      .catch(() => setInviteError('Failed to load invite.'))
      .finally(() => setInviteLoading(false))
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { data: { display_name: fullName.trim() } },
      })
      if (signUpErr) throw new Error(signUpErr.message)
      const uid = authData.user?.id
      if (!uid) throw new Error('Signup failed — no user ID returned.')

      const handle =
        fullName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 20) + Math.floor(Math.random() * 900 + 100)

      const { error: profileErr } = await supabase.from('users').insert({
        id: uid,
        display_name: fullName.trim(),
        handle,
        account_type: invite.role,
        credit_balance: 0,
        deleted_at: null,
      })
      if (profileErr) throw new Error(profileErr.message)

      await supabase
        .from('admin_invites')
        .update({ used_at: new Date().toISOString(), used_by: uid })
        .eq('id', invite.id)

      setDone(true)
      setTimeout(() => navigate('/feed'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const roleLabel = invite ? getRoleLabel(invite.role) : ''
  const isStaffRole = invite ? isStaff(invite.role) : false

  return (
    <div className="auth-root">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: isStaffRole ? 'rgba(232,93,4,0.12)' : 'rgba(5,150,105,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Shield size={24} color={isStaffRole ? 'var(--color-brand)' : '#059669'} />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 26,
              margin: '0 0 6px',
            }}
          >
            You've been invited
          </h1>
          {invite && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              {invite.users?.display_name ?? 'TraydBook Admin'} has invited you to join as{' '}
              <strong style={{ color: 'var(--color-text)' }}>{roleLabel}</strong>
            </p>
          )}
        </div>

        {inviteLoading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
            <Loader size={20} className="spin" />
          </div>
        )}

        {inviteError && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #DC2626',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', margin: '0 0 4px' }}>
                Invite Unavailable
              </p>
              <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{inviteError}</p>
            </div>
          </div>
        )}

        {done && (
          <div
            style={{
              background: 'rgba(5,150,105,0.08)',
              border: '1px solid rgba(5,150,105,0.3)',
              borderRadius: 10,
              padding: 20,
              textAlign: 'center',
            }}
          >
            <CheckCircle size={28} color="#059669" style={{ marginBottom: 10 }} />
            <p style={{ fontWeight: 700, fontSize: 15, color: '#059669', margin: '0 0 6px' }}>
              Account created!
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              Taking you to the platform…
            </p>
          </div>
        )}

        {invite && !done && (
          <form
            onSubmit={e => void handleSubmit(e)}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>Email: </span>
              <strong>{invite.email}</strong>
              <span style={{ marginLeft: 12, color: 'var(--color-text-muted)' }}>Role: </span>
              <strong style={{ color: isStaffRole ? 'var(--color-brand)' : '#059669' }}>
                {roleLabel}
              </strong>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #DC2626',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#DC2626',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? <Loader size={14} className="spin" /> : <Shield size={14} />}
              {loading ? 'Creating account…' : `Join as ${roleLabel}`}
            </button>
          </form>
        )}

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 20,
          }}
        >
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-brand)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
