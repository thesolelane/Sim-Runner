import { useState, useEffect } from 'react'
import { Plus, Eye, EyeOff, Pencil, Trash2, Check, X, AlertTriangle, RefreshCw } from 'lucide-react'

interface Secret {
  name: string
  set: boolean
  masked: string
  source: 'file' | 'env' | 'unset'
}

interface SecretsSectionProps {
  authHeaders: () => Record<string, string>
}

export default function SecretsSection({ authHeaders }: SecretsSectionProps) {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [feedback, setFeedback] = useState<{ key: string; msg: string } | null>(null)

  useEffect(() => {
    void loadSecrets()
  }, [])

  async function loadSecrets() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/secrets', { headers: authHeaders() })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setSecrets(data.secrets)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load secrets')
    }
    setLoading(false)
  }

  function showFeedback(key: string, msg: string) {
    setFeedback({ key, msg })
    setTimeout(() => setFeedback(null), 2500)
  }

  async function handleSave(name: string, value: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/secrets', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to save')
      }
      setSecrets(prev =>
        prev.map(s =>
          s.name === name
            ? { ...s, set: Boolean(value), masked: value ? maskPreview(value) : '', source: 'file' }
            : s
        )
      )
      setEditing(null)
      setEditValue('')
      showFeedback(name, 'Saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(name: string) {
    setDeleting(name)
    try {
      const res = await fetch(`/api/admin/secrets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Delete failed')
      setSecrets(prev =>
        prev.map(s => (s.name === name ? { ...s, set: false, masked: '', source: 'unset' } : s))
      )
      showFeedback(name, 'Removed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
    setDeleting(null)
  }

  async function handleAddNew() {
    const name = newName.trim().toUpperCase().replace(/\s+/g, '_')
    if (!name || !newValue.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/secrets', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value: newValue.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to add')
      }
      const existing = secrets.find(s => s.name === name)
      if (existing) {
        setSecrets(prev =>
          prev.map(s =>
            s.name === name
              ? { ...s, set: true, masked: maskPreview(newValue.trim()), source: 'file' }
              : s
          )
        )
      } else {
        setSecrets(prev => [
          ...prev,
          { name, set: true, masked: maskPreview(newValue.trim()), source: 'file' },
        ])
      }
      setNewName('')
      setNewValue('')
      setAddingNew(false)
      showFeedback(name, 'Added')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed')
    }
    setSaving(false)
  }

  function maskPreview(val: string) {
    if (val.length <= 6) return '••••••'
    return val.slice(0, 3) + '•'.repeat(Math.min(val.length - 6, 20)) + val.slice(-3)
  }

  function toggleReveal(name: string) {
    setRevealed(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const sourceBadge: Record<string, { label: string; color: string; bg: string }> = {
    file: { label: '.env file', color: '#059669', bg: 'rgba(5,150,105,0.12)' },
    env: { label: 'system env', color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
    unset: { label: 'not set', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
        }}
      >
        <AlertTriangle size={15} color="#DC2626" />
        <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>
          <strong>Super admin only.</strong> Changes write to the <code>.env</code> file on disk.
          Most values take effect on next server restart.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'flex-end' }}>
        <button
          onClick={() => void loadSecrets()}
          className="btn btn-secondary"
          style={{
            padding: '7px 14px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
        <button
          onClick={() => setAddingNew(v => !v)}
          className="btn btn-primary"
          style={{
            padding: '7px 14px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={13} />
          Add Secret
        </button>
      </div>

      {addingNew && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '12px 16px',
            background: 'rgba(232,93,4,0.06)',
            border: '1.5px solid var(--color-brand)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <input
            placeholder="SECRET_NAME"
            value={newName}
            onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            style={{
              flex: '1 1 160px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 10px',
              fontSize: 13,
              fontFamily: 'monospace',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <input
            placeholder="value"
            type="password"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            style={{
              flex: '2 1 220px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 10px',
              fontSize: 13,
              fontFamily: 'monospace',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => void handleAddNew()}
            disabled={saving || !newName || !newValue}
            className="btn btn-primary"
            style={{ padding: '7px 14px', fontSize: 12 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setAddingNew(false)
              setNewName('')
              setNewValue('')
            }}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading secrets...</p>
      ) : (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['Name', 'Value', 'Source', 'Actions'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.6px',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secrets.map((s, i) => {
                const badge = sourceBadge[s.source]
                const isEditing = editing === s.name
                const isDeleting = deleting === s.name
                const fb = feedback?.key === s.name ? feedback.msg : null
                return (
                  <tr
                    key={s.name}
                    style={{
                      borderBottom:
                        i < secrets.length - 1 ? '1px solid var(--color-border)' : 'none',
                      background: isEditing ? 'rgba(232,93,4,0.04)' : 'var(--color-surface)',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.name}
                    </td>

                    <td style={{ padding: '12px 16px', minWidth: 200 }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void handleSave(s.name, editValue)
                            if (e.key === 'Escape') {
                              setEditing(null)
                              setEditValue('')
                            }
                          }}
                          style={{
                            width: '100%',
                            border: '1.5px solid var(--color-brand)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '5px 8px',
                            fontSize: 13,
                            fontFamily: 'monospace',
                            background: 'var(--color-bg)',
                            color: 'var(--color-text)',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 13,
                              color: s.set ? 'var(--color-text)' : 'var(--color-text-muted)',
                              letterSpacing: s.set && !revealed.has(s.name) ? '1px' : 'normal',
                            }}
                          >
                            {s.set ? s.masked : '—'}
                          </span>
                          {s.set && (
                            <button
                              onClick={() => toggleReveal(s.name)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 2,
                                color: 'var(--color-text-muted)',
                              }}
                              title={revealed.has(s.name) ? 'Hide' : 'Show'}
                            >
                              {revealed.has(s.name) ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          )}
                          {fb && (
                            <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                              ✓ {fb}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => void handleSave(s.name, editValue)}
                            disabled={saving}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#059669',
                              padding: 4,
                            }}
                            title="Save"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(null)
                              setEditValue('')
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-text-muted)',
                              padding: 4,
                            }}
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => {
                              setEditing(s.name)
                              setEditValue('')
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-text-muted)',
                              padding: 4,
                              borderRadius: 'var(--radius-sm)',
                            }}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => void handleDelete(s.name)}
                            disabled={isDeleting || !s.set}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: s.set ? 'pointer' : 'not-allowed',
                              color: s.set ? '#DC2626' : 'var(--color-border)',
                              padding: 4,
                              borderRadius: 'var(--radius-sm)',
                              opacity: s.set ? 1 : 0.4,
                            }}
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
