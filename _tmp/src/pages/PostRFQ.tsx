import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Calendar,
  Clock,
  FileText,
  Plus,
  X,
  Loader,
  AlertCircle,
  Coins,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/roles'
import { TRADE_OPTIONS } from '../data/trades'

const PROJECT_TYPES = [
  'New Construction',
  'Renovation / Remodel',
  'Addition',
  'Tenant Improvement',
  'Repair / Service',
  'Inspection / Assessment',
  'Design / Consulting',
  'Other',
]

const RFQ_CREDIT_COST = 10

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
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
      {children} {required && <span style={{ color: 'var(--color-brand)' }}>*</span>}
    </label>
  )
}

function inputStyle(wide = true): React.CSSProperties {
  return {
    width: wide ? '100%' : undefined,
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    fontSize: 13,
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box' as const,
  }
}

export default function PostRFQ() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const isContractor = profile?.account_type === 'contractor'
  const isAdmin = isStaff(profile?.account_type)
  const creditBalance = profile?.credit_balance ?? 0
  const canAfford = isContractor || isAdmin || creditBalance >= RFQ_CREDIT_COST

  const [title, setTitle] = useState('')
  const [tradeNeeded, setTradeNeeded] = useState('Electrical')
  const [projectType, setProjectType] = useState('')
  const [scopeDescription, setScopeDescription] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [sqFootage, setSqFootage] = useState('')
  const [startDate, setStartDate] = useState('')
  const [durationWeeks, setDurationWeeks] = useState('')
  const [bidDeadline, setBidDeadline] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [locationZip, setLocationZip] = useState('')
  const [requirements, setRequirements] = useState<string[]>([
    'Licensed and insured',
    'References required',
  ])
  const [newReq, setNewReq] = useState('')
  const [shareToFeed, setShareToFeed] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function addRequirement() {
    const r = newReq.trim()
    if (r && !requirements.includes(r)) {
      setRequirements(prev => [...prev, r])
      setNewReq('')
    }
  }

  function removeRequirement(i: number) {
    setRequirements(prev => prev.filter((_, idx) => idx !== i))
  }

  function parseMoney(s: string): number | null {
    if (!s.trim()) return null
    const n = parseFloat(s.replace(/[$,KkMm]/g, ''))
    if (isNaN(n)) return null
    if (s.toLowerCase().includes('m')) return Math.round(n * 1000000)
    if (s.toLowerCase().includes('k')) return Math.round(n * 1000)
    return n
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (!canAfford) {
      setError('Insufficient credits. You need 10 credits to post an RFQ.')
      return
    }
    if (!locationZip.trim()) {
      setError('ZIP code is required.')
      return
    }
    if (!scopeDescription.trim()) {
      setError('Scope of work is required.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 15000)
      )

      const rpcCall = supabase.rpc('post_rfq', {
        p_title: title.trim(),
        p_trade_needed: tradeNeeded,
        p_project_type: projectType || null,
        p_scope_description: scopeDescription.trim(),
        p_budget_min: parseMoney(budgetMin),
        p_budget_max: parseMoney(budgetMax),
        p_sq_footage: sqFootage ? parseInt(sqFootage) : null,
        p_start_date: startDate || null,
        p_duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
        p_bid_deadline: bidDeadline ? new Date(bidDeadline).toISOString() : null,
        p_location_zip: locationZip.trim(),
        p_location_city: locationCity.trim() || null,
        p_location_state: locationState.trim() || null,
        p_requirements: requirements,
        p_share_to_feed: shareToFeed,
      })

      const { data: newRfqId, error: rfqError } = await Promise.race([rpcCall, timeout])

      if (rfqError || !newRfqId) {
        console.error('[PostRFQ] rpc error:', rfqError)
        setError(rfqError?.message ?? 'Failed to post RFQ. Please try again.')
        return
      }

      void refreshProfile()
      navigate(`/bids/${newRfqId as string}`)
    } catch (err) {
      console.error('[PostRFQ] unexpected error:', err)
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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
        <div>
          <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 24 }}>
            Post an RFQ
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {isContractor || isAdmin
              ? 'Free'
              : `Costs ${RFQ_CREDIT_COST} credits (you have ${creditBalance})`}
          </p>
        </div>
      </div>

      {/* Credit warning for non-contractors/non-admins */}
      {!isContractor && !isAdmin && (
        <div
          style={{
            background: canAfford ? '#FFFBEB' : '#FEF2F2',
            border: `1px solid ${canAfford ? '#D97706' : '#DC2626'}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: canAfford ? '#D97706' : '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Coins size={14} />
          {canAfford
            ? `Posting this RFQ will deduct ${RFQ_CREDIT_COST} credits. You have ${creditBalance} credits.`
            : `Insufficient credits. You need ${RFQ_CREDIT_COST} credits but have ${creditBalance}. Purchase credits in Settings.`}
        </div>
      )}

      <form onSubmit={e => void handleSubmit(e)}>
        {error && (
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
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {/* Core info */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 14 }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileText size={13} color="var(--color-brand)" /> Project Details
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FieldLabel required>RFQ Title</FieldLabel>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="e.g. Commercial Electrical Subcontractor Needed — 45,000 sf Office"
                style={inputStyle()}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <FieldLabel required>Trade Needed</FieldLabel>
                <select
                  value={tradeNeeded}
                  onChange={e => setTradeNeeded(e.target.value)}
                  style={inputStyle()}
                >
                  {TRADE_OPTIONS.filter(t => t !== 'All Trades').map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Project Type</FieldLabel>
                <select
                  value={projectType}
                  onChange={e => setProjectType(e.target.value)}
                  style={inputStyle()}
                >
                  <option value="">Select type...</option>
                  {PROJECT_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <FieldLabel required>Scope of Work</FieldLabel>
              <textarea
                value={scopeDescription}
                onChange={e => setScopeDescription(e.target.value)}
                required
                rows={6}
                placeholder="Describe the full scope of work including specifications, materials, phasing, and any special requirements..."
                style={{ ...inputStyle(), resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>
        </div>

        {/* Budget & size */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 14 }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <DollarSign size={13} color="var(--color-brand)" /> Budget & Scale
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Budget Min</FieldLabel>
              <input
                value={budgetMin}
                onChange={e => setBudgetMin(e.target.value)}
                placeholder="e.g. 200000"
                style={inputStyle()}
              />
            </div>
            <div>
              <FieldLabel>Budget Max</FieldLabel>
              <input
                value={budgetMax}
                onChange={e => setBudgetMax(e.target.value)}
                placeholder="e.g. 280000"
                style={inputStyle()}
              />
            </div>
            <div>
              <FieldLabel>Sq Footage</FieldLabel>
              <input
                type="number"
                value={sqFootage}
                onChange={e => setSqFootage(e.target.value)}
                placeholder="e.g. 45000"
                min={0}
                style={inputStyle()}
              />
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 14 }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Calendar size={13} color="var(--color-brand)" /> Schedule
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Target Start Date</FieldLabel>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={inputStyle()}
              />
            </div>
            <div>
              <FieldLabel>Duration (weeks)</FieldLabel>
              <input
                type="number"
                value={durationWeeks}
                onChange={e => setDurationWeeks(e.target.value)}
                placeholder="e.g. 14"
                min={1}
                style={inputStyle()}
              />
            </div>
            <div>
              <FieldLabel>Bid Deadline</FieldLabel>
              <input
                type="datetime-local"
                value={bidDeadline}
                onChange={e => setBidDeadline(e.target.value)}
                style={inputStyle()}
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 14 }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MapPin size={13} color="var(--color-brand)" /> Project Location
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>City</FieldLabel>
              <input
                value={locationCity}
                onChange={e => setLocationCity(e.target.value)}
                placeholder="Austin"
                style={inputStyle()}
              />
            </div>
            <div>
              <FieldLabel>State</FieldLabel>
              <input
                value={locationState}
                onChange={e => setLocationState(e.target.value)}
                placeholder="TX"
                maxLength={2}
                style={inputStyle()}
              />
            </div>
            <div>
              <FieldLabel required>ZIP Code</FieldLabel>
              <input
                value={locationZip}
                onChange={e => setLocationZip(e.target.value)}
                placeholder="78701"
                required
                maxLength={10}
                style={inputStyle()}
              />
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 14 }}>
          <h2
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 16,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={13} color="var(--color-brand)" /> Contractor Requirements
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {requirements.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--color-bg)',
                  borderRadius: 6,
                  padding: '6px 10px',
                }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>{r}</span>
                <button
                  type="button"
                  onClick={() => removeRequirement(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: 2,
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newReq}
              onChange={e => setNewReq(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRequirement()
                }
              }}
              placeholder="Add a requirement..."
              style={{ ...inputStyle(), flex: 1 }}
            />
            <button
              type="button"
              onClick={addRequirement}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        {/* Share to feed option */}
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={shareToFeed}
              onChange={e => setShareToFeed(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <div>
              <p style={{ fontWeight: 600, fontSize: 13 }}>Share to Feed</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Post a summary to your network feed as a Bid post
              </p>
            </div>
          </label>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link to="/bids" className="btn btn-ghost" style={{ fontSize: 13 }}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={
              submitting ||
              !canAfford ||
              !title.trim() ||
              !scopeDescription.trim() ||
              !locationZip.trim()
            }
            className="btn btn-primary"
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, minWidth: 160 }}
          >
            {submitting ? <Loader size={13} className="spin" /> : <Plus size={13} />}
            {submitting
              ? 'Posting...'
              : `Post RFQ${!isContractor && !isAdmin ? ` (${RFQ_CREDIT_COST} credits)` : ''}`}
          </button>
        </div>
      </form>
    </div>
  )
}
