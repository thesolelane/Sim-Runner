import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search,
  Star,
  MapPin,
  Briefcase,
  MessageSquare,
  UserPlus,
  UserCheck,
  SlidersHorizontal,
  X,
  Calendar,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/roles'
import VerifiedBadge from '../components/VerifiedBadge'
import type { BadgeTier } from '../types/profile'

const TRADE_OPTIONS = [
  'Carpentry',
  'Concrete',
  'Drywall',
  'Electrical',
  'Engineering',
  'General Contractor',
  'HVAC',
  'Masonry',
  'Painting',
  'Plumbing',
  'Roofing',
  'Steel/Ironwork',
  'Tile',
  'Other',
]

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
  { label: '4.8+', value: 4.8 },
]

const AVAIL_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Available', value: 'available' },
  { label: 'Busy', value: 'busy' },
]

const RADIUS_OPTIONS = [
  { label: 'Any distance', value: 0 },
  { label: '25+ miles', value: 25 },
  { label: '50+ miles', value: 50 },
  { label: '100+ miles', value: 100 },
  { label: '200+ miles', value: 200 },
]

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
]

interface UserShape {
  display_name: string
  handle: string
  avatar_url: string | null
  location_city: string | null
  location_state: string | null
}

interface ContractorRow {
  id: string
  user_id: string
  primary_trade: string
  business_name: string | null
  bio: string | null
  years_experience: number
  rating_avg: number
  rating_count: number
  projects_completed: number
  service_radius_miles: number
  availability_status: string
  available_from: string | null
  badge_tier: BadgeTier
  user: UserShape
  credentials: { id: string; verified_at: string | null }[]
}

// Raw Supabase join can return user as object or single-element array depending on version
interface RawContractorRow extends Omit<ContractorRow, 'user'> {
  user: UserShape | UserShape[]
}

function normalizeContractor(raw: RawContractorRow): ContractorRow {
  const user = Array.isArray(raw.user) ? raw.user[0] : raw.user
  return { ...raw, user }
}

interface ConnectionState {
  [userId: string]: 'none' | 'pending' | 'accepted'
}

const MSG_COLD_COST = 3

function makeThreadId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

function formatAvailDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Explore() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isContractor = profile?.account_type === 'contractor'
  const isAdmin = isStaff(profile?.account_type)

  const activeTab = (searchParams.get('tab') ?? 'contractors') as 'contractors' | 'nearme'

  function setTab(tab: 'contractors' | 'nearme') {
    const params = new URLSearchParams(searchParams)
    if (tab === 'contractors') params.delete('tab')
    else params.set('tab', tab)
    setSearchParams(params, { replace: true })
  }

  const [myLocationCity, setMyLocationCity] = useState<string | null>(null)
  const [myLocationState, setMyLocationState] = useState<string | null>(null)

  const [allContractors, setAllContractors] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<ConnectionState>({})
  const [connecting, setConnecting] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tradeFilters, setTradeFilters] = useState<Set<string>>(new Set())
  const [availFilter, setAvailFilter] = useState('')
  const [availByDate, setAvailByDate] = useState('')
  const [locationState, setLocationState] = useState('')
  const [radiusMiles, setRadiusMiles] = useState(0)
  const [ratingMin, setRatingMin] = useState(0)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
          const d = data as { location_city: string | null; location_state: string | null }
          setMyLocationCity(d.location_city)
          setMyLocationState(d.location_state)
        }
      })
  }, [profile])

  const loadContractors = useCallback(async () => {
    setLoading(true)

    // --- Pre-query A: users matching the location state (hard AND constraint) ---
    // When locationState is active, ALL results must be from that state.
    let stateUserIds: string[] | null = null
    if (locationState) {
      const { data: ud } = await supabase
        .from('users')
        .select('id')
        .eq('location_state', locationState)
        .limit(2000)
      stateUserIds = (ud ?? []).map((u: { id: string }) => u.id)
      if (stateUserIds.length === 0) {
        // No users in that state — short-circuit
        setAllContractors([])
        setLoading(false)
        return
      }
    }

    // --- Pre-query B: users matching display_name search ---
    // Scoped to the state if locationState is also active (AND logic).
    let nameUserIds: string[] | null = null
    if (debouncedSearch.trim()) {
      let nameQ = supabase
        .from('users')
        .select('id')
        .ilike('display_name', `%${debouncedSearch.trim()}%`)
      if (locationState && stateUserIds) {
        nameQ = nameQ.in('id', stateUserIds) // AND with state constraint
      }
      const { data: nd } = await nameQ.limit(500)
      nameUserIds = (nd ?? []).map((u: { id: string }) => u.id)
    }

    // --- Pre-query C: verified contractor IDs (using badge_tier for verified filter) ---
    let verifiedContractorIds: string[] | null = null
    if (verifiedOnly) {
      const { data: vc } = await supabase
        .from('contractor_profiles')
        .select('id')
        .in('badge_tier', ['pro_verified', 'licensed'])
        .limit(5000)
      verifiedContractorIds = (vc ?? []).map((c: { id: string }) => c.id)
    }

    // --- Main contractor query — all server-side ---
    let q = supabase
      .from('contractor_profiles')
      .select(
        `
        id, user_id, primary_trade, business_name, bio, years_experience,
        rating_avg, rating_count, projects_completed, service_radius_miles,
        availability_status, available_from, badge_tier,
        user:users!user_id (display_name, handle, avatar_url, location_city, location_state),
        credentials (id, verified_at)
      `
      )
      .eq('visible_to_owners', true)

    // Scalar column filters (server-side)
    if (tradeFilters.size > 0) q = q.in('primary_trade', [...tradeFilters])
    if (availFilter) q = q.eq('availability_status', availFilter)
    if (ratingMin > 0) q = q.gte('rating_avg', ratingMin)
    if (availByDate) q = q.lte('available_from', availByDate)
    if (radiusMiles > 0) q = q.gte('service_radius_miles', radiusMiles)
    if (profile) q = q.neq('user_id', profile.id)

    // Location state: hard AND constraint — restrict user_id set
    if (stateUserIds) {
      q = q.in('user_id', stateUserIds)
      // Note: when search is also active, the .or() below uses profile fields already
      // restricted to stateUserIds (because .in() is an AND condition in PostgREST).
    }

    // Search: OR across profile fields + display_name matched user IDs
    if (debouncedSearch.trim()) {
      const profileParts = [
        `business_name.ilike.%${debouncedSearch.trim()}%`,
        `bio.ilike.%${debouncedSearch.trim()}%`,
        `primary_trade.ilike.%${debouncedSearch.trim()}%`,
      ]
      if (nameUserIds && nameUserIds.length > 0) {
        q = q.or(`${profileParts.join(',')},user_id.in.(${nameUserIds.join(',')})`)
      } else {
        // No display_name matches (or zero after state intersection) — profile fields only
        q = q.or(profileParts.join(','))
      }
    }

    // Verified-only: restrict to contractor IDs with verified credentials
    if (verifiedContractorIds !== null) {
      if (verifiedContractorIds.length > 0) {
        q = q.in('id', verifiedContractorIds)
      } else {
        setAllContractors([])
        setLoading(false)
        return
      }
    }

    q = q.order('rating_avg', { ascending: false }).limit(200)

    const { data } = await q
    const rows: ContractorRow[] = (data ?? []).map(r => normalizeContractor(r as RawContractorRow))
    setAllContractors(rows)
    setLoading(false)
  }, [
    tradeFilters,
    availFilter,
    ratingMin,
    availByDate,
    radiusMiles,
    locationState,
    verifiedOnly,
    debouncedSearch,
    profile,
  ])

  const loadConnections = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('connections')
      .select('requester_id, recipient_id, status')
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
    if (!data) return
    const map: ConnectionState = {}
    data.forEach((c: { requester_id: string; recipient_id: string; status: string }) => {
      const otherId = c.requester_id === profile.id ? c.recipient_id : c.requester_id
      if (c.status === 'accepted') map[otherId] = 'accepted'
      else if (c.status === 'pending') map[otherId] = 'pending'
    })
    setConnections(map)
  }, [profile])

  useEffect(() => {
    loadContractors()
  }, [loadContractors])
  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  // All filtering is now server-side; allContractors is the final result (sorting applied at render time)

  async function handleConnect(c: ContractorRow) {
    if (!profile) return
    const uid = c.user_id
    setConnecting(prev => new Set([...prev, uid]))
    const { error } = await supabase.from('connections').insert({
      requester_id: profile.id,
      recipient_id: uid,
      status: 'pending',
    })
    if (!error) setConnections(prev => ({ ...prev, [uid]: 'pending' }))
    setConnecting(prev => {
      const n = new Set(prev)
      n.delete(uid)
      return n
    })
  }

  function handleMessage(c: ContractorRow) {
    if (!profile) return
    const tid = makeThreadId(profile.id, c.user_id)
    navigate(`/messages/${tid}?with=${c.user_id}`)
  }

  function toggleTrade(t: string) {
    setTradeFilters(prev => {
      const n = new Set(prev)
      n.has(t) ? n.delete(t) : n.add(t)
      return n
    })
  }

  function clearFilters() {
    setTradeFilters(new Set())
    setAvailFilter('')
    setAvailByDate('')
    setLocationState('')
    setRadiusMiles(0)
    setRatingMin(0)
    setVerifiedOnly(false)
    setSearch('')
  }

  const hasActiveFilters =
    tradeFilters.size > 0 ||
    availFilter ||
    availByDate ||
    locationState ||
    radiusMiles > 0 ||
    ratingMin > 0 ||
    verifiedOnly ||
    search

  function AvailabilityBadge({ status }: { status: string }) {
    const cfg =
      status === 'available'
        ? { text: 'Available', bg: 'rgba(5,150,105,0.15)', color: '#059669' }
        : status === 'busy'
          ? { text: 'Busy', bg: 'rgba(217,119,6,0.15)', color: '#D97706' }
          : {
              text: 'Not Available',
              bg: 'rgba(107,114,128,0.12)',
              color: 'var(--color-text-muted)',
            }
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          background: cfg.bg,
          color: cfg.color,
          borderRadius: 20,
          padding: '2px 8px',
        }}
      >
        {cfg.text}
      </span>
    )
  }

  const FilterPanel = () => (
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

      {/* Trade */}
      <div style={{ marginBottom: 18 }}>
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
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {TRADE_OPTIONS.map(t => (
            <label
              key={t}
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
                checked={tradeFilters.has(t)}
                onChange={() => toggleTrade(t)}
                style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* Location state */}
      <div style={{ marginBottom: 18 }}>
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
          Location (State)
        </div>
        <select
          value={locationState}
          onChange={e => setLocationState(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 13,
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        >
          <option value="">Any State</option>
          {US_STATES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Service radius */}
      <div style={{ marginBottom: 18 }}>
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
          Service Radius
        </div>
        <p
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          Show contractors willing to serve at least this distance
        </p>
        {RADIUS_OPTIONS.map(opt => (
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
              name="radius"
              checked={radiusMiles === opt.value}
              onChange={() => setRadiusMiles(opt.value)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {/* Availability status */}
      <div style={{ marginBottom: 18 }}>
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
          Availability Status
        </div>
        {AVAIL_OPTIONS.map(opt => (
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
              name="avail"
              checked={availFilter === opt.value}
              onChange={() => setAvailFilter(opt.value)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {/* Available by date */}
      <div style={{ marginBottom: 18 }}>
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
          Available By Date
        </div>
        <input
          type="date"
          value={availByDate}
          onChange={e => setAvailByDate(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 13,
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
        {availByDate && (
          <button
            onClick={() => setAvailByDate('')}
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px 0',
              textDecoration: 'underline',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Rating */}
      <div style={{ marginBottom: 18 }}>
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
          Minimum Rating
        </div>
        {RATING_OPTIONS.map(opt => (
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
              name="rating"
              checked={ratingMin === opt.value}
              onChange={() => setRatingMin(opt.value)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {/* Verified only */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: verifiedOnly ? 600 : 400,
        }}
      >
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={e => setVerifiedOnly(e.target.checked)}
          style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
        />
        Verified credentials only
      </label>
    </div>
  )

  const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E85D04']

  const nearMeContractors = [...allContractors].sort((a, b) => {
    const aCity =
      myLocationCity && a.user.location_city?.toLowerCase() === myLocationCity.toLowerCase()
        ? 0
        : myLocationState && a.user.location_state?.toLowerCase() === myLocationState.toLowerCase()
          ? 1
          : 2
    const bCity =
      myLocationCity && b.user.location_city?.toLowerCase() === myLocationCity.toLowerCase()
        ? 0
        : myLocationState && b.user.location_state?.toLowerCase() === myLocationState.toLowerCase()
          ? 1
          : 2
    return aCity !== bCity ? aCity - bCity : b.rating_avg - a.rating_avg
  })

  const contractors = activeTab === 'nearme' ? nearMeContractors : allContractors

  const EXPLORE_TABS: { key: 'contractors' | 'nearme'; label: string }[] = [
    { key: 'contractors', label: 'Contractors' },
    { key: 'nearme', label: 'Near Me' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 28 }}>
          Explore Contractors
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 3 }}>
          Discover verified tradespeople and professionals
        </p>
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
        {EXPLORE_TABS.map(tab => (
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

      {activeTab === 'nearme' && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: 'var(--color-brand-light)',
            border: '1px solid rgba(232,93,4,0.2)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MapPin size={14} />
          {myLocationCity || myLocationState
            ? `Sorted by proximity to ${[myLocationCity, myLocationState].filter(Boolean).join(', ')}`
            : 'Add your city/state in your profile settings to sort by proximity'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Desktop sidebar */}
        <div className="card explore-sidebar" style={{ padding: 20, width: 240, flexShrink: 0 }}>
          <FilterPanel />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search + mobile filter toggle */}
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
                placeholder="Search name, trade, bio..."
                value={search}
                onChange={e => setSearch(e.target.value)}
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
                  onClick={() => setSearch('')}
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
              onClick={() => setSidebarOpen(o => !o)}
              className="btn btn-ghost explore-filter-btn"
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

            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {loading
                ? '…'
                : `${contractors.length} contractor${contractors.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Mobile inline filter panel */}
          {sidebarOpen && (
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <FilterPanel />
            </div>
          )}

          {/* Credit banner for non-contractors/non-admins */}
          {!isContractor && !isAdmin && (
            <div
              style={{
                background: 'var(--color-brand-light)',
                border: '1px solid rgba(232,93,4,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 13,
                color: 'var(--color-brand)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MessageSquare size={14} /> First message to a contractor costs {MSG_COLD_COST}{' '}
              credits. You have {profile?.credit_balance ?? 0}.
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
              Loading contractors...
            </div>
          ) : contractors.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}
            >
              <p style={{ fontSize: 16, fontWeight: 600 }}>No contractors found</p>
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
            <div
              className="explore-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 14,
              }}
            >
              {contractors.map(c => {
                const u = c.user
                const initials = u.display_name.slice(0, 2).toUpperCase()
                const color = COLORS[c.user_id.charCodeAt(0) % COLORS.length]
                const connState = connections[c.user_id] ?? 'none'
                const availDate = formatAvailDate(c.available_from)

                return (
                  <div key={c.id} className="card" style={{ padding: 18 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          className="avatar-placeholder"
                          style={{
                            width: 48,
                            height: 48,
                            background: color,
                            fontSize: 15,
                            borderRadius: 10,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Link
                            to={`/profile/${u.handle}`}
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: 'var(--color-text)',
                              textDecoration: 'none',
                            }}
                          >
                            {u.display_name}
                          </Link>
                          {c.badge_tier && <VerifiedBadge tier={c.badge_tier} size="sm" />}
                        </div>
                        <div
                          style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}
                        >
                          {c.primary_trade}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 5,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          {c.rating_count > 0 && (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 12,
                                color: '#D97706',
                                fontWeight: 600,
                              }}
                            >
                              <Star size={11} fill="#D97706" /> {Number(c.rating_avg).toFixed(1)} (
                              {c.rating_count})
                            </span>
                          )}
                          {(u.location_city || u.location_state) && (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 12,
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              <MapPin size={11} />{' '}
                              {[u.location_city, u.location_state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            marginTop: 6,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <AvailabilityBadge status={c.availability_status} />
                          {availDate && c.availability_status !== 'available' && (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 11,
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              <Calendar size={10} /> Available {availDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {c.bio && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          lineHeight: 1.6,
                          marginBottom: 12,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {c.bio}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      <span className="badge badge-gray">{c.years_experience}yr exp</span>
                      <span className="badge badge-gray">{c.projects_completed} projects</span>
                      <span className="badge badge-gray">{c.service_radius_miles}mi radius</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link
                        to={`/profile/${u.handle}`}
                        className="btn btn-ghost"
                        style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Briefcase size={12} /> Profile
                      </Link>

                      {connState === 'accepted' ? (
                        <span
                          className="btn btn-ghost"
                          style={{
                            fontSize: 12,
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'default',
                          }}
                        >
                          <UserCheck size={12} /> Connected
                        </span>
                      ) : connState === 'pending' ? (
                        <span
                          className="btn btn-ghost"
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-muted)',
                            cursor: 'default',
                          }}
                        >
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(c)}
                          disabled={connecting.has(c.user_id)}
                          className="btn btn-ghost"
                          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <UserPlus size={12} /> Connect
                        </button>
                      )}

                      <button
                        onClick={() => handleMessage(c)}
                        className="btn btn-primary"
                        style={{
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginLeft: 'auto',
                        }}
                        title={
                          !isContractor && !isAdmin
                            ? `${MSG_COLD_COST} credits for first message`
                            : ''
                        }
                      >
                        <MessageSquare size={12} /> Message
                        {!isContractor && !isAdmin && (
                          <span style={{ opacity: 0.8, fontSize: 10 }}>({MSG_COLD_COST}cr)</span>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .explore-sidebar { display: none; }
        @media (min-width: 900px) {
          .explore-sidebar { display: block !important; }
          .explore-filter-btn { display: none !important; }
        }
      `}</style>
    </div>
  )
}
