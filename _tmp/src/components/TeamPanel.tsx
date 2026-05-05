import { useState, useEffect } from 'react'
import { Users, UserPlus, Shield, AlertTriangle, CheckCircle, Copy, X, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface DelegateProfile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

interface Delegation {
  id: string
  role: 'admin' | 'contributor'
  invite_email: string
  status: 'pending' | 'active' | 'revoked'
  responsibility_accepted_at: string
  created_at: string
  delegate_id: string | null
  delegate_profile: DelegateProfile | null
}

interface AuditEntry {
  id: string
  delegation_id: string
  actual_user_id: string
  action_type: string
  action_detail: Record<string, unknown> | null
  created_at: string
}

const RESPONSIBILITY_TEXT =
  'By adding a team member to your account, you accept full responsibility for all content, messages, bids, and actions they take on your behalf. TraydBook holds the account owner accountable for all activity regardless of who performed it. Only invite people you fully trust.'
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function RoleBadge({ role }: { role: 'admin' | 'contributor' }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-condensed)',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 10,
        background: role === 'admin' ? 'rgba(232,93,4,0.1)' : 'rgba(99,102,241,0.1)',
        color: role === 'admin' ? 'var(--color-brand)' : '#6366f1',
      }}
    >
      {role === 'admin' ? 'Team Admin' : 'Contributor'}
    </span>
  )
}

