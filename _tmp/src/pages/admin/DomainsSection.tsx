import { AlertTriangle, ExternalLink } from 'lucide-react'
import { SectionCard } from './shared'

const DOMAINS = [
  {
    domain: 'traydbook.com',
    label: 'Marketing Site',
    env: 'Production',
    status: 'operational',
    note: 'Public-facing landing page. Hosted on Replit.',
  },
  {
    domain: 'app.traydbook.com',
    label: 'Web App',
    env: 'Production',
    status: 'operational',
    note: 'Main application. Supabase backend, React frontend.',
  },
  {
    domain: 'secure.traydbook.com',
    label: 'Auth / API',
    env: 'Production',
    status: 'operational',
    note: 'Supabase auth and API endpoint. Managed by Supabase.',
  },
]

const ENV_LABELS = [
  { label: 'Supabase Project', value: 'traydbook (production)', color: '#059669' },
  { label: 'Auth Provider', value: 'Supabase Auth (email + OAuth)', color: '#2563EB' },
  { label: 'Payments', value: 'Stripe (live mode)', color: '#7C3AED' },
  { label: 'SMS Alerts', value: 'Telnyx (production)', color: '#D97706' },
  { label: 'Hosting', value: 'Replit Deployments', color: '#0891B2' },
]

export default function DomainsSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 8,
          fontSize: 13,
          color: '#B45309',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <AlertTriangle size={14} />
        Domain status cards are informational labels only. No live ping checks are performed.
      </div>

      {DOMAINS.map(d => (
        <div
          key={d.domain}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              flexShrink: 0,
              marginTop: 3,
              background:
                d.status === 'operational'
                  ? '#059669'
                  : d.status === 'degraded'
                    ? '#D97706'
                    : '#DC2626',
              boxShadow: `0 0 0 3px ${d.status === 'operational' ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>
                {d.domain}
              </span>
              <span
                style={{
                  fontSize: 11,
                  background: 'var(--color-border)',
                  padding: '2px 8px',
                  borderRadius: 20,
                  color: 'var(--color-text-muted)',
                  fontWeight: 700,
                }}
              >
                {d.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  background: 'rgba(37,99,235,0.1)',
                  padding: '2px 8px',
                  borderRadius: 20,
                  color: '#2563EB',
                  fontWeight: 700,
                }}
              >
                {d.env}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background:
                    d.status === 'operational' ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.1)',
                  color: d.status === 'operational' ? '#059669' : '#DC2626',
                }}
              >
                {d.status.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>{d.note}</p>
          </div>
          <a
            href={`https://${d.domain}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
          >
            <ExternalLink size={14} />
          </a>
        </div>
      ))}

      <SectionCard title="Environment Labels">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ENV_LABELS.map(row => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--color-bg)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', minWidth: 140 }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
