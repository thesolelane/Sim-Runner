import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  TRADE_OPTIONS,
  JOB_TYPE_DISPLAY_OPTIONS,
  CERT_OPTIONS,
  JOB_CREDIT_COST,
} from '../types/jobs'

export default function PostJob() {
  const navigate = useNavigate()
  const { profile, refreshProfile, canDelegate, logDelegateAction, delegateSession } = useAuth()
  const isContractor = profile?.account_type === 'contractor'
  const creditBalance = profile?.credit_balance ?? 0
  const canAfford = isContractor || creditBalance >= JOB_CREDIT_COST

  const [title, setTitle] = useState('')
  const [tradeRequired, setTradeRequired] = useState(TRADE_OPTIONS[0])
  const [jobType, setJobType] = useState<'full_time' | 'contract' | 'per_diem' | 'subcontract'>(
    'contract'
  )
  const [description, setDescription] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [payMin, setPayMin] = useState('')
  const [payMax, setPayMax] = useState('')
  const [payUnit, setPayUnit] = useState<'hourly' | 'salary' | 'project'>('hourly')
  const [certsRequired, setCertsRequired] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [durationWeeks, setDurationWeeks] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [shareToFeed, setShareToFeed] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggleCert(cert: string) {
    setCertsRequired(prev => (prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]))
  }

  const fieldStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    outline: 'none',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block' as const,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: 5,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError('')

    if (!canDelegate('job_post')) {
      setError('As a Contributor, you do not have permission to post jobs.')
      return
    }
    if (!title.trim()) {
      setError('Job title is required.')
      return
    }
    if (!description.trim()) {
      setError('Job description is required.')
      return
    }
    if (!locationCity.trim() || !locationState.trim()) {
      setError('Location city and state are required.')
      return
    }
    if (!canAfford) {
      setError(`You need ${JOB_CREDIT_COST} credits to post a job. You have ${creditBalance}.`)
      return
    }

    setSubmitting(true)

    const { data: newId, error: rpcErr } = await supabase.rpc('post_job', {
      p_title: title.trim(),
      p_description: description.trim(),
      p_trade_required: tradeRequired,
      p_job_type: jobType,
      p_location_city: locationCity.trim(),
      p_location_state: locationState.trim(),
      p_pay_min: payMin ? parseFloat(payMin) : null,
      p_pay_max: payMax ? parseFloat(payMax) : null,
      p_pay_unit: payUnit,
      p_certs_required: certsRequired,
      p_start_date: startDate || null,
      p_duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
      p_is_urgent: isUrgent,
      p_share_to_feed: shareToFeed,
    })

    if (rpcErr || !newId) {
      setError(rpcErr?.message ?? 'Failed to post job. Please try again.')
      setSubmitting(false)
      return
    }

    if (delegateSession) {
      void logDelegateAction('post_job', { job_id: newId, title: title.trim() })
    }
    await refreshProfile()
    navigate(`/jobs/${newId as string}`)
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link
          to="/jobs"
          className="btn btn-ghost"
          style={{
            padding: '6px 10px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <ArrowLeft size={14} /> Job Board
        </Link>
        <div>
          <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 24 }}>
            Post a Job
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {isContractor
              ? 'Free for contractors'
              : `Costs ${JOB_CREDIT_COST} credits (you have ${creditBalance})`}
          </p>
        </div>
      </div>

      {!canAfford && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: '#DC2626' }}>Insufficient credits</strong>
            <p style={{ color: '#7F1D1D', marginTop: 3 }}>
              You need {JOB_CREDIT_COST} credits to post a job listing. You currently have{' '}
              {creditBalance} credits.{' '}
              <Link to="/credits" style={{ color: '#DC2626', fontWeight: 600 }}>
                Buy credits →
              </Link>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>Job Info</h2>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Job Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Journeyman Electrician – Commercial Build-Out"
              style={fieldStyle}
            />
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}
          >
            <div>
              <label style={labelStyle}>Trade Required *</label>
              <select
                value={tradeRequired}
                onChange={e => setTradeRequired(e.target.value)}
                style={{ ...fieldStyle, appearance: 'none' }}
              >
                {TRADE_OPTIONS.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Job Type *</label>
              <select
                value={jobType}
                onChange={e => setJobType(e.target.value as typeof jobType)}
                style={{ ...fieldStyle, appearance: 'none' }}
              >
                {JOB_TYPE_DISPLAY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Job Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the scope of work, experience required, schedule, and any other relevant details..."
              rows={6}
              style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>City *</label>
              <input
                value={locationCity}
                onChange={e => setLocationCity(e.target.value)}
                placeholder="Austin"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>State *</label>
              <input
                value={locationState}
                onChange={e => setLocationState(e.target.value)}
                placeholder="TX"
                maxLength={2}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>Pay & Schedule</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Pay Min</label>
              <input
                value={payMin}
                onChange={e => setPayMin(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Pay Max</label>
              <input
                value={payMax}
                onChange={e => setPayMax(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Pay Unit</label>
              <select
                value={payUnit}
                onChange={e => setPayUnit(e.target.value as typeof payUnit)}
                style={{ ...fieldStyle, appearance: 'none' }}
              >
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
                <option value="project">Project Total</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                type="date"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Duration (weeks)</label>
              <input
                value={durationWeeks}
                onChange={e => setDurationWeeks(e.target.value)}
                type="number"
                min="1"
                placeholder="e.g. 12"
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Requirements</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {CERT_OPTIONS.map(cert => (
              <label
                key={cert}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '6px 12px',
                  border: `1.5px solid ${certsRequired.includes(cert) ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  borderRadius: 8,
                  background: certsRequired.includes(cert) ? '#FFF7ED' : 'transparent',
                  color: certsRequired.includes(cert) ? 'var(--color-brand)' : 'var(--color-text)',
                  fontWeight: certsRequired.includes(cert) ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={certsRequired.includes(cert)}
                  onChange={() => toggleCert(cert)}
                  style={{ accentColor: 'var(--color-brand)' }}
                />
                {cert}
              </label>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Options</h2>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              marginBottom: 14,
            }}
          >
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={e => setIsUrgent(e.target.checked)}
              style={{ accentColor: '#DC2626', marginTop: 2, width: 16, height: 16 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#DC2626' }}>Mark as Urgent</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Displays a prominent URGENT badge on your listing.
              </div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={shareToFeed}
              onChange={e => setShareToFeed(e.target.checked)}
              style={{ accentColor: 'var(--color-brand)', marginTop: 2, width: 16, height: 16 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Share to feed</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Automatically post this job to your network's feed.
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: '#DC2626',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={submitting || !canAfford}
            className="btn btn-primary"
            style={{ flex: 1, fontSize: 14, padding: '12px 0' }}
          >
            {submitting
              ? 'Posting…'
              : isContractor
                ? 'Post Job (Free)'
                : `Post Job (${JOB_CREDIT_COST} credits)`}
          </button>
          <Link to="/jobs" className="btn btn-ghost" style={{ fontSize: 13 }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