export default function TeamPanel() {
  const { user, delegateSession } = useAuth()

  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'contributor'>('contributor')
  const [responsibilityChecked, setResponsibilityChecked] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ joinUrl: string; email: string } | null>(null)
  const [inviteErr, setInviteErr] = useState('')
  const [copied, setCopied] = useState(false)

  const [revoking, setRevoking] = useState<string | null>(null)

  const isDelegateUser = !!delegateSession

  async function loadTeam() {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/team', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to load team')
      }
      const data = await res.json()
      setDelegations(data.delegations ?? [])
      setAuditLog(data.auditLog ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeam()
  }, [user])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!responsibilityChecked) {
      setInviteErr('You must accept the responsibility agreement to continue.')
      return
    }
    if (!inviteEmail.trim()) {
      setInviteErr('Please enter an email address.')
      return
    }

    setInviting(true)
    setInviteErr('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          inviteEmail: inviteEmail.trim(),
          role: inviteRole,
          responsibilityAccepted: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')

      setInviteResult({ joinUrl: data.joinUrl, email: inviteEmail.trim() })
      setInviteEmail('')
      setInviteRole('contributor')
      setResponsibilityChecked(false)
      await loadTeam()
    } catch (err) {
      setInviteErr(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(delegationId: string) {
    setRevoking(delegationId)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/team/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ delegationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke')
      await loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access')
    } finally {
      setRevoking(null)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const pendingInvites = delegations.filter(d => d.status === 'pending')
  const activeMembers = delegations.filter(d => d.status === 'active')
  const revokedMembers = delegations.filter(d => d.status === 'revoked')

  if (isDelegateUser) {
    return (
      <div style={{ padding: '20px 0' }}>
        <div
          style={{
            background: 'rgba(232,93,4,0.06)',
            border: '1px solid rgba(232,93,4,0.2)',
            borderRadius: 8,
            padding: '14px 16px',
            fontSize: 13,
            color: 'var(--color-text-muted)',
          }}
        >
          <strong style={{ color: 'var(--color-text)' }}>Team management is restricted.</strong>{' '}
          Only the account owner can invite or manage team members.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '20px 0',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 13,
        }}
      >
        Loading team…
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#DC2626',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Invite result */}
      {inviteResult && (
        <div
          style={{
            background: 'rgba(5,150,105,0.06)',
            border: '1px solid rgba(5,150,105,0.25)',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <CheckCircle size={16} color="#059669" />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#059669',
                fontFamily: 'var(--font-condensed)',
              }}
            >
              Invite created for {inviteResult.email}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Share this link with them to complete registration:
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly
              value={inviteResult.joinUrl}
              style={{ ...inputStyle, fontSize: 12, flex: 1, fontFamily: 'monospace' }}
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => copyLink(inviteResult.joinUrl)}
              style={{
                padding: '9px 14px',
                background: copied ? '#059669' : 'var(--color-brand)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-condensed)',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => setInviteResult(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: 4,
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Active members */}
      {activeMembers.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 10,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Active Team Members
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeMembers.map(d => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {d.delegate_profile?.avatar_url ? (
                    <img
                      src={d.delegate_profile.avatar_url}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--color-brand-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Users size={16} color="var(--color-brand)" />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-condensed)',
                      }}
                    >
                      {d.delegate_profile?.display_name ?? d.invite_email}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {d.invite_email} · Joined{' '}
                      {d.delegate_profile?.created_at
                        ? formatDate(d.delegate_profile.created_at)
                        : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <RoleBadge role={d.role} />
                  <button
                    onClick={() => handleRevoke(d.id)}
                    disabled={revoking === d.id}
                    style={{
                      padding: '5px 12px',
                      background: 'transparent',
                      border: '1px solid rgba(220,38,38,0.4)',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-condensed)',
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      color: '#DC2626',
                      cursor: revoking === d.id ? 'not-allowed' : 'pointer',
                      opacity: revoking === d.id ? 0.6 : 1,
                    }}
                  >
                    {revoking === d.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 10,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Pending Invites
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingInvites.map(d => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={14} color="var(--color-text-muted)" />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{d.invite_email}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Invited {formatDate(d.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <RoleBadge role={d.role} />
                  <button
                    onClick={() => handleRevoke(d.id)}
                    disabled={revoking === d.id}
                    style={{
                      padding: '4px 10px',
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-condensed)',
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      cursor: revoking === d.id ? 'not-allowed' : 'pointer',
                      opacity: revoking === d.id ? 0.6 : 1,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      {!showInviteForm && !inviteResult && (
        <button
          onClick={() => setShowInviteForm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'var(--color-brand)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontFamily: 'var(--font-condensed)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#fff',
            marginBottom: 20,
          }}
        >
          <UserPlus size={15} /> Invite Team Member
        </button>
      )}

      {showInviteForm && (
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '18px',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
              }}
            >
              Invite a Team Member
            </div>
            <button
              onClick={() => {
                setShowInviteForm(false)
                setInviteErr('')
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {inviteErr && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#DC2626',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <AlertTriangle size={14} /> {inviteErr}
            </div>
          )}

          <form
            onSubmit={handleInvite}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Role
              </label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'contributor')}
                style={inputStyle}
              >
                <option value="contributor">Contributor — can post feed updates only</option>
                <option value="admin">
                  Team Admin — can post, message, submit bids, manage jobs
                </option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {inviteRole === 'admin'
                  ? 'Team Admins can post, message, submit and manage bids, manage job listings, and view the audit log. They cannot change billing or invite/revoke other delegates.'
                  : 'Contributors can post feed updates and photos only. They have read-only access to messages and bids.'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(232,93,4,0.04)',
                border: '1px solid rgba(232,93,4,0.2)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                {RESPONSIBILITY_TEXT}
              </div>
              <label
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={responsibilityChecked}
                  onChange={e => setResponsibilityChecked(e.target.checked)}
                  style={{
                    marginTop: 2,
                    accentColor: 'var(--color-brand)',
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                  I accept full responsibility for all actions this team member takes on my account.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false)
                  setInviteErr('')
                }}
                style={{
                  padding: '9px 16px',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting || !responsibilityChecked}
                style={{
                  flex: 1,
                  padding: '9px 18px',
                  background: 'var(--color-brand)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#fff',
                  cursor: inviting || !responsibilityChecked ? 'not-allowed' : 'pointer',
                  opacity: inviting || !responsibilityChecked ? 0.6 : 1,
                }}
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 10,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Recent Activity Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {auditLog.map(entry => {
              const memberDelegation = delegations.find(d => d.id === entry.delegation_id)
              const memberName =
                memberDelegation?.delegate_profile?.display_name ??
                memberDelegation?.invite_email ??
                'Unknown'
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    background: 'var(--color-bg)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    gap: 12,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                      {memberName}
                    </span>{' '}
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {entry.action_type.replace(/_/g, ' ')}
                    </span>
                    {entry.action_detail && Object.keys(entry.action_detail).length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {' '}
                        · {JSON.stringify(entry.action_detail).slice(0, 60)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Revoked members (collapsed, for reference) */}
      {revokedMembers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              opacity: 0.6,
            }}
          >
            Revoked Access ({revokedMembers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {revokedMembers.map(d => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-bg)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  gap: 12,
                  opacity: 0.55,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {d.delegate_profile?.display_name ?? d.invite_email}
                  <span style={{ marginLeft: 6 }}>
                    <RoleBadge role={d.role} />
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Revoked</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeMembers.length === 0 &&
        pendingInvites.length === 0 &&
        !showInviteForm &&
        !inviteResult && (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 20px',
              background: 'var(--color-bg)',
              borderRadius: 10,
              border: '1px dashed var(--color-border)',
            }}
          >
            <Shield size={28} color="var(--color-text-muted)" style={{ marginBottom: 10 }} />
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                marginBottom: 4,
              }}
            >
              No team members yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Invite trusted team members to manage your account on your behalf.
            </div>
          </div>
        )}
    </div>
  )
}
