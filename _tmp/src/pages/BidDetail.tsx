import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  Loader,
  AlertCircle,
  FileText,
  Award,
  Star,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RFQ, BidRow } from '../types/bids'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return 'TBD'
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

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#D97706', bg: '#FFFBEB', label: 'Pending' },
  under_review: { color: '#2563EB', bg: '#EFF6FF', label: 'Under Review' },
  awarded: { color: '#059669', bg: '#ECFDF5', label: 'Awarded' },
  not_awarded: { color: '#6B7280', bg: '#F3F4F6', label: 'Not Selected' },
}

function BidderCard({
  bid,
  isOwner,
  onAward,
  awarding,
}: {
  bid: BidRow
  isOwner: boolean
  onAward: (bid: BidRow) => void
  awarding: string | null
}) {
  const st = STATUS_STYLE[bid.status] ?? STATUS_STYLE.pending
  return (
    <div
      className="card"
      style={{
        padding: '14px 18px',
        border:
          bid.status === 'awarded' ? '1.5px solid #05966950' : '1.5px solid var(--color-border)',
      }}
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              background: 'var(--color-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 14,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {bid.bidder_name?.slice(0, 2).toUpperCase() ?? '??'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link
                to={`/profile/${bid.bidder_handle}`}
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                }}
              >
                {bid.bidder_name ?? 'Contractor'}
              </Link>
              {bid.bidder_trade && (
                <span className="tag" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {bid.bidder_trade}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
              {bid.bidder_rating !== undefined &&
                bid.bidder_rating_count !== undefined &&
                bid.bidder_rating_count > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Star size={11} fill="#D97706" color="#D97706" /> {bid.bidder_rating.toFixed(1)}{' '}
                    ({bid.bidder_rating_count})
                  </span>
                )}
              {bid.bidder_years_exp !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {bid.bidder_years_exp}yr exp
                </span>
              )}
              {bid.bidder_projects_completed !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {bid.bidder_projects_completed} projects
                </span>
              )}
            </div>
            {bid.cover_note && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  marginTop: 6,
                  lineHeight: 1.5,
                  maxWidth: 440,
                }}
              >
                {bid.cover_note}
              </p>
            )}
            {bid.timeline_weeks && (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Timeline: {bid.timeline_weeks} weeks
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Submitted {timeAgo(bid.submitted_at)}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 22,
              color: '#059669',
            }}
          >
            ${bid.amount.toLocaleString()}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: st.color,
              background: st.bg,
              borderRadius: 12,
              padding: '4px 10px',
            }}
          >
            {st.label}
          </span>
          {isOwner && bid.status !== 'awarded' && (
            <button
              onClick={() => onAward(bid)}
              disabled={awarding === bid.id}
              className="btn btn-primary"
              style={{
                fontSize: 12,
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {awarding === bid.id ? <Loader size={12} className="spin" /> : <Award size={12} />}
              Award Bid
            </button>
          )}
          {bid.document_url && (
            <a
              href={bid.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              View Docs <ChevronRight size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BidDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [bids, setBids] = useState<BidRow[]>([])
  const [myBid, setMyBid] = useState<BidRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [awarding, setAwarding] = useState<string | null>(null)
  const [awardError, setAwardError] = useState('')
  const [awardSuccess, setAwardSuccess] = useState('')

  const isOwner = rfq?.poster_id === profile?.id
  const isContractor = profile?.account_type === 'contractor'
  const hasMyBid = !!myBid

  useEffect(() => {
    if (id) void loadRFQ()
  }, [id])

  async function loadRFQ() {
    setLoading(true)
    const { data, error } = await supabase
      .from('rfqs')
      .select(
        `id, poster_id, title, trade_needed, project_type, scope_description,
        budget_min, budget_max, sq_footage, start_date, duration_weeks, bid_deadline,
        location_zip, location_city, location_state, requirements, bid_count, status,
        awarded_to, is_boosted, created_at,
        users!poster_id (display_name, handle, avatar_url, account_type)`
      )
      .eq('id', id!)
      .single()

    if (error || !data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const row = data as Record<string, unknown>
    const u = row.users as unknown as {
      display_name: string
      handle: string
      avatar_url: string | null
      account_type: string
    } | null
    const rfqObj: RFQ = {
      ...(row as unknown as RFQ),
      poster_name: u?.display_name ?? '',
      poster_handle: u?.handle ?? '',
      poster_avatar: u?.avatar_url ?? null,
      poster_account_type: u?.account_type ?? '',
    }
    setRfq(rfqObj)

    if (profile) {
      const isRfqOwner = rfqObj.poster_id === profile.id
      if (isRfqOwner) {
        await loadAllBids()
      } else if (profile.account_type === 'contractor') {
        await loadMyBid()
      }
    }
    setLoading(false)
  }

  async function loadAllBids() {
    const { data } = await supabase
      .from('bids')
      .select(
        `id, rfq_id, bidder_id, amount, timeline_weeks, cover_note, document_url, status, submitted_at,
        users!bidder_id (display_name, handle, avatar_url,
          contractor_profiles!user_id (primary_trade, years_experience, rating_avg, rating_count, projects_completed))`
      )
      .eq('rfq_id', id!)
      .order('submitted_at', { ascending: true })

    if (data) {
      setBids(
        data.map((row: Record<string, unknown>) => {
          const u = row.users as unknown as {
            display_name: string
            handle: string
            avatar_url: string | null
            contractor_profiles: Record<string, unknown> | null | unknown[]
          } | null
          const cpRaw = u?.contractor_profiles
          const cp = Array.isArray(cpRaw)
            ? (cpRaw[0] as Record<string, unknown> | null)
            : (cpRaw as Record<string, unknown> | null)
          return {
            id: row.id as string,
            rfq_id: row.rfq_id as string,
            bidder_id: row.bidder_id as string,
            amount: row.amount as number,
            timeline_weeks: row.timeline_weeks as number | null,
            cover_note: row.cover_note as string | null,
            document_url: row.document_url as string | null,
            status: row.status as BidRow['status'],
            submitted_at: row.submitted_at as string,
            bidder_name: u?.display_name ?? 'Unknown',
            bidder_handle: u?.handle ?? '',
            bidder_avatar: u?.avatar_url ?? null,
            bidder_trade: (cp?.primary_trade as string | null) ?? null,
            bidder_years_exp: (cp?.years_experience as number) ?? 0,
            bidder_rating: (cp?.rating_avg as number) ?? 0,
            bidder_rating_count: (cp?.rating_count as number) ?? 0,
            bidder_projects_completed: (cp?.projects_completed as number) ?? 0,
          }
        })
      )
    }
  }

  async function loadMyBid() {
    if (!profile) return
    const { data } = await supabase
      .from('bids')
      .select(
        'id, rfq_id, bidder_id, amount, timeline_weeks, cover_note, document_url, status, submitted_at'
      )
      .eq('rfq_id', id!)
      .eq('bidder_id', profile.id)
      .maybeSingle()
    if (data) setMyBid(data as BidRow)
  }

  async function handleAward(bid: BidRow) {
    if (!rfq || !profile) return
    setAwarding(bid.id)
    setAwardError('')
    const { error } = await supabase.rpc('award_bid', {
      p_bid_id: bid.id,
      p_rfq_id: rfq.id,
    })
    if (error) {
      setAwardError('Failed to award bid. Please try again.')
    } else {
      setAwardSuccess(`Bid awarded to ${bid.bidder_name ?? 'contractor'}!`)
      setBids(prev =>
        prev.map(b =>
          b.id === bid.id
            ? { ...b, status: 'awarded' }
            : b.id !== bid.id
              ? { ...b, status: 'not_awarded' }
              : b
        )
      )
      setRfq(prev => (prev ? { ...prev, status: 'awarded', awarded_to: bid.bidder_id } : null))
    }
    setAwarding(null)
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <Loader size={24} className="spin" style={{ color: 'var(--color-text-muted)' }} />
      </div>
    )
  }

  if (notFound || !rfq) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <AlertCircle size={32} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: 'var(--font-condensed)', fontSize: 20, fontWeight: 800 }}>
          RFQ Not Found
        </h2>
        <button
          onClick={() => navigate('/bids')}
          className="btn btn-primary"
          style={{ marginTop: 16 }}
        >
          Back to Bid Board
        </button>
      </div>
    )
  }

  const days = daysUntil(rfq.bid_deadline)
  const deadlineColor = urgencyColor(days)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px' }}>
      {/* Back + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/bids"
          className="btn btn-ghost"
          style={{
            padding: '6px 10px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <ArrowLeft size={14} /> Bid Board
        </Link>
        <div style={{ flex: 1 }} />
        {rfq.status === 'open' && isContractor && !hasMyBid && !isOwner && (
          <Link
            to={`/bids/${rfq.id}/submit`}
            className="btn btn-primary"
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            Submit Bid
          </Link>
        )}
        {hasMyBid && (
          <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_STYLE[myBid!.status].color }}>
            You bid ${myBid!.amount.toLocaleString()} — {STATUS_STYLE[myBid!.status].label}
          </span>
        )}
      </div>

      {awardSuccess && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #059669',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CheckCircle size={14} /> {awardSuccess}
        </div>
      )}
      {awardError && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #DC2626',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertCircle size={14} /> {awardError}
        </div>
      )}

      {/* RFQ header card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          marginBottom: 16,
          borderLeft: rfq.is_boosted ? '3px solid var(--color-brand)' : undefined,
        }}
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
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="tag" style={{ fontSize: 11, padding: '2px 8px' }}>
                {rfq.trade_needed}
              </span>
              {rfq.project_type && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {rfq.project_type}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: rfq.status === 'open' ? '#059669' : '#6B7280',
                  background: rfq.status === 'open' ? '#ECFDF5' : '#F3F4F6',
                  borderRadius: 10,
                  padding: '2px 8px',
                  textTransform: 'capitalize',
                }}
              >
                {rfq.status}
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 26,
                marginBottom: 6,
              }}
            >
              {rfq.title}
            </h1>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              {rfq.poster_name && (
                <Link
                  to={`/profile/${rfq.poster_handle}`}
                  style={{
                    fontSize: 13,
                    color: 'var(--color-brand)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Users size={11} /> {rfq.poster_name}
                </Link>
              )}
              {(rfq.location_city || rfq.location_state) && (
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <MapPin size={11} />{' '}
                  {[rfq.location_city, rfq.location_state].filter(Boolean).join(', ')}{' '}
                  {rfq.location_zip}
                </span>
              )}
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Posted {timeAgo(rfq.created_at)}
              </span>
            </div>

            {/* Key metrics grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                    marginBottom: 4,
                  }}
                >
                  Budget
                </div>
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
              </div>
              {rfq.sq_footage && (
                <div
                  style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                      marginBottom: 4,
                    }}
                  >
                    Sq Footage
                  </div>
                  <div
                    style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 18 }}
                  >
                    {rfq.sq_footage.toLocaleString()} sf
                  </div>
                </div>
              )}
              {rfq.duration_weeks && (
                <div
                  style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                      marginBottom: 4,
                    }}
                  >
                    Duration
                  </div>
                  <div
                    style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 18 }}
                  >
                    {rfq.duration_weeks} weeks
                  </div>
                </div>
              )}
              {rfq.start_date && (
                <div
                  style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Calendar size={9} /> Start Date
                  </div>
                  <div
                    style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 16 }}
                  >
                    {new Date(rfq.start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              )}
              <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Clock size={9} /> Deadline
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: deadlineColor,
                  }}
                >
                  {rfq.bid_deadline
                    ? new Date(rfq.bid_deadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Open'}
                </div>
                {days !== null && (
                  <div style={{ fontSize: 11, color: deadlineColor, marginTop: 1 }}>
                    {days < 0 ? 'Deadline passed' : days === 0 ? 'Due today' : `${days}d left`}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 32,
                color: 'var(--color-text-muted)',
              }}
            >
              {rfq.bid_count}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>bids received</div>
          </div>
        </div>
      </div>

      {/* Scope + requirements */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: rfq.requirements.length > 0 ? '1fr 280px' : '1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ padding: '18px 20px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileText size={13} color="var(--color-brand)" /> Scope of Work
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {rfq.scope_description}
          </p>
        </div>

        {rfq.requirements.length > 0 && (
          <div className="card" style={{ padding: '18px 20px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              Requirements
            </h2>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {rfq.requirements.map((req, i) => (
                <li
                  key={i}
                  style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--color-text)' }}
                >
                  <CheckCircle size={13} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bids section (poster-only full list OR my bid) */}
      {isOwner && (
        <div className="card" style={{ padding: '18px 20px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Users size={13} color="var(--color-brand)" /> Submitted Bids ({bids.length})
          </h2>
          {bids.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No bids submitted yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bids.map(bid => (
                <BidderCard
                  key={bid.id}
                  bid={bid}
                  isOwner={isOwner}
                  onAward={handleAward}
                  awarding={awarding}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isOwner && myBid && (
        <div id="my-bid" className="card" style={{ padding: '18px 20px', scrollMarginTop: 80 }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Your Bid
          </h2>
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
                  fontFamily: 'var(--font-condensed)',
                  fontWeight: 800,
                  fontSize: 26,
                  color: '#059669',
                }}
              >
                ${myBid.amount.toLocaleString()}
              </div>
              {myBid.timeline_weeks && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {myBid.timeline_weeks} week timeline
                </p>
              )}
              {myBid.cover_note && (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    marginTop: 8,
                    lineHeight: 1.6,
                  }}
                >
                  {myBid.cover_note}
                </p>
              )}
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Submitted {timeAgo(myBid.submitted_at)}
              </p>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 14,
                color: STATUS_STYLE[myBid.status].color,
                background: STATUS_STYLE[myBid.status].bg,
              }}
            >
              {STATUS_STYLE[myBid.status].label}
            </span>
          </div>
        </div>
      )}

      {!isOwner && !myBid && isContractor && rfq.status === 'open' && (
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 14 }}>
            You haven't submitted a bid for this RFQ yet.
          </p>
          <Link
            to={`/bids/${rfq.id}/submit`}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Submit Your Bid <DollarSign size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
