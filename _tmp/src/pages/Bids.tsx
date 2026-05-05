import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  ArrowRight,
  Plus,
  ChevronDown,
  Loader,
  AlertCircle,
  CheckCircle,
  Trophy,
  Archive,
  FileText,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RFQ, MyBid } from '../types/bids'
import { TRADE_OPTIONS } from '../data/trades'

type BidTab = 'open' | 'mybids' | 'awarded' | 'archived'

const SIZE_OPTIONS = [
  { label: 'Any Size', value: 'any' },
  { label: 'Small (< $50K)', value: 'small' },
  { label: 'Medium ($50K–$250K)', value: 'medium' },
  { label: 'Large (> $250K)', value: 'large' },
]

const STATUS_COLOR: Record<string, { color: string; bg: string; dot: string }> = {
  pending: { color: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
  under_review: { color: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' },
  awarded: { color: '#059669', bg: '#ECFDF5', dot: '#059669' },
  not_awarded: { color: '#6B7280', bg: '#F3F4F6', dot: '#6B7280' },
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function urgencyColor(days: number | null): string {
  if (days === null) return '#6B7280'
  if (days <= 4) return '#DC2626'
  if (days <= 14) return '#D97706'
  return '#059669'
}

function urgencyLabel(days: number | null): string {
  if (days === null) return 'No deadline'
  if (days < 0) return 'Deadline passed'
  if (days === 0) return 'Due today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return 'Budget TBD'
  const fmt = (n: number) =>
    n >= 1000000
      ? `$${(n / 1000000).toFixed(1)}M`
      : n >= 1000
        ? `$${Math.round(n / 1000)}K`
        : `$${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (max) return `Up to ${fmt(max)}`
  return `From ${fmt(min!)}`
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function matchesSizeFilter(rfq: RFQ, size: string): boolean {
  if (size === 'any') return true
  const max = rfq.budget_max ?? rfq.budget_min ?? 0
  if (size === 'small') return max < 50000
  if (size === 'medium') return max >= 50000 && max <= 250000
  if (size === 'large') return max > 250000
  return true
}

function StatBox({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="card" style={{ padding: '16px 18px', flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-condensed)',
          fontWeight: 800,
          fontSize: 26,
          color: 'var(--color-text)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function UrgencyBar({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline)
  const pct = days === null ? 50 : Math.max(0, Math.min(100, (days / 21) * 100))
  const color = urgencyColor(days)
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Clock size={10} />{' '}
          {deadline
            ? `Bids due ${new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : 'Open deadline'}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{urgencyLabel(days)}</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 4,
          background: 'var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}

function BidFaceStack({ count }: { count: number }) {
  const n = Math.min(count, 4)
  const colors = ['#E85D04', '#2563EB', '#059669', '#7C3AED', '#D97706']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '2px solid var(--color-surface)',
            background: colors[i % colors.length],
            marginLeft: i === 0 ? 0 : -6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            zIndex: n - i,
            position: 'relative',
          }}
        >
          {i === n - 1 && count > n ? `+${count - n + 1}` : ''}
        </div>
      ))}
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 6 }}>
        {count} bid{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function RFQCard({ rfq, isContractor }: { rfq: RFQ; isContractor: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      className="card"
      style={{
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'transform 0.1s',
        borderLeft: rfq.is_boosted ? '3px solid var(--color-brand)' : undefined,
      }}
      onClick={() => navigate(`/bids/${rfq.id}`)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 4,
            }}
          >
            {rfq.is_boosted && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-brand)',
                  background: 'var(--color-brand)18',
                  borderRadius: 10,
                  padding: '2px 7px',
                }}
              >
                Featured
              </span>
            )}
            <span className="tag" style={{ fontSize: 11, padding: '2px 8px' }}>
              {rfq.trade_needed}
            </span>
            {rfq.project_type && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {rfq.project_type}
              </span>
            )}
          </div>

          <h3
            style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)', marginBottom: 4 }}
          >
            {rfq.title}
          </h3>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
            {rfq.poster_name && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <FileText size={10} /> Posted by {rfq.poster_name}
              </span>
            )}
            {(rfq.location_city || rfq.location_state) && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <MapPin size={10} />{' '}
                {[rfq.location_city, rfq.location_state].filter(Boolean).join(', ')}
              </span>
            )}
            {rfq.sq_footage && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {rfq.sq_footage.toLocaleString()} sq ft
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
              marginBottom: 12,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {rfq.scope_description}
          </p>

          <UrgencyBar deadline={rfq.bid_deadline} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 18,
                color: '#059669',
              }}
            >
              {formatBudget(rfq.budget_min, rfq.budget_max)}
            </div>
            {rfq.duration_weeks && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                {rfq.duration_weeks} weeks
              </div>
            )}
          </div>

          <BidFaceStack count={rfq.bid_count} />

          <div style={{ display: 'flex', gap: 6 }}>
            {isContractor && (
              <Link
                to={`/bids/${rfq.id}/submit`}
                onClick={e => e.stopPropagation()}
                className="btn btn-primary"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Submit Bid
              </Link>
            )}
            <Link
              to={`/bids/${rfq.id}`}
              onClick={e => e.stopPropagation()}
              className="btn btn-secondary"
              style={{
                fontSize: 12,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              View <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Bids() {
  const { profile } = useAuth()
  const isContractor = profile?.account_type === 'contractor'

  const [activeTab, setActiveTab] = useState<BidTab>('open')
  const [tradeFilter, setTradeFilter] = useState('All Trades')
  const [sizeFilter, setSizeFilter] = useState('any')

  const [openRfqs, setOpenRfqs] = useState<RFQ[]>([])
  const [openLoading, setOpenLoading] = useState(true)

  const [myBids, setMyBids] = useState<MyBid[]>([])
  const [myBidsLoading, setMyBidsLoading] = useState(false)

  const [awardedItems, setAwardedItems] = useState<Record<string, unknown>[]>([])
  const [awardedLoading, setAwardedLoading] = useState(false)

  const [archivedRfqs, setArchivedRfqs] = useState<RFQ[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  const [myPendingCount, setMyPendingCount] = useState(0)
  const [statOpenCount, setStatOpenCount] = useState(0)
  const [statClosingCount, setStatClosingCount] = useState(0)
  const [statTotalBudget, setStatTotalBudget] = useState(0)

  useEffect(() => {
    void loadOpenRfqs()
    void loadStats()
    if (profile && isContractor) {
      void loadPendingCount()
    }
  }, [profile])

  useEffect(() => {
    if (activeTab === 'mybids' && myBids.length === 0 && !myBidsLoading) void loadMyBids()
    if (activeTab === 'awarded' && awardedItems.length === 0 && !awardedLoading) void loadAwarded()
    if (activeTab === 'archived' && archivedRfqs.length === 0 && !archivedLoading)
      void loadArchived()
  }, [activeTab])

  async function loadStats() {
    const now = new Date().toISOString()
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString()

    const [countRes, closingRes, budgetRes] = await Promise.all([
      supabase.from('rfqs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase
        .from('rfqs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('bid_deadline', now)
        .lte('bid_deadline', weekAhead),
      supabase.from('rfqs').select('budget_max').eq('status', 'open').not('budget_max', 'is', null),
    ])

    setStatOpenCount(countRes.count ?? 0)
    setStatClosingCount(closingRes.count ?? 0)
    if (budgetRes.data) {
      const total = (budgetRes.data as { budget_max: number }[]).reduce(
        (s, r) => s + (r.budget_max ?? 0),
        0
      )
      setStatTotalBudget(total)
    }
  }

  async function loadOpenRfqs() {
    setOpenLoading(true)
    const { data } = await supabase
      .from('rfqs')
      .select(
        `id, poster_id, title, trade_needed, project_type, scope_description,
        budget_min, budget_max, sq_footage, start_date, duration_weeks, bid_deadline,
        location_zip, location_city, location_state, requirements, bid_count, status,
        awarded_to, is_boosted, created_at,
        users!poster_id (display_name, handle, avatar_url, account_type)`
      )
      .eq('status', 'open')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    if (data) {
      setOpenRfqs(
        data.map((row: Record<string, unknown>) => {
          const u = row.users as unknown as {
            display_name: string
            handle: string
            avatar_url: string | null
            account_type: string
          } | null
          return {
            ...(row as unknown as RFQ),
            poster_name: u?.display_name ?? undefined,
            poster_handle: u?.handle ?? undefined,
            poster_avatar: u?.avatar_url ?? null,
            poster_account_type: u?.account_type ?? undefined,
          }
        })
      )
    }
    setOpenLoading(false)
  }

  async function loadPendingCount() {
    if (!profile) return
    const { count } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('bidder_id', profile.id)
      .eq('status', 'pending')
    setMyPendingCount(count ?? 0)
  }

  async function loadMyBids() {
    if (!profile) return
    setMyBidsLoading(true)
    const { data } = await supabase
      .from('bids')
      .select(
        `id, rfq_id, amount, timeline_weeks, status, submitted_at,
        rfqs!rfq_id (id, title, trade_needed, location_city, location_state, budget_min, budget_max, bid_deadline, status,
          users!poster_id (display_name, handle))`
      )
      .eq('bidder_id', profile.id)
      .order('submitted_at', { ascending: false })

    if (data) {
      setMyBids(
        data.map((row: Record<string, unknown>) => {
          const rfqData = row.rfqs as unknown as Record<string, unknown> | null
          const posterData = rfqData
            ? (rfqData.users as unknown as { display_name: string; handle: string } | null)
            : null
          return {
            id: row.id as string,
            rfq_id: row.rfq_id as string,
            amount: row.amount as number,
            timeline_weeks: row.timeline_weeks as number | null,
            status: row.status as MyBid['status'],
            submitted_at: row.submitted_at as string,
            rfq_title: (rfqData?.title as string) ?? '',
            rfq_trade: (rfqData?.trade_needed as string) ?? '',
            rfq_location_city: (rfqData?.location_city as string | null) ?? null,
            rfq_location_state: (rfqData?.location_state as string | null) ?? null,
            rfq_budget_min: (rfqData?.budget_min as number | null) ?? null,
            rfq_budget_max: (rfqData?.budget_max as number | null) ?? null,
            rfq_deadline: (rfqData?.bid_deadline as string | null) ?? null,
            rfq_status: (rfqData?.status as string) ?? '',
            poster_name: posterData?.display_name ?? 'Unknown',
            poster_handle: posterData?.handle ?? '',
          }
        })
      )
    }
    setMyBidsLoading(false)
  }

  async function loadAwarded() {
    if (!profile) return
    setAwardedLoading(true)
    if (isContractor) {
      const { data } = await supabase
        .from('bids')
        .select(
          `id, rfq_id, amount, status, submitted_at,
          rfqs!rfq_id (id, title, trade_needed, location_city, location_state, budget_max, start_date,
            users!poster_id (display_name, handle, avatar_url, location_city, location_state))`
        )
        .eq('bidder_id', profile.id)
        .eq('status', 'awarded')
      if (data) setAwardedItems(data as Record<string, unknown>[])
    } else {
      const { data } = await supabase
        .from('rfqs')
        .select(
          `id, title, trade_needed, budget_max, start_date, created_at,
          users!awarded_to (display_name, handle, avatar_url, location_city, location_state)`
        )
        .eq('poster_id', profile.id)
        .eq('status', 'awarded')
      if (data) setAwardedItems(data as Record<string, unknown>[])
    }
    setAwardedLoading(false)
  }

  async function loadArchived() {
    if (!profile) return
    setArchivedLoading(true)
    const { data } = await supabase
      .from('rfqs')
      .select(
        `id, poster_id, title, trade_needed, project_type, scope_description,
        budget_min, budget_max, sq_footage, start_date, duration_weeks, bid_deadline,
        location_zip, location_city, location_state, requirements, bid_count, status,
        awarded_to, is_boosted, created_at,
        users!poster_id (display_name, handle, avatar_url, account_type)`
      )
      .in('status', ['closed', 'archived'])
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setArchivedRfqs(
        data.map((row: Record<string, unknown>) => {
          const u = row.users as unknown as {
            display_name: string
            handle: string
            avatar_url: string | null
            account_type: string
          } | null
          return {
            ...(row as unknown as RFQ),
            poster_name: u?.display_name ?? undefined,
            poster_handle: u?.handle ?? undefined,
          }
        })
      )
    }
    setArchivedLoading(false)
  }

  const filteredOpen = openRfqs.filter(
    r =>
      (tradeFilter === 'All Trades' || r.trade_needed === tradeFilter) &&
      matchesSizeFilter(r, sizeFilter)
  )

  const TABS: { key: BidTab; label: string; icon: React.ReactNode }[] = [
    { key: 'open', label: 'Open RFQs', icon: <TrendingUp size={13} /> },
    { key: 'mybids', label: isContractor ? 'My Bids' : 'My RFQs', icon: <FileText size={13} /> },
    { key: 'awarded', label: 'Awarded', icon: <Trophy size={13} /> },
    { key: 'archived', label: 'Archived', icon: <Archive size={13} /> },
  ]

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '24px 20px' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: '-0.3px',
            }}
          >
            Bid Board
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {isContractor
              ? 'Browse open RFQs and submit bids for free'
              : 'Post RFQs and find qualified contractors'}
          </p>
        </div>
        <Link
          to="/bids/post"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Plus size={13} /> Post RFQ{' '}
          {!isContractor && (
            <span
              style={{
                fontSize: 10,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 10,
                padding: '1px 6px',
              }}
            >
              10 cr
            </span>
          )}
        </Link>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatBox
          icon={<FileText size={14} />}
          value={statOpenCount}
          label="Open RFQs"
          color="var(--color-brand)"
        />
        <StatBox
          icon={<DollarSign size={14} />}
          value={
            statTotalBudget >= 1000000
              ? `$${(statTotalBudget / 1000000).toFixed(1)}M`
              : statTotalBudget >= 1000
                ? `$${Math.round(statTotalBudget / 1000)}K`
                : `$${statTotalBudget}`
          }
          label="Budget Available"
          color="#059669"
        />
        <StatBox
          icon={<Clock size={14} />}
          value={statClosingCount}
          label="Closing This Week"
          color="#D97706"
        />
        {isContractor && (
          <StatBox
            icon={<AlertCircle size={14} />}
            value={myPendingCount}
            label="My Pending Bids"
            color="#2563EB"
          />
        )}
      </div>

      {/* Tab nav */}
      <div className="card" style={{ padding: '0 20px', marginBottom: 16, overflowX: 'auto' }}>
        <div style={{ display: 'flex' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '14px 18px',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-condensed)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: activeTab === tab.key ? 'var(--color-brand)' : 'var(--color-text-muted)',
                borderBottom:
                  activeTab === tab.key ? '2px solid var(--color-brand)' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* OPEN RFQs TAB */}
      {activeTab === 'open' && (
        <>
          {/* Filter row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <select
                value={tradeFilter}
                onChange={e => setTradeFilter(e.target.value)}
                style={{
                  appearance: 'none',
                  padding: '8px 32px 8px 12px',
                  fontSize: 13,
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {TRADE_OPTIONS.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--color-text-muted)',
                }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={sizeFilter}
                onChange={e => setSizeFilter(e.target.value)}
                style={{
                  appearance: 'none',
                  padding: '8px 32px 8px 12px',
                  fontSize: 13,
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {SIZE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--color-text-muted)',
                }}
              />
            </div>
            {(tradeFilter !== 'All Trades' || sizeFilter !== 'any') && (
              <button
                onClick={() => {
                  setTradeFilter('All Trades')
                  setSizeFilter('any')
                }}
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                Clear filters
              </button>
            )}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                alignSelf: 'center',
              }}
            >
              {filteredOpen.length} RFQ{filteredOpen.length !== 1 ? 's' : ''}
            </span>
          </div>

          {openLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : filteredOpen.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <AlertCircle
                size={28}
                color="var(--color-text-muted)"
                style={{ margin: '0 auto 12px' }}
              />
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No open RFQs found</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {tradeFilter !== 'All Trades' || sizeFilter !== 'any'
                  ? 'Try adjusting your filters.'
                  : 'Be the first to post an RFQ.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredOpen.map(rfq => (
                <RFQCard key={rfq.id} rfq={rfq} isContractor={isContractor} />
              ))}
            </div>
          )}
        </>
      )}

      {/* MY BIDS TAB */}
      {activeTab === 'mybids' && (
        <div>
          {myBidsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : !isContractor ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>My Posted RFQs</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                <Link
                  to="/bids/post"
                  className="btn btn-primary"
                  style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={13} /> Post Your First RFQ
                </Link>
              </p>
            </div>
          ) : myBids.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <FileText
                size={28}
                color="var(--color-text-muted)"
                style={{ margin: '0 auto 12px' }}
              />
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                No bids submitted yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
                Browse open RFQs and submit your first bid.
              </p>
              <button
                onClick={() => setActiveTab('open')}
                className="btn btn-primary"
                style={{ fontSize: 13 }}
              >
                Browse Open RFQs
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myBids.map(bid => {
                const sc = STATUS_COLOR[bid.status] ?? STATUS_COLOR.pending
                return (
                  <Link
                    key={bid.id}
                    to={`/bids/${bid.rfq_id}#my-bid`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="card"
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                        transition: 'transform 0.1s',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: sc.dot,
                              flexShrink: 0,
                            }}
                          />
                          <p
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: 'var(--color-text)',
                              margin: 0,
                            }}
                          >
                            {bid.rfq_title}
                          </p>
                        </div>
                        <p
                          style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 16 }}
                        >
                          {bid.poster_name} · {bid.rfq_trade}
                          {bid.rfq_location_city && ` · ${bid.rfq_location_city}`}
                          {bid.rfq_location_state && `, ${bid.rfq_location_state}`}
                        </p>
                      </div>
                      <div
                        style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}
                      >
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-condensed)',
                              fontWeight: 800,
                              fontSize: 17,
                              color: '#059669',
                            }}
                          >
                            ${bid.amount.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            {timeAgo(bid.submitted_at)}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: sc.color,
                            background: sc.bg,
                            borderRadius: 12,
                            padding: '4px 10px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {bid.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* AWARDED TAB */}
      {activeTab === 'awarded' && (
        <div>
          {awardedLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : awardedItems.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Trophy size={28} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                No awarded contracts yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {isContractor
                  ? 'Keep bidding — your first award is on the way.'
                  : 'Award a bid from the RFQ detail page.'}
              </p>
            </div>
          ) : isContractor ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {awardedItems.map(item => {
                const rfqData = item.rfqs as unknown as Record<string, unknown> | null
                const posterData = rfqData
                  ? (rfqData.users as unknown as {
                      display_name: string
                      handle: string
                      avatar_url: string | null
                      location_city: string | null
                      location_state: string | null
                    } | null)
                  : null
                const rfqStartDate = rfqData?.start_date as string | null | undefined
                return (
                  <Link
                    key={item.id as string}
                    to={`/bids/${item.rfq_id as string}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="card"
                      style={{ padding: '16px 20px', border: '1.5px solid #05966930' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginBottom: 4,
                            }}
                          >
                            <CheckCircle size={13} color="#059669" />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
                              Awarded Contract
                            </span>
                          </div>
                          <p
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                              color: 'var(--color-text)',
                              marginBottom: 4,
                            }}
                          >
                            {(rfqData?.title as string) ?? 'RFQ'}
                          </p>
                          {posterData && (
                            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                              Client: {posterData.display_name}
                              {(posterData.location_city || posterData.location_state) &&
                                ` · ${[posterData.location_city, posterData.location_state].filter(Boolean).join(', ')}`}
                            </p>
                          )}
                          {rfqStartDate && (
                            <p
                              style={{
                                fontSize: 12,
                                color: 'var(--color-text-muted)',
                                marginTop: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <Calendar size={10} /> Starts{' '}
                              {new Date(rfqStartDate).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-condensed)',
                              fontWeight: 800,
                              fontSize: 22,
                              color: '#059669',
                            }}
                          >
                            ${(item.amount as number).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            Contract value
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {awardedItems.map(item => {
                const winnerData = item.users as unknown as {
                  display_name: string
                  handle: string
                  avatar_url: string | null
                  location_city: string | null
                  location_state: string | null
                } | null
                const ownerStartDate = item.start_date as string | null | undefined
                return (
                  <Link
                    key={item.id as string}
                    to={`/bids/${item.id as string}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="card"
                      style={{ padding: '16px 20px', border: '1.5px solid #05966930' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginBottom: 4,
                            }}
                          >
                            <CheckCircle size={13} color="#059669" />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
                              Awarded
                            </span>
                          </div>
                          <p
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                              color: 'var(--color-text)',
                              marginBottom: 4,
                            }}
                          >
                            {item.title as string}
                          </p>
                          {winnerData && (
                            <>
                              <p
                                style={{
                                  fontSize: 13,
                                  color: 'var(--color-text-muted)',
                                  marginBottom: 2,
                                }}
                              >
                                Winner:{' '}
                                <Link
                                  to={`/profile/${winnerData.handle}`}
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontWeight: 700,
                                    color: 'var(--color-brand)',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {winnerData.display_name}
                                </Link>
                              </p>
                            </>
                          )}
                          {ownerStartDate && (
                            <p
                              style={{
                                fontSize: 12,
                                color: 'var(--color-text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <Calendar size={10} />{' '}
                              {new Date(ownerStartDate).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-condensed)',
                              fontWeight: 800,
                              fontSize: 22,
                              color: '#059669',
                            }}
                          >
                            {item.budget_max ? formatBudget(null, item.budget_max as number) : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            Budget
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ARCHIVED TAB */}
      {activeTab === 'archived' && (
        <div>
          {archivedLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : archivedRfqs.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Archive
                size={28}
                color="var(--color-text-muted)"
                style={{ margin: '0 auto 12px' }}
              />
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                No archived RFQs yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {archivedRfqs.map(rfq => (
                <Link key={rfq.id} to={`/bids/${rfq.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: '14px 18px', opacity: 0.8 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}
                        >
                          <span className="tag" style={{ fontSize: 10, padding: '1px 6px' }}>
                            {rfq.status}
                          </span>
                          <span className="tag" style={{ fontSize: 10, padding: '1px 6px' }}>
                            {rfq.trade_needed}
                          </span>
                        </div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                          {rfq.title}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {rfq.poster_name} ·{' '}
                          {[rfq.location_city, rfq.location_state].filter(Boolean).join(', ')} ·{' '}
                          {rfq.bid_count} bids
                        </p>
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-condensed)',
                          fontWeight: 800,
                          fontSize: 16,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {formatBudget(rfq.budget_min, rfq.budget_max)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
