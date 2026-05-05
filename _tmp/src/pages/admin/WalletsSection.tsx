import { useState, useEffect } from 'react'
import { Search, Plus } from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  AdminInput,
  LoadingRow,
  tableHeaderStyle,
  tableCellStyle,
} from './shared'

interface WalletUser {
  id: string
  display_name: string
  handle: string
  credit_balance: number
  wallet_address: string | null
  wallet_network: string | null
}

export default function WalletsSection({ authHeaders }: SectionProps) {
  const [wallets, setWallets] = useState<WalletUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adjustUserId, setAdjustUserId] = useState('')
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState('')
  const [adjustErr, setAdjustErr] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/wallets', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setWallets(data.wallets ?? [])
      } catch (e) {
        setAdjustErr(e instanceof Error ? e.message : 'Failed to load wallets')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filtered = wallets.filter(
    w =>
      !search ||
      w.display_name.toLowerCase().includes(search.toLowerCase()) ||
      w.handle.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustUserId || !adjustDelta || !adjustReason.trim()) {
      setAdjustErr('All fields required.')
      return
    }
    const delta = parseInt(adjustDelta, 10)
    if (isNaN(delta) || delta === 0) {
      setAdjustErr('Delta must be a non-zero integer.')
      return
    }
    setAdjusting(true)
    setAdjustErr('')
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: adjustUserId, delta, reason: adjustReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setAdjustMsg(`Credits adjusted. New balance: ${json.balance ?? '–'}`)
      setAdjustUserId('')
      setAdjustDelta('')
      setAdjustReason('')
      setWallets(prev =>
        prev.map(w =>
          w.id === adjustUserId
            ? { ...w, credit_balance: json.balance ?? w.credit_balance + delta }
            : w
        )
      )
      setTimeout(() => setAdjustMsg(''), 4000)
    } catch (err) {
      setAdjustErr(err instanceof Error ? err.message : 'Failed to adjust credits')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard title="Manual Credit Adjustment">
        <form
          onSubmit={e => void handleAdjust(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={adjustUserId}
              onChange={e => setAdjustUserId(e.target.value)}
              style={{
                flex: 2,
                minWidth: 200,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">Select user…</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {w.display_name} (@{w.handle}) — {w.credit_balance} cr
                </option>
              ))}
            </select>
            <AdminInput
              value={adjustDelta}
              onChange={setAdjustDelta}
              placeholder="Delta (e.g. 50 or -10)"
              style={{ width: 140 }}
            />
            <AdminInput
              value={adjustReason}
              onChange={setAdjustReason}
              placeholder="Reason / note"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button
              type="submit"
              disabled={adjusting}
              className="btn btn-primary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <Plus size={13} /> Adjust
            </button>
          </div>
          {adjustErr && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{adjustErr}</p>}
          {adjustMsg && <p style={{ fontSize: 12, color: '#059669', margin: 0 }}>{adjustMsg}</p>}
        </form>
      </SectionCard>

      <SectionCard
        title="User Wallets & Credit Balances"
        action={
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <AdminInput
              value={search}
              onChange={setSearch}
              placeholder="Search…"
              style={{ paddingLeft: 26, width: 180 }}
            />
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>User</th>
                <th style={tableHeaderStyle}>Handle</th>
                <th style={tableHeaderStyle}>Credits</th>
                <th style={tableHeaderStyle}>Solana Wallet</th>
                <th style={tableHeaderStyle}>Network</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={5} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                filtered.map(w => (
                  <tr key={w.id}>
                    <td style={tableCellStyle}>
                      <span style={{ fontWeight: 600 }}>{w.display_name}</span>
                    </td>
                    <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>
                      @{w.handle}
                    </td>
                    <td
                      style={{
                        ...tableCellStyle,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                      }}
                    >
                      {w.credit_balance}
                    </td>
                    <td
                      style={{
                        ...tableCellStyle,
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {w.wallet_address ? (
                        w.wallet_address.slice(0, 8) + '…' + w.wallet_address.slice(-6)
                      ) : (
                        <span style={{ opacity: 0.4 }}>—</span>
                      )}
                    </td>
                    <td style={tableCellStyle}>
                      {w.wallet_network ?? <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
