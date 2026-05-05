import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Briefcase,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Plus,
  X,
  SlidersHorizontal,
  MapPin,
  Bookmark,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import JobCard from '../components/JobCard'
import {
  JobListing,
  JobApplication,
  TRADE_OPTIONS,
  CERT_OPTIONS,
  PAY_RANGE_OPTIONS,
  JOB_TYPE_DISPLAY_OPTIONS,
  PayRangeOption,
  formatPay,
  timeAgo as jobTimeAgo,
} from '../types/jobs'

type SortMode = 'newest' | 'closest' | 'pay' | 'urgent'
type JobTab = 'browse' | 'applications' | 'saved'

const PAGE_SIZE = 20

interface Stats {
  totalOpen: number
  postedThisWeek: number
  urgentCount: number
  payLow: number | null
  payHigh: number | null
}

interface ApplicationWithListing extends JobApplication {
  listing: JobListing | null
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
    <div
      className="card"
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flex: '1 1 140px',
        minWidth: 130,
      }}
    >
      <div
        style={{ color, background: color + '18', borderRadius: 8, padding: 7, display: 'flex' }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function AppStatusBadge({ status }: { status: JobApplication['status'] }) {
  const cfg = {
    applied: { label: 'Applied', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
    reviewed: { label: 'Reviewed', color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
    accepted: { label: 'Accepted', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
  }[status]
  const Icon = status === 'accepted' ? CheckCircle : status === 'rejected' ? XCircle : Clock
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        borderRadius: 20,
        padding: '3px 10px',
      }}
    >
      <Icon size={11} /> {cfg.label}
    </span>
  )
}

export default function Jobs() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isContractor = profile?.account_type === 'contractor'

  const activeTab = (searchParams.get('tab') ?? 'browse') as JobTab

  function setTab(tab: JobTab) {
    const params = new URLSearchParams(searchParams)
    if (tab === 'browse') params.delete('tab')
    else params.set('tab', tab)
    setSearchParams(params, { replace: true })
  }

  const [listings, setListings] = useState<JobListing[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Stats>({
    totalOpen: 0,
    postedThisWeek: 0,
    urgentCount: 0,
    payLow: null,
    payHigh: null,
  })

  const [applications, setApplications] = useState<ApplicationWithListing[]>([])
  const [loadingApps, setLoadingApps] = useState(false)

  const [savedListings, setSavedListings] = useState<JobListing[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [tradeFilters, setTradeFilters] = useState<Set<string>>(new Set())
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [payRange, setPayRange] = useState<PayRangeOption | null>(null)
  const [certFilters, setCertFilters] = useState<Set<string>>(new Set())

  const [locationInput, setLocationInput] = useState('')

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(debounceTimer.current)
  }, [search])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('users')
      .select('location_city, location_state')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const city =
            (data as { location_city: string | null; location_state: string | null })
              .location_city ?? ''
          const state =
            (data as { location_city: string | null; location_state: string | null })
              .location_state ?? ''
          if (city) setLocationInput(`${city}, ${state}`)
        }
      })
  }, [profile])

  function buildQuery(offset: number) {
    let q = supabase
      .from('job_listings')
      .select('*, poster:users!poster_id (display_name, handle, avatar_url)')
      .eq('status', 'open')

    if (debouncedSearch.trim()) {
      q = q.or(
        `title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%,trade_required.ilike.%${debouncedSearch}%,location_city.ilike.%${debouncedSearch}%`
      )
    }
    if (tradeFilters.size > 0) q = q.in('trade_required', [...tradeFilters])
    if (typeFilters.size > 0) q = q.in('job_type', [...typeFilters])
    if (payRange) {
      if (payRange.min !== null) q = q.gte('pay_min', payRange.min)
      if (payRange.max !== null) q = q.lte('pay_min', payRange.max)
    }
    if (certFilters.size > 0) q = q.contains('certs_required', [...certFilters])

    if (sortMode === 'pay') {
      q = q
        .order('pay_max', { ascending: false, nullsFirst: false })
        .order('pay_min', { ascending: false, nullsFirst: false })
    } else if (sortMode === 'urgent') {
      q = q
        .order('is_urgent', { ascending: false })
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })
    } else {
      q = q.order('is_boosted', { ascending: false }).order('created_at', { ascending: false })
    }

    return q.range(offset, offset + PAGE_SIZE - 1)
  }

  const loadListings = useCallback(
    async (pageNum = 0) => {
      if (pageNum === 0) setLoading(true)
      else setLoadingMore(true)

      const offset = pageNum * PAGE_SIZE
      const { data } = await buildQuery(offset)
      const rows = (data ?? []) as JobListing[]

      if (sortMode === 'closest') {
        const city = locationInput.split(',')[0]?.trim().toLowerCase() ?? ''
        const state = locationInput.split(',')[1]?.trim().toLowerCase() ?? ''
        rows.sort((a, b) => {
          const aCity =
            a.location_city.toLowerCase() === city
              ? 0
              : a.location_state.toLowerCase() === state
                ? 1
                : 2
          const bCity =
            b.location_city.toLowerCase() === city
              ? 0
              : b.location_state.toLowerCase() === state
                ? 1
                : 2
          return aCity - bCity
        })
      }

      if (pageNum === 0) setListings(rows)
      else setListings(prev => [...prev, ...rows])

      setHasMore(rows.length === PAGE_SIZE)
      if (pageNum === 0) setLoading(false)
      else setLoadingMore(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, tradeFilters, typeFilters, payRange, certFilters, sortMode, locationInput]
  )

  const loadStats = useCallback(async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [countRes, weekRes, urgentRes, payRes] = await Promise.all([
      supabase
        .from('job_listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('job_listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('created_at', weekAgo),
      supabase
        .from('job_listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('is_urgent', true),
      supabase
        .from('job_listings')
        .select('pay_min, pay_max')
        .eq('status', 'open')
        .not('pay_min', 'is', null)
        .limit(200),
    ])
    const payData = (payRes.data ?? []) as { pay_min: number; pay_max: number | null }[]
    const allPay = payData.flatMap(r => [r.pay_min, r.pay_max].filter(Boolean) as number[])
    setStats({
      totalOpen: countRes.count ?? 0,
      postedThisWeek: weekRes.count ?? 0,
      urgentCount: urgentRes.count ?? 0,
      payLow: allPay.length ? Math.min(...allPay) : null,
      payHigh: allPay.length ? Math.max(...allPay) : null,
    })
  }, [])

  const loadSavedIds = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('interaction_events')
      .select('entity_id')
      .eq('user_id', profile.id)
      .eq('event_type', 'job_save')
      .eq('entity_type', 'job_listing')
    if (data) setSavedIds(new Set(data.map((r: { entity_id: string }) => r.entity_id)))
  }, [profile])

  const loadApplications = useCallback(async () => {
    if (!profile) return
    setLoadingApps(true)
    const { data } = await supabase
      .from('job_applications')
      .select('id, listing_id, applicant_id, cover_note, status, created_at')
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false })

    if (!data) {
      setLoadingApps(false)
      return
    }

    const apps = data as JobApplication[]
    const listingIds = [...new Set(apps.map(a => a.listing_id))]
    const { data: listingsData } = await supabase
      .from('job_listings')
      .select('*, poster:users!poster_id (display_name, handle, avatar_url)')
      .in('id', listingIds)

    const listingMap = new Map<string, JobListing>(
      ((listingsData ?? []) as JobListing[]).map(l => [l.id, l])
    )

    setApplications(
      apps.map(app => ({
        ...app,
        listing: listingMap.get(app.listing_id) ?? null,
      }))
    )
    setLoadingApps(false)
  }, [profile])

  const loadSavedListings = useCallback(async () => {
    if (!profile) return
    setLoadingSaved(true)
    const { data: savedData } = await supabase
      .from('interaction_events')
      .select('entity_id')
      .eq('user_id', profile.id)
      .eq('event_type', 'job_save')
      .eq('entity_type', 'job_listing')

    if (!savedData || savedData.length === 0) {
      setLoadingSaved(false)
      return
    }

    const ids = savedData.map((r: { entity_id: string }) => r.entity_id)
    setSavedIds(new Set(ids))

    const { data: listingsData } = await supabase
      .from('job_listings')
      .select('*, poster:users!poster_id (display_name, handle, avatar_url)')
      .in('id', ids)
      .order('created_at', { ascending: false })

    setSavedListings((listingsData ?? []) as JobListing[])
    setLoadingSaved(false)
  }, [profile])

  useEffect(() => {
    setPage(0)
    loadListings(0)
  }, [loadListings])

  useEffect(() => {
    loadStats()
    loadSavedIds()
  }, [loadStats, loadSavedIds])

  useEffect(() => {
    if (activeTab === 'applications') loadApplications()
  }, [activeTab, loadApplications])

  useEffect(() => {
    if (activeTab === 'saved') loadSavedListings()
  }, [activeTab, loadSavedListings])

  async function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    await loadListings(nextPage)
  }

  async function handleSave(listingId: string) {
    if (!profile || savedIds.has(listingId)) return
    setSavedIds(prev => new Set([...prev, listingId]))
    await supabase.from('interaction_events').insert({
      user_id: profile.id,
      event_type: 'job_save',
      entity_id: listingId,
      entity_type: 'job_listing',
    })
  }

  function toggleTrade(trade: string) {
    setPage(0)
    setTradeFilters(prev => {
      const n = new Set(prev)
      n.has(trade) ? n.delete(trade) : n.add(trade)
      return n
    })
  }

  function toggleType(type: string) {
    setPage(0)
    setTypeFilters(prev => {
      const n = new Set(prev)
      n.has(type) ? n.delete(type) : n.add(type)
      return n
    })
  }

  function toggleCert(cert: string) {
    setPage(0)
    setCertFilters(prev => {
      const n = new Set(prev)
      n.has(cert) ? n.delete(cert) : n.add(cert)
      return n
    })
  }

  function clearFilters() {
    setTradeFilters(new Set())
    setTypeFilters(new Set())
    setPayRange(null)
    setCertFilters(new Set())
    setSearch('')
    setPage(0)
  }

  const hasActiveFilters =
    tradeFilters.size > 0 ||
    typeFilters.size > 0 ||
    payRange !== null ||
    certFilters.size > 0 ||
    search

  const payRangeLabel =
    stats.payLow !== null && stats.payHigh !== null ? `$${stats.payLow}–$${stats.payHigh}/hr` : '—'

  const SORT_OPTS: { key: SortMode; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'closest', label: 'Closest' },
    { key: 'pay', label: 'Pay' },
    { key: 'urgent', label: 'Urgent' },
  ]

  const TABS: { key: JobTab; label: string }[] = [
    { key: 'browse', label: 'Browse Jobs' },
    { key: 'applications', label: 'My Applications' },
    { key: 'saved', label: 'Saved Jobs' },
  ]

  const SidebarContent = () => (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, fontSize: 15 }}>
          Filters
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              fontSize: 12,
              color: 'var(--color-brand)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: 10,
          }}
        >
          Job Type
        </div>
        {JOB_TYPE_DISPLAY_OPTIONS.map(opt => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={typeFilters.has(opt.value)}
              onChange={() => toggleType(opt.value)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: 10,
          }}
        >
          Trade
        </div>
        <div style={{ maxHeight: 210, overflowY: 'auto', paddingRight: 4 }}>
          {TRADE_OPTIONS.map(trade => (
            <label
              key={trade}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 7,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={tradeFilters.has(trade)}
                onChange={() => toggleTrade(trade)}
                style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
              />
              {trade}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: 10,
          }}
        >
          Pay Range (hourly)
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <input
            type="radio"
            name="payRange"
            checked={payRange === null}
            onChange={() => {
              setPayRange(null)
              setPage(0)
            }}
            style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
          />
          Any pay
        </label>
        {PAY_RANGE_OPTIONS.map(opt => (
          <label
            key={opt.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <input
              type="radio"
              name="payRange"
              checked={payRange?.label === opt.label}
              onChange={() => {
                setPayRange(opt)
                setPage(0)
              }}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: 10,
          }}
        >
          Requirements
        </div>
        {CERT_OPTIONS.map(cert => (
          <label
            key={cert}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={certFilters.has(cert)}
              onChange={() => toggleCert(cert)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {cert}
          </label>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 28,
              color: 'var(--color-text)',
            }}
          >
            Job Board
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 3 }}>
            Find jobs, contracts, and subcontracting opportunities in the trades
          </p>
        </div>
        <Link
          to="/jobs/post"
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={14} /> Post a Job
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatBox
          icon={<Briefcase size={14} />}
          value={stats.totalOpen}
          label="Open Jobs"
          color="var(--color-brand)"
        />
        <StatBox
          icon={<TrendingUp size={14} />}
          value={stats.postedThisWeek}
          label="Posted This Week"
          color="#059669"
        />
        <StatBox
          icon={<AlertCircle size={14} />}
          value={stats.urgentCount}
          label="Urgent Listings"
          color="#DC2626"
        />
        <StatBox
          icon={<DollarSign size={14} />}
          value={payRangeLabel}
          label="Pay Range"
          color="#2563EB"
        />
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 20,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--font-condensed)',
              letterSpacing: '0.3px',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === tab.key ? '2px solid var(--color-brand)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--color-brand)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div
            className="card"
            style={{ padding: 20, width: 240, flexShrink: 0, display: 'none' }}
            id="jobs-sidebar"
          >
            <SidebarContent />
          </div>

          <style>{`
            @media (min-width: 900px) {
              #jobs-sidebar { display: block !important; }
              #jobs-filter-toggle { display: none !important; }
            }
          `}</style>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={14}
                  color="var(--color-text-muted)"
                  style={{ position: 'absolute', left: 10 }}
                />
                <input
                  type="text"
                  placeholder="Search jobs, trades, locations..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 32px',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    outline: 'none',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('')
                      setPage(0)
                    }}
                    style={{
                      position: 'absolute',
                      right: 8,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                id="jobs-filter-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="btn btn-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 13,
                  position: 'relative',
                }}
              >
                <SlidersHorizontal size={13} /> Filters
                {hasActiveFilters && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--color-brand)',
                      position: 'absolute',
                      top: 5,
                      right: 5,
                    }}
                  />
                )}
              </button>
            </div>

            {sidebarOpen && (
              <div className="card" style={{ padding: 20, marginBottom: 14 }}>
                <SidebarContent />
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: sortMode === 'closest' ? 10 : 14,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {SORT_OPTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSortMode(s.key)
                    setPage(0)
                  }}
                  className={`btn ${sortMode === s.key ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  {s.label}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
                {listings.length}
                {hasMore ? '+' : ''} result{listings.length !== 1 ? 's' : ''}
              </span>
            </div>

            {sortMode === 'closest' && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={13} color="var(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Your city, state (e.g. Austin, TX)"
                  value={locationInput}
                  onChange={e => {
                    setLocationInput(e.target.value)
                    setPage(0)
                  }}
                  style={{
                    padding: '7px 12px',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    outline: 'none',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    width: 240,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Sorted by city/state match
                </span>
              </div>
            )}

            {hasActiveFilters && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {[...tradeFilters].map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTrade(t)}
                    className="badge badge-brand"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {t} <X size={10} />
                  </button>
                ))}
                {[...typeFilters].map(t => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className="badge badge-blue"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {JOB_TYPE_DISPLAY_OPTIONS.find(o => o.value === t)?.label ?? t} <X size={10} />
                  </button>
                ))}
                {payRange && (
                  <button
                    onClick={() => {
                      setPayRange(null)
                      setPage(0)
                    }}
                    className="badge badge-green"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {payRange.label} <X size={10} />
                  </button>
                )}
                {[...certFilters].map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCert(c)}
                    className="badge badge-yellow"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {c} <X size={10} />
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 0',
                  color: 'var(--color-text-muted)',
                  fontSize: 14,
                }}
              >
                Loading jobs...
              </div>
            ) : listings.length === 0 ? (
              <div
                style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}
              >
                <p style={{ fontSize: 16, fontWeight: 600 }}>No jobs found</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>
                  Try adjusting your filters or{' '}
                  <button
                    onClick={clearFilters}
                    style={{
                      color: 'var(--color-brand)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    clear all
                  </button>
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {listings.map(listing => (
                    <JobCard
                      key={listing.id}
                      listing={listing}
                      isContractor={isContractor}
                      saved={savedIds.has(listing.id)}
                      onSave={() => handleSave(listing.id)}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: '10px 28px' }}
                    >
                      {loadingMore ? 'Loading…' : 'Load More Jobs'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'applications' && (
        <div style={{ maxWidth: 720 }}>
          {loadingApps ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 0',
                color: 'var(--color-text-muted)',
                fontSize: 14,
              }}
            >
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}
            >
              <Briefcase size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600 }}>No applications yet</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                When you apply to jobs, they'll appear here.{' '}
                <button
                  onClick={() => setTab('browse')}
                  style={{
                    color: 'var(--color-brand)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Browse jobs
                </button>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {applications.map(app => (
                <div key={app.id} className="card" style={{ padding: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {app.listing ? (
                        <Link
                          to={`/jobs/${app.listing_id}`}
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: 'var(--color-text)',
                            textDecoration: 'none',
                          }}
                        >
                          {app.listing.title}
                        </Link>
                      ) : (
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          Job no longer available
                        </span>
                      )}
                      {app.listing && (
                        <div
                          style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}
                        >
                          {app.listing.poster?.display_name} · {app.listing.location_city},{' '}
                          {app.listing.location_state}
                          {app.listing.pay_min || app.listing.pay_max
                            ? ` · ${formatPay(app.listing)}`
                            : ''}
                        </div>
                      )}
                    </div>
                    <AppStatusBadge status={app.status} />
                  </div>
                  {app.cover_note && (
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.6,
                        borderTop: '1px solid var(--color-border)',
                        paddingTop: 10,
                        marginTop: 4,
                      }}
                    >
                      {app.cover_note}
                    </p>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                    Applied {jobTimeAgo(app.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'saved' && (
        <div style={{ maxWidth: 720 }}>
          {loadingSaved ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 0',
                color: 'var(--color-text-muted)',
                fontSize: 14,
              }}
            >
              Loading saved jobs...
            </div>
          ) : savedListings.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}
            >
              <Bookmark size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600 }}>No saved jobs yet</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                Bookmark jobs from the{' '}
                <button
                  onClick={() => setTab('browse')}
                  style={{
                    color: 'var(--color-brand)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Browse Jobs
                </button>{' '}
                tab.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {savedListings.map(listing => (
                <JobCard
                  key={listing.id}
                  listing={listing}
                  isContractor={isContractor}
                  saved={true}
                  onSave={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
