import { useState, useEffect } from 'react'
import { Copy, Check, Trash2, UserPlus, Clock, CheckCircle, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ALL_INVITE_ROLES, STAFF_ROLES, getRoleLabel } from '../lib/roles'

interface AdminInvite {
  id: string
  email: string
  role: string
  expires_at: string
  used_at: string | null
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function StaffPanel() {
  const { session } = useAuth()

  const [invites, setInvites] = useState<AdminInvite[]>([])
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>(STAFF_ROLES[1].value)
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [result, setResult] = useState<{ joinUrl: string; email: string; role: string } | null>(
    null
  )
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadInvites() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/invites', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvites()
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setSendErr('Email is required.')
      return
    }
    setSending(true)
    setSendErr('')
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create invite')
      setResult({ joinUrl: data.joinUrl, email: email.trim(), role })
      setEmail('')
      void loadInvites()
    } catch (err) {
      setSendErr(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/admin/invite/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      setInvites(prev => prev.filter(i => i.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const pending = invites.filter(i => !i.used_at && new Date(i.expires_at) > new Date())
  const used = invites.filter(i => !!i.used_at)
  const expired = invites.filter(i => !i.used_at && new Date(i.expires_at) <= new Date())

  const ROLE_COLORS: Record<string, string> = {
    admin: '#E85D04',
    admin_2: '#9333EA',
    hired_dev: '#0891B2',
    moderator: '#059669',
    contractor: '#D97706',
    project_owner: '#2563EB',
    agent: '#7C3AED',
    homeowner: '#6B7280',
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 20,
            margin: '0 0 4px',
          }}
        >
          Staff & Role Management
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
          Send invite links to staff. Recipients sign up and their role is pre-assigned
          automatically.
        </p>
      </div>

      {/* Role hierarchy info */}
      <div
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--color-text-muted)',
            marginBottom: 12,
          }}
        >
          Role Hierarchy
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ALL_INVITE_ROLES.map(r => (
            <div key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                style={{
                  minWidth: 90,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: `${ROLE_COLORS[r.value]}20`,
                  color: ROLE_COLORS[r.value] ?? 'var(--color-text-muted)',
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {r.label}
              </span>
              {'description' in r && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {(r as { description: string }).description}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Send invite form */}
      {result ? (
        <div
          style={{
            background: 'rgba(5,150,105,0.08)',
            border: '1px solid rgba(5,150,105,0.3)',
            borderRadius: 10,
            padding: 18,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CheckCircle size={16} color="#059669" />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>
              Invite created for {result.email} as {getRoleLabel(result.role)}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
            Share this link — it expires in 7 days and can only be used once.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={result.joinUrl}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => copyLink(result.joinUrl)}
              className="btn btn-primary"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setResult(null)}
            style={{
              marginTop: 12,
              fontSize: 12,
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Send another invite
          </button>
        </div>
      ) : (
        <form
          onSubmit={e => void handleSend(e)}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: 18,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <UserPlus size={15} color="var(--color-brand)" /> Send New Invite
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                flex: 2,
                minWidth: 200,
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{
                flex: 1,
                minWidth: 150,
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            >
              <optgroup label="Staff Roles">
                {STAFF_ROLES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Platform Users">
                {ALL_INVITE_ROLES.filter(r => !STAFF_ROLES.find(s => s.value === r.value)).map(
                  r => (
                    <option key={r.value} value={r.value}>
                      {getRoleLabel(r.value)}
                    </option>
                  )
                )}
              </optgroup>
            </select>
            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <UserPlus size={13} />
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
          {sendErr && <p style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>{sendErr}</p>}
        </form>
      )}

      {/* Pending invites */}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading invites…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Clock size={12} /> Pending ({pending.length})
              </div>
              {pending.map(inv => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'var(--color-surface)',
                    borderRadius: 8,
                    marginBottom: 6,
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 20,
                      flexShrink: 0,
                      background: `${ROLE_COLORS[inv.role] ?? '#6B7280'}20`,
                      color: ROLE_COLORS[inv.role] ?? 'var(--color-text-muted)',
                    }}
                  >
                    {getRoleLabel(inv.role)}
                  </span>
                  <span style={{ fontSize: 13, flex: 1 }}>{inv.email}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    Expires {formatDate(inv.expires_at)}
                  </span>
                  <button
                    onClick={() => void handleDelete(inv.id)}
                    disabled={deletingId === inv.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: 4,
                    }}
                    title="Revoke invite"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {used.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle size={12} color="#059669" /> Accepted ({used.length})
              </div>
              {used.map(inv => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'var(--color-bg)',
                    borderRadius: 8,
                    marginBottom: 6,
                    border: '1px solid var(--color-border)',
                    opacity: 0.7,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 20,
                      flexShrink: 0,
                      background: `${ROLE_COLORS[inv.role] ?? '#6B7280'}20`,
                      color: ROLE_COLORS[inv.role] ?? 'var(--color-text-muted)',
                    }}
                  >
                    {getRoleLabel(inv.role)}
                  </span>
                  <span style={{ fontSize: 13, flex: 1 }}>{inv.email}</span>
                  <span style={{ fontSize: 11, color: '#059669' }}>
                    Joined {formatDate(inv.used_at!)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {expired.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  marginBottom: 10,
                }}
              >
                Expired ({expired.length})
              </div>
              {expired.map(inv => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'var(--color-bg)',
                    borderRadius: 8,
                    marginBottom: 6,
                    border: '1px solid var(--color-border)',
                    opacity: 0.5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 20,
                      flexShrink: 0,
                      background: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {getRoleLabel(inv.role)}
                  </span>
                  <span style={{ fontSize: 13, flex: 1 }}>{inv.email}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Expired</span>
                  <button
                    onClick={() => void handleDelete(inv.id)}
                    disabled={deletingId === inv.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: 4,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pending.length === 0 && used.length === 0 && expired.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
                color: 'var(--color-text-muted)',
                fontSize: 13,
              }}
            >
              <Shield size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No invites sent yet. Use the form above to invite staff members.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
