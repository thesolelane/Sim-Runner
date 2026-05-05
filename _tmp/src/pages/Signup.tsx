import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import type { AccountType } from '../lib/database.types'
import SocialAuthButtons from '../components/SocialAuthButtons'
import '../styles/auth.css'

interface SignupLocationState {
  preselectOwner?: boolean
}

// All account types (shown on general signup)
const allAccountTypes: {
  type: AccountType
  icon: string
  title: string
  desc: string
  badge?: string
  free?: boolean
}[] = [
  {
    type: 'contractor',
    icon: '🏗️',
    title: 'Contractor / Tradesperson',
    desc: 'Electricians, plumbers, HVAC, carpenters, and all skilled trades.',
    badge: 'Always Free',
    free: true,
  },
  {
    type: 'project_owner',
    icon: '💼',
    title: 'Investor / Developer',
    desc: 'Real estate investors, developers, and commercial project owners.',
    free: false,
  },
  {
    type: 'agent',
    icon: '🏠',
    title: 'Real Estate Agent',
    desc: 'Agents connecting trades with their clients and projects.',
    free: false,
  },
  {
    type: 'homeowner',
    icon: '🔑',
    title: 'Homeowner',
    desc: 'Homeowners looking for trusted trade professionals.',
    free: false,
  },
]

// Only non-contractor types — shown when coming from "Find a Contractor"
const hiringAccountTypes = allAccountTypes.filter(at => at.type !== 'contractor')

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as SignupLocationState | null
  const isHiringFlow = !!locationState?.preselectOwner

  const accountTypes = isHiringFlow ? hiringAccountTypes : allAccountTypes

  const [selected, setSelected] = useState<AccountType | null>(
    isHiringFlow ? 'project_owner' : null
  )

  function handleContinue() {
    if (!selected) return
    if (selected === 'contractor') {
      navigate('/signup/trade-select')
    } else {
      navigate('/signup/owner', { state: { accountType: selected } })
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
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

        {isHiringFlow ? (
          <>
            <h1 className="auth-title">I'm looking to hire</h1>
            <p className="auth-subtitle">Choose how best describes you</p>
          </>
        ) : (
          <>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Choose how you'll use TraydBook</p>
          </>
        )}

        <div className="account-type-grid">
          {accountTypes.map(at => (
            <button
              key={at.type}
              className={`account-type-card ${selected === at.type ? 'selected' : ''}`}
              onClick={() => setSelected(at.type)}
            >
              <div className="atc-icon">{at.icon}</div>
              <div className="atc-title">{at.title}</div>
              <div className="atc-desc">{at.desc}</div>
              {at.badge && <div className="atc-badge">{at.badge}</div>}
              {!at.free && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Credit-based access
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          className="btn-primary btn-full"
          style={{ marginTop: 20 }}
          disabled={!selected}
          onClick={handleContinue}
        >
          Continue
        </button>

        <SocialAuthButtons label="Or sign up with" />

        <p className="auth-footer-text">
          {isHiringFlow ? (
            <>
              <Link to="/signup/trade-select">Join as a contractor instead</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
