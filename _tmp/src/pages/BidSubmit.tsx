import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  Clock,
  FileText,
  Upload,
  Loader,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RFQ } from '../types/bids'

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

export default function BidSubmit() {
  const { id } = useParams<{ id: string }>()
  const { profile, canDelegate, logDelegateAction, delegateSession } = useAuth()
  const navigate = useNavigate()

  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [alreadyBid, setAlreadyBid] = useState(false)
  const [notEligible, setNotEligible] = useState(false)

  const [amount, setAmount] = useState('')
  const [timelineWeeks, setTimelineWeeks] = useState('')
  const [coverNote, setCoverNote] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (id && profile) void checkEligibility()
  }, [id, profile])

  async function checkEligibility() {
    setLoading(true)

    if (!profile || profile.account_type !== 'contractor') {
      setNotEligible(true)
      setLoading(false)
      return
    }

    if (!canDelegate('bid')) {
      setNotEligible(true)
      setLoading(false)
      return
    }

    const { data: rfqData, error } = await supabase
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

    if (error || !rfqData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const row = rfqData as Record<string, unknown>
    const u = row.users as unknown as { display_name: string; handle: string } | null
    const rfqObj: RFQ = {
      ...(row as unknown as RFQ),
      poster_name: u?.display_name ?? '',
      poster_handle: u?.handle ?? '',
    }
    setRfq(rfqObj)

    if (rfqObj.poster_id === profile.id || rfqObj.status !== 'open') {
      setNotEligible(true)
      setLoading(false)
      return
    }

    const { data: existing } = await supabase
      .from('bids')
      .select('id')
      .eq('rfq_id', id!)
      .eq('bidder_id', profile.id)
      .maybeSingle()

    if (existing) setAlreadyBid(true)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !rfq || !amount.trim()) return
    const numAmount = parseFloat(amount.replace(/[$,]/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setSubmitError('Please enter a valid dollar amount.')
      return
    }

    setSubmitting(true)
    setSubmitError('')

    const { error: bidError } = await supabase.rpc('submit_bid', {
      p_rfq_id: rfq.id,
      p_amount: numAmount,
      p_timeline_weeks: timelineWeeks ? parseInt(timelineWeeks) : null,
      p_cover_note: coverNote.trim() || null,
      p_document_url: documentUrl.trim() || null,
    })

    if (bidError) {
      if (
        bidError.message.includes('duplicate') ||
        bidError.message.includes('unique') ||
        bidError.code === '23505'
      ) {
        setSubmitError('You have already submitted a bid for this RFQ.')
      } else {
        setSubmitError(bidError.message || 'Failed to submit bid. Please try again.')
      }
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
    if (delegateSession) {
      void logDelegateAction('submit_bid', { rfq_id: id })
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <Loader size={22} className="spin" style={{ color: 'var(--color-text-muted)' }} />
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: '#ECFDF5',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <CheckCircle size={30} color="#059669" />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Bid Submitted!
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Your bid for <strong>{rfq?.title}</strong> has been submitted. You'll be notified when the
          poster responds.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/bids')}
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
          >
            Back to Bid Board
          </button>
          <button
            onClick={() => navigate(`/bids/${rfq?.id}`)}
            className="btn btn-primary"
            style={{ fontSize: 13 }}
          >
            View RFQ
          </button>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
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

  if (notEligible) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <AlertCircle size={32} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: 'var(--font-condensed)', fontSize: 20, fontWeight: 800 }}>
          Not Eligible
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>
          Only contractors can submit bids. If you're the poster or this RFQ is closed, bidding is
          unavailable.
        </p>
        <button
          onClick={() => navigate(`/bids/${id}`)}
          className="btn btn-primary"
          style={{ marginTop: 16 }}
        >
          View RFQ
        </button>
      </div>
    )
  }

  if (alreadyBid) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <CheckCircle size={32} color="#059669" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: 'var(--font-condensed)', fontSize: 20, fontWeight: 800 }}>
          Already Bid
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>
          You have already submitted a bid for this RFQ.
        </p>
        <button
          onClick={() => navigate(`/bids/${id}`)}
          className="btn btn-primary"
          style={{ marginTop: 16 }}
        >
          View Your Bid
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link
          to={`/bids/${id}`}
          className="btn btn-ghost"
          style={{
            padding: '6px 10px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <ArrowLeft size={14} /> Back to RFQ
        </Link>
        <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 22 }}>
          Submit Bid
        </h1>
      </div>

      {/* RFQ summary */}
      {rfq && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            marginBottom: 16,
            borderLeft: '3px solid var(--color-brand)',
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>
            Bidding on
          </p>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{rfq.title}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <span className="tag" style={{ fontSize: 11, padding: '1px 6px' }}>
              {rfq.trade_needed}
            </span>
            {rfq.location_city && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {rfq.location_city}, {rfq.location_state}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
              {formatBudget(rfq.budget_min, rfq.budget_max)}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={e => void handleSubmit(e)}>
        <div
          className="card"
          style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          {submitError && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #DC2626',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertCircle size={13} /> {submitError}
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                display: 'block',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}
            >
              <DollarSign size={11} style={{ display: 'inline', marginRight: 3 }} />
              Bid Amount *
            </label>
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 285000 or 45000"
              required
              style={{
                width: '100%',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 14,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Enter your total bid price in USD (numbers only, no symbols needed)
            </p>
          </div>

          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                display: 'block',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}
            >
              <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
              Timeline (weeks)
            </label>
            <input
              type="number"
              value={timelineWeeks}
              onChange={e => setTimelineWeeks(e.target.value)}
              min={1}
              max={520}
              placeholder="e.g. 14"
              style={{
                width: '100%',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 14,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                display: 'block',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}
            >
              <FileText size={11} style={{ display: 'inline', marginRight: 3 }} />
              Cover Note
            </label>
            <textarea
              value={coverNote}
              onChange={e => setCoverNote(e.target.value)}
              rows={5}
              placeholder="Describe your relevant experience, approach, and why you're the right fit for this project..."
              style={{
                width: '100%',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 13,
                resize: 'vertical',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
                lineHeight: 1.6,
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                display: 'block',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}
            >
              <Upload size={11} style={{ display: 'inline', marginRight: 3 }} />
              Document URL (optional)
            </label>
            <input
              type="url"
              value={documentUrl}
              onChange={e => setDocumentUrl(e.target.value)}
              placeholder="https://drive.google.com/... or Dropbox link"
              style={{
                width: '100%',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 13,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Link to a proposal, past work samples, or certifications
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Link to={`/bids/${id}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !amount.trim()}
              className="btn btn-primary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, minWidth: 130 }}
            >
              {submitting ? <Loader size={13} className="spin" /> : <DollarSign size={13} />}
              {submitting ? 'Submitting...' : 'Submit Bid'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
