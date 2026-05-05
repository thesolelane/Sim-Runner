import { useState, useEffect } from 'react'
import {
  Users,
  BarChart2,
  Shield,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Minus,
} from 'lucide-react'
import { StatCard, SectionProps } from './shared'

export default function OverviewSection({ authHeaders }: SectionProps) {
  const [stats, setStats] = useState<{
    totalUsers: number
    adminCount: number
    contractorCount: number
    ownerCount: number
    postCount: number
    jobCount: number
    rfqCount: number
    bidCount: number
    totalCreditsIssued: number
    totalCreditSpent: number
    recentSignups: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErr('')
      try {
        const res = await fetch('/api/admin/stats', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load stats')
        setStats(await res.json())
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '16px 20px',
              height: 90,
            }}
          />
        ))}
      </div>
    )
  }

  if (err) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 8,
          color: '#DC2626',
          fontSize: 13,
        }}
      >
        {err}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          sub={`${stats?.recentSignups ?? 0} in last 30d`}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Contractors"
          value={stats?.contractorCount ?? 0}
          icon={<TrendingUp size={18} />}
          color="#D97706"
        />
        <StatCard
          label="Owners / Homeowners"
          value={stats?.ownerCount ?? 0}
          icon={<Users size={18} />}
          color="#2563EB"
        />
        <StatCard
          label="Admins"
          value={stats?.adminCount ?? 0}
          icon={<Shield size={18} />}
          color="#E85D04"
        />
        <StatCard
          label="Total Posts"
          value={stats?.postCount ?? 0}
          icon={<MessageSquare size={18} />}
          color="#7C3AED"
        />
        <StatCard
          label="Job Listings"
          value={stats?.jobCount ?? 0}
          icon={<BarChart2 size={18} />}
          color="#059669"
        />
        <StatCard
          label="RFQs Posted"
          value={stats?.rfqCount ?? 0}
          icon={<BarChart2 size={18} />}
          color="#0891B2"
        />
        <StatCard
          label="Bids Submitted"
          value={stats?.bidCount ?? 0}
          icon={<BarChart2 size={18} />}
          color="#E85D04"
        />
        <StatCard
          label="Credits Issued"
          value={stats?.totalCreditsIssued ?? 0}
          icon={<DollarSign size={18} />}
          color="#059669"
        />
        <StatCard
          label="Credits Spent"
          value={stats?.totalCreditSpent ?? 0}
          icon={<Minus size={18} />}
          color="#DC2626"
        />
      </div>
    </div>
  )
}
