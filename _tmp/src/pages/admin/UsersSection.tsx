import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { getRoleLabel } from '../../lib/roles'
import {
  SectionProps,
  AdminInput,
  LoadingRow,
  formatDate,
  tableHeaderStyle,
  tableCellStyle,
} from './shared'

interface UserRow {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: string
  credit_balance: number
  created_at: string
  deleted_at: string | null
}

const ALL_ROLES = [
  'admin',
  'admin_2',
  'hired_dev',
  'moderator',
  'contractor',
  'project_owner',
  'agent',
  'homeowner',
]

export default function UsersSection({ authHeaders }: SectionProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgErr, setMsgErr] = useState('')
  const PAGE_SIZE = 25

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      const res = await fetch(`/api/admin/users?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (e) {
      setMsgErr(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, page])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function handleRoleChange(userId: string, newRole: string) {
    setActionLoading(userId + ':role')
    setMsg('')
    setMsgErr('')
    try {
      const res = await fetch(`/api/admin/user/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update role')
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, account_type: newRole } : u)))
      setMsg('Role updated.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      setMsgErr(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSuspend(userId: string, suspend: boolean) {
    setActionLoading(userId + ':suspend')
    setMsg('')
    setMsgErr('')
    try {
      const res = await fetch(`/api/admin/user/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ suspend }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update account')
      setUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, deleted_at: suspend ? new Date().toISOString() : null } : u
        )
      )
      setMsg(suspend ? 'Account suspended.' : 'Account reinstated.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      setMsgErr(e instanceof Error ? e.message : 'Failed to update account')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(5,150,105,0.08)',
            border: '1px solid rgba(5,150,105,0.25)',
            borderRadius: 8,
            fontSize: 13,
            color: '#059669',
          }}
        >
          {msg}
        </div>
      )}
      {msgErr && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8,
            fontSize: 13,
            color: '#DC2626',
          }}
        >
          {msgErr}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <AdminInput
            value={search}
            onChange={v => {
              setSearch(v)
              setPage(0)
            }}
            placeholder="Search by name or handle…"
            style={{ width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => {
            setRoleFilter(e.target.value)
            setPage(0)
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map(r => (
            <option key={r} value={r}>
              {getRoleLabel(r)}
            </option>
          ))}
        </select>
        <button
          onClick={() => void loadUsers()}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1.5px solid var(--color-border)',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)' }}>
              <th style={tableHeaderStyle}>User</th>
              <th style={tableHeaderStyle}>Handle</th>
              <th style={tableHeaderStyle}>Role</th>
              <th style={tableHeaderStyle}>Credits</th>
              <th style={tableHeaderStyle}>Joined</th>
              <th style={tableHeaderStyle}>Status</th>
              <th style={tableHeaderStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={7} />)
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    ...tableCellStyle,
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                    padding: 32,
                  }}
                >
                  No users found.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr
                  key={u.id}
                  style={{ background: u.deleted_at ? 'rgba(220,38,38,0.04)' : 'transparent' }}
                >
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {u.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{u.display_name}</span>
                    </div>
                  </td>
                  <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>
                    @{u.handle}
                  </td>
                  <td style={tableCellStyle}>
                    <select
                      value={u.account_type}
                      onChange={e => void handleRoleChange(u.id, e.target.value)}
                      disabled={actionLoading === u.id + ':role'}
                      style={{
                        fontSize: 12,
                        padding: '3px 6px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {ALL_ROLES.map(r => (
                        <option key={r} value={r}>
                          {getRoleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...tableCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {u.credit_balance}
                  </td>
                  <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>
                    {formatDate(u.created_at)}
                  </td>
                  <td style={tableCellStyle}>
                    {u.deleted_at ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#DC2626',
                          fontWeight: 700,
                          background: 'rgba(220,38,38,0.1)',
                          padding: '2px 8px',
                          borderRadius: 20,
                        }}
                      >
                        Suspended
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#059669',
                          fontWeight: 700,
                          background: 'rgba(5,150,105,0.1)',
                          padding: '2px 8px',
                          borderRadius: 20,
                        }}
                      >
                        Active
                      </span>
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a
                        href={`/profile/${u.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text-muted)',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={11} /> Profile
                      </a>
                      <button
                        onClick={() => void handleSuspend(u.id, !u.deleted_at)}
                        disabled={actionLoading === u.id + ':suspend'}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'none',
                          cursor: 'pointer',
                          color: u.deleted_at ? '#059669' : '#DC2626',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {u.deleted_at ? (
                          <>
                            <CheckCircle size={11} /> Reinstate
                          </>
                        ) : (
                          <>
                            <XCircle size={11} /> Suspend
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        <button
          disabled={page === 0}
          onClick={() => setPage(p => p - 1)}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'none',
            cursor: page === 0 ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-muted)',
            opacity: page === 0 ? 0.4 : 1,
          }}
        >
          Prev
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Page {page + 1}</span>
        <button
          disabled={users.length < PAGE_SIZE}
          onClick={() => setPage(p => p + 1)}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'none',
            cursor: users.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-muted)',
            opacity: users.length < PAGE_SIZE ? 0.4 : 1,
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
