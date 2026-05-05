import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Shield,
  Wrench,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { JobListing, JOB_TYPE_LABELS, formatPay, timeAgo } from '../types/jobs'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isContractor = profile?.account_type === 'contractor'

  const [listing, setListing] = useState<JobListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [applySuccess, setApplySuccess] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data, error } = await supabase
        .from('job_listings')
        .select(`*, poster:users!poster_id (display_name, handle, avatar_url, account_type)`)
        .eq('id', id)
        .single()
      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setListing(data as JobListing)

      if (profile) {
        const { data: app } = await supabase
          .from('job_applications')
          .select('id')
          .eq('listing_id', id)
          .eq('applicant_id', profile.id)
          .maybeSingle()
        if (app) setAlreadyApplied(true)
      }
      setLoading(false)
    }
    load()
  }, [id, profile])

  async function handleApply() {
    if (!profile || !listing) return
    if (!isContractor) {
      setApplyError('Only contractors can apply to jobs.')
      return
    }
    setSubmitting(true)
    setApplyError('')

    const { error } = await supabase.rpc('apply_job', {
      p_listing_id: listing.id,
      p_cover_note: coverNote.trim() || null,
    })

    if (error) {
      setApplyError(error.message)
      setSubmitting(false)
      return
    }

    setApplySuccess(true)
    setAlreadyApplied(true)
    setSubmitting(false)
  }

  if (loading)
    return (
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        Loading...
      </div>
    )

  if (notFound || !listing)
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Job not found.</p>
        <Link
          to="/jobs"
          className="btn btn-ghost"
          style={{ marginTop: 16, display: 'inline-block', fontSize: 13 }}
        >
          Back to Job Board
        </Link>
      </div>
    )

  const poster = listing.poster as (JobListing['poster'] & { account_type?: string }) | undefined
  const initials = (poster?.display_name ?? 'UN').slice(0, 2).toUpperCase()
  const colors = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E85D04']
  const avatarColor = colors[listing.poster_id.charCodeAt(0) % colors.length]

  const isMine = profile?.id === listing.poster_id

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px' }}>
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
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            {listing.is_urgent && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#DC2626',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                <AlertCircle size={13} fill="#DC2626" /> URGENT HIRE
              </div>
            )}
            {listing.is_boosted && (
              <span
                style={{
                  background: 'var(--color-brand)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'inline-block',
                  marginBottom: 10,
                }}
              >
                Featured
              </span>
            )}

            <h1
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1.2,
                marginBottom: 8,
              }}
            >
              {listing.title}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                }}
              >
                <MapPin size={13} /> {listing.location_city}, {listing.location_state}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                }}
              >
                <Clock size={13} /> Posted {timeAgo(listing.created_at)}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 13,
                  color: '#059669',
                  fontWeight: 600,
                }}
              >
                <DollarSign size={13} /> {formatPay(listing)}
              </span>
              {listing.start_date && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <Calendar size={13} /> Starts{' '}
                  {new Date(listing.start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              <span
                className={`badge ${listing.job_type === 'full_time' ? 'badge-green' : listing.job_type === 'contract' ? 'badge-blue' : listing.job_type === 'subcontract' ? 'badge-brand' : 'badge-yellow'}`}
              >
                {JOB_TYPE_LABELS[listing.job_type]}
              </span>
              <span className="badge badge-gray">{listing.trade_required}</span>
              {listing.duration_weeks && (
                <span className="badge badge-gray">{listing.duration_weeks} weeks</span>
              )}
            </div>

            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: 20,
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Job Description</h2>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {listing.description}
              </p>
            </div>

            {listing.certs_required.length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
                <h2
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Shield size={15} color="var(--color-brand)" /> Requirements
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {listing.certs_required.map(cert => (
                    <span
                      key={cert}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: '#FFF7ED',
                        color: '#C2410C',
                        border: '1px solid #FED7AA',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '5px 12px',
                      }}
                    >
                      <CheckCircle size={12} /> {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h2
              style={{
                fontWeight: 700,
                fontSize: 15,
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Wrench size={15} color="var(--color-brand)" /> Posted By
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {poster?.avatar_url ? (
                <img
                  src={poster.avatar_url}
                  alt=""
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="avatar-placeholder"
                  style={{ width: 44, height: 44, background: avatarColor, fontSize: 14 }}
                >
                  {initials}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {poster?.display_name ?? 'Company'}
                </div>
                {poster?.handle && (
                  <Link
                    to={`/profile/${poster.handle}`}
                    style={{ fontSize: 12, color: 'var(--color-brand)', textDecoration: 'none' }}
                  >
                    @{poster.handle}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: 300, flexShrink: 0 }}>
          <div className="card" style={{ padding: 22 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
              {isMine
                ? 'Your Listing'
                : alreadyApplied
                  ? 'Application Submitted'
                  : isContractor
                    ? 'Apply for This Job'
                    : 'About This Job'}
            </h2>

            {isMine ? (
              <div
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: '10px 0',
                }}
              >
                <p style={{ marginBottom: 12 }}>This is your job listing.</p>
                <button
                  onClick={() => navigate('/jobs')}
                  className="btn btn-ghost"
                  style={{ fontSize: 13, width: '100%' }}
                >
                  Back to Board
                </button>
              </div>
            ) : alreadyApplied || applySuccess ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#ECFDF5',
                    color: '#059669',
                    borderRadius: 20,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  <CheckCircle size={14} /> Applied
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  Your application has been submitted. The poster will review it and may reach out.
                </p>
                <Link
                  to="/jobs"
                  className="btn btn-ghost"
                  style={{ fontSize: 13, width: '100%', display: 'block', textAlign: 'center' }}
                >
                  Browse More Jobs
                </Link>
              </div>
            ) : isContractor ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Cover Note (optional)
                  </label>
                  <textarea
                    value={coverNote}
                    onChange={e => setCoverNote(e.target.value)}
                    placeholder="Briefly explain your experience and why you're a great fit..."
                    rows={5}
                    style={{
                      width: '100%',
                      padding: 10,
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      resize: 'vertical',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {applyError && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      color: '#DC2626',
                      marginBottom: 12,
                    }}
                  >
                    {applyError}
                  </div>
                )}

                <button
                  onClick={handleApply}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: 14, padding: '11px 0' }}
                >
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>

                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                    marginTop: 10,
                  }}
                >
                  Your profile info will be visible to the poster.
                </p>
              </>
            ) : (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                  padding: '10px 0',
                }}
              >
                <p style={{ marginBottom: 12 }}>
                  Contractors can apply to this job from their account.
                </p>
                <div
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 8,
                    padding: '12px',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: 'var(--color-text)' }}>Pay:</strong> {formatPay(listing)}
                  <br />
                  <strong style={{ color: 'var(--color-text)' }}>Type:</strong>{' '}
                  {JOB_TYPE_LABELS[listing.job_type]}
                  <br />
                  <strong style={{ color: 'var(--color-text)' }}>Location:</strong>{' '}
                  {listing.location_city}, {listing.location_state}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 10,
              }}
            >
              Job Details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pay</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>{formatPay(listing)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Type</span>
                <span style={{ fontWeight: 600 }}>{JOB_TYPE_LABELS[listing.job_type]}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Trade</span>
                <span style={{ fontWeight: 600 }}>{listing.trade_required}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Location</span>
                <span style={{ fontWeight: 600 }}>
                  {listing.location_city}, {listing.location_state}
                </span>
              </div>
              {listing.duration_weeks && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Duration</span>
                  <span style={{ fontWeight: 600 }}>{listing.duration_weeks} weeks</span>
                </div>
              )}
              {listing.start_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Start Date</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(listing.start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
