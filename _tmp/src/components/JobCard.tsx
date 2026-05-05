import { MapPin, Clock, DollarSign, Bookmark, BookmarkCheck, AlertCircle, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { JobListing, JOB_TYPE_LABELS, formatPay, timeAgo } from '../types/jobs'

const TYPE_BADGE: Record<string, string> = {
  full_time: 'badge-green',
  contract: 'badge-blue',
  subcontract: 'badge-brand',
  per_diem: 'badge-yellow',
}

interface JobCardProps {
  listing: JobListing
  isContractor: boolean
  saved?: boolean
  onSave?: () => void
}

export default function JobCard({ listing, isContractor, saved = false, onSave }: JobCardProps) {
  const initials = (listing.poster?.display_name ?? 'UN').slice(0, 2).toUpperCase()
  const colors = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E85D04']
  const colorIdx = listing.poster_id.charCodeAt(0) % colors.length
  const avatarColor = colors[colorIdx]

  return (
    <div className="card" style={{ padding: 20, position: 'relative' }}>
      {listing.is_boosted && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 20,
            background: 'var(--color-brand)',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '0 0 6px 6px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          Featured
        </div>
      )}

      {listing.is_urgent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: '#DC2626',
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          <AlertCircle size={12} fill="#DC2626" /> URGENT HIRE
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {listing.poster?.avatar_url ? (
          <img
            src={listing.poster.avatar_url}
            alt=""
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            className="avatar-placeholder"
            style={{
              width: 44,
              height: 44,
              background: avatarColor,
              fontSize: 14,
              borderRadius: 10,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/jobs/${listing.id}`}
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--color-text)',
              textDecoration: 'none',
              display: 'block',
              lineHeight: 1.3,
            }}
          >
            {listing.title}
          </Link>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {listing.poster?.display_name ?? 'Company'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              <MapPin size={12} /> {listing.location_city}, {listing.location_state}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              <Clock size={12} /> {timeAgo(listing.created_at)}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: '#059669',
                fontWeight: 600,
              }}
            >
              <DollarSign size={12} /> {formatPay(listing)}
            </span>
          </div>
        </div>
      </div>

      <p
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          marginTop: 12,
          lineHeight: 1.6,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {listing.description}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <span className={`badge ${TYPE_BADGE[listing.job_type] ?? 'badge-gray'}`}>
          {JOB_TYPE_LABELS[listing.job_type]}
        </span>
        <span className="badge badge-gray">{listing.trade_required}</span>
        {listing.certs_required.slice(0, 3).map(cert => (
          <span key={cert} className="tag">
            {cert}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
        {isContractor ? (
          <Link to={`/jobs/${listing.id}`} className="btn btn-primary" style={{ fontSize: 13 }}>
            Apply Now
          </Link>
        ) : (
          <Link to={`/jobs/${listing.id}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
            View Details
          </Link>
        )}

        <button
          onClick={onSave}
          disabled={saved}
          className="btn btn-ghost"
          style={{
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: saved ? 'var(--color-brand)' : 'var(--color-text-muted)',
          }}
        >
          {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          {saved ? 'Saved' : 'Save'}
        </button>

        {listing.poster?.handle && (
          <Link
            to={`/profile/${listing.poster.handle}`}
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            <Star size={11} /> View poster
          </Link>
        )}
      </div>
    </div>
  )
}
