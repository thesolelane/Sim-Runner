import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, DollarSign } from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  StatCard,
  LoadingRow,
  formatDate,
  formatDollars,
  tableHeaderStyle,
  tableCellStyle,
} from './shared'

interface PurchaseRow {
  id: string
  credits: number
  amount_cents: number
  status: string
  created_at: string
  users: { display_name: string; handle: string } | null
}

interface PaymentTotals {
  completed: number
  failed: number
  totalCents: number
}

export default function PaymentsSection({ authHeaders }: SectionProps) {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [totals, setTotals] = useState<PaymentTotals>({ completed: 0, failed: 0, totalCents: 0 })
  const [err, setErr] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErr('')
      try {
        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        const res = await fetch(`/api/admin/purchases?${params}`, { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setPurchases(data.purchases ?? [])
        if (data.totals) setTotals(data.totals)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load payments')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {err && (
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
          {err}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          label="Completed Payments"
          value={totals.completed}
          icon={<CheckCircle size={18} />}
          color="#059669"
        />
        <StatCard
          label="Failed Payments"
          value={totals.failed}
          icon={<XCircle size={18} />}
          color="#DC2626"
        />
        <StatCard
          label="Total Revenue"
          value={formatDollars(totals.totalCents)}
          icon={<DollarSign size={18} />}
          color="#7C3AED"
        />
      </div>

      <SectionCard
        title="Recent Transactions"
        action={
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
            }}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>User</th>
                <th style={tableHeaderStyle}>Credits</th>
                <th style={tableHeaderStyle}>Amount</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={5} />)
              ) : purchases.length === 0 ? (
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
                    No transactions found.
                  </td>
                </tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.users?.display_name ?? '–'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        @{p.users?.handle ?? '–'}
                      </div>
                    </td>
                    <td style={{ ...tableCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {p.credits} cr
                    </td>
                    <td
                      style={{
                        ...tableCellStyle,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                      }}
                    >
                      {formatDollars(p.amount_cents)}
                    </td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                          background:
                            p.status === 'completed'
                              ? 'rgba(5,150,105,0.12)'
                              : p.status === 'failed'
                                ? 'rgba(220,38,38,0.1)'
                                : 'rgba(107,114,128,0.1)',
                          color:
                            p.status === 'completed'
                              ? '#059669'
                              : p.status === 'failed'
                                ? '#DC2626'
                                : '#6B7280',
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tableCellStyle,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(p.created_at)}
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
