import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { AccountType } from '../lib/database.types'
import '../styles/auth.css'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

const TRADES = [
  'Electrician',
  'Plumber',
  'HVAC Tech',
  'Carpenter',
  'Ironworker',
  'Mason / Bricklayer',
  'Painter',
  'Roofer',
  'Welder',
  'Pipefitter',
  'Sheet Metal Worker',
  'Concrete / Flatwork',
  'Drywall / Finisher',
  'Flooring',
  'Tile Setter',
  'Glazier',
  'Insulation',
  'Landscaping',
  'General Contractor',
  'Construction Manager',
  'Other',
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

const ACCOUNT_TYPES: {
  type: AccountType
  icon: string
  title: string
  desc: string
  free?: boolean
}[] = [
  {
    type: 'contractor',
    icon: '🏗️',
    title: 'Contractor / Tradesperson',
    desc: 'Electricians, plumbers, HVAC, carpenters, and all skilled trades.',
    free: true,
  },
  {
    type: 'project_owner',
    icon: '📋',
    title: 'Project Owner',
    desc: 'Developers, investors, and commercial clients posting RFQs.',
  },
  {
    type: 'agent',
    icon: '🏠',
    title: 'Real Estate Agent',
    desc: 'Agents connecting trades with their clients and projects.',
  },
  {
    type: 'homeowner',
    icon: '🔑',
    title: 'Homeowner',
    desc: 'Homeowners looking for trusted trade professionals.',
  },
]

type Step = 'account-type' | 'details'

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const meta = user?.user_metadata ?? {}
  const suggestedName: string = meta.full_name ?? meta.name ?? ''

  const [step, setStep] = useState<Step>('account-type')
  const [accountType, setAccountType] = useState<AccountType | null>(null)

  const [displayName, setDisplayName] = useState(suggestedName)
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [trade, setTrade] = useState(TRADES[0])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleTypeSelect() {
    if (!accountType) return
    setStep('details')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !accountType) return

    const trimName = displayName.trim()
    if (!trimName) return setError('Please enter your name.')

    setSubmitting(true)
    setError('')

    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          display_name: trimName,
          account_type: accountType,
          location_city: city.trim() || null,
          location_state: state || null,
          trade,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      await refreshProfile()
      if (accountType === 'contractor') {
        navigate('/wallet-setup', { replace: true })
      } else {
        navigate('/feed', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: step === 'account-type' ? 520 : 440 }}>
        <div className="auth-logo">
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
        </div>

        {step === 'account-type' ? (
          <>
            <h1 className="auth-title">Welcome to TraydBook</h1>
            <p className="auth-subtitle">How will you be using the platform?</p>

            <div className="account-type-grid">
              {ACCOUNT_TYPES.map(at => (
                <button
                  key={at.type}
                  className={`account-type-card ${accountType === at.type ? 'selected' : ''}`}
                  onClick={() => setAccountType(at.type)}
                >
                  <div className="atc-icon">{at.icon}</div>
                  <div className="atc-title">{at.title}</div>
                  <div className="atc-desc">{at.desc}</div>
                  {at.free && <div className="atc-badge">Always Free</div>}
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
              disabled={!accountType}
              onClick={handleTypeSelect}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <h1 className="auth-title">One last step</h1>
            <p className="auth-subtitle">Confirm your details to finish setting up.</p>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div className="form-group">
                <label className="form-label">Your Name or Business Name</label>
                <input
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Full name or business name"
                  required
                />
              </div>

              {accountType === 'contractor' && (
                <div className="form-group">
                  <label className="form-label">Primary Trade</label>
                  <select
                    className="form-select"
                    value={trade}
                    onChange={e => setTrade(e.target.value)}
                  >
                    {TRADES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">City (optional)</label>
                  <input
                    className="form-input"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Dallas"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <select
                    className="form-select"
                    value={state}
                    onChange={e => setState(e.target.value)}
                  >
                    <option value="">—</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setStep('account-type')}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2 }}
                  disabled={submitting}
                >
                  {submitting ? 'Setting up…' : 'Finish Setup'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
