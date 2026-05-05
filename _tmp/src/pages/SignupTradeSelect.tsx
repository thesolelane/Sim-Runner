import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/auth.css'

const TRADES = [
  { label: 'Design Professional', icon: '📐', desc: 'Architect, designer, drafter' },
  { label: 'General Contractor', icon: '🏗️', desc: 'GC & project management' },
  { label: 'Electrician', icon: '⚡', desc: 'Commercial & residential electrical' },
  { label: 'Plumber', icon: '🔧', desc: 'Plumbing & pipework' },
  { label: 'HVAC Tech', icon: '❄️', desc: 'Heating, cooling & ventilation' },
  { label: 'Carpenter', icon: '🪵', desc: 'Framing, finish & millwork' },
  { label: 'Ironworker', icon: '🔩', desc: 'Structural & ornamental iron' },
  { label: 'Mason / Bricklayer', icon: '🧱', desc: 'Masonry, brick & stone' },
  { label: 'Painter', icon: '🖌️', desc: 'Interior & exterior painting' },
  { label: 'Roofer', icon: '🏠', desc: 'Roofing & waterproofing' },
  { label: 'Welder', icon: '🔥', desc: 'Welding & metal fabrication' },
  { label: 'Pipefitter', icon: '⚙️', desc: 'Industrial piping systems' },
  { label: 'Sheet Metal Worker', icon: '🔩', desc: 'Ductwork & sheet metal' },
  { label: 'Concrete / Flatwork', icon: '🪨', desc: 'Concrete & flatwork finishing' },
  { label: 'Drywall / Finisher', icon: '🏛️', desc: 'Drywall, taping & finishing' },
  { label: 'Flooring', icon: '🟫', desc: 'Hardwood, LVP, tile & carpet' },
  { label: 'Tile Setter', icon: '🔷', desc: 'Tile, stone & mosaic' },
  { label: 'Glazier', icon: '🪟', desc: 'Glass, windows & storefronts' },
  { label: 'Insulation', icon: '🧲', desc: 'Thermal & acoustic insulation' },
  { label: 'Landscaping', icon: '🌿', desc: 'Landscaping & hardscaping' },
  { label: 'Construction Manager', icon: '📊', desc: 'Scheduling, estimating & oversight' },
  { label: 'Other', icon: '🛠️', desc: 'Specialty or unlisted trade' },
]

export default function SignupTradeSelect() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  function handleContinue() {
    if (!selected) return
    navigate('/signup/contractor', {
      state: { accountType: 'contractor', preselectedTrade: selected },
    })
  }

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="auth-card" style={{ maxWidth: 680, width: '100%' }}>
        <Link to="/" className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 17 17" fill="none" width={16} height={16}>
              <rect
                x="2"
                y="1.5"
                width="9"
                height="13"
                rx="1.5"
                fill="rgba(255,255,255,0.12)"
                stroke="white"
                strokeWidth="1.2"
              />
              <rect
                x="5"
                y="1.5"
                width="9"
                height="13"
                rx="1.5"
                fill="rgba(255,255,255,0.25)"
                stroke="white"
                strokeWidth="1.2"
              />
              <path
                d="M7 6h4M7 9h3M7 12h2"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="auth-logo-word">
            <span className="trayd">Trayd</span>
            <span className="book">Book</span>
          </div>
        </Link>

        <h1 className="auth-title">What's your trade?</h1>
        <p className="auth-subtitle">Pick your specialty — always free for all trade accounts</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 10,
            marginTop: 8,
            marginBottom: 20,
          }}
        >
          {TRADES.map(t => (
            <button
              key={t.label}
              onClick={() => setSelected(t.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                border:
                  selected === t.label
                    ? '2px solid var(--color-brand)'
                    : '1.5px solid var(--color-border)',
                background: selected === t.label ? 'rgba(232,93,4,0.08)' : 'var(--color-bg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{t.icon}</span>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: selected === t.label ? 'var(--color-brand)' : 'var(--color-text)',
                    lineHeight: 1.2,
                  }}
                >
                  {t.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {t.desc}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button className="btn-primary btn-full" disabled={!selected} onClick={handleContinue}>
          Continue as {selected ?? '…'}
        </button>

        <p className="auth-footer-text" style={{ marginTop: 16 }}>
          Not a tradesperson? <Link to="/signup">See all account types</Link>
        </p>
        <p className="auth-footer-text" style={{ marginTop: 4 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
