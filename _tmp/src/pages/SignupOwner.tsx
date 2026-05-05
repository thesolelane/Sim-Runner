import { useState, useRef, FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { AccountType } from '../lib/database.types'
import '../styles/auth.css'

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
]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  contractor: 'Contractor',
  project_owner: 'Project Owner',
  agent: 'Real Estate Agent',
  homeowner: 'Homeowner',
  admin: 'Admin',
  admin_2: 'Admin 02',
  hired_dev: 'Hired Dev',
  moderator: 'Moderator',
}

const CREDIT_INFO: Record<string, string> = {
  project_owner:
    'Post RFQs (10 credits), job listings (8 credits), and message contractors (3 credits). Start with a free credit pack.',
  agent: 'Post referrals (5 credits) and message contractors (3 credits).',
  homeowner: 'Post service requests (5 credits) and message contractors (3 credits).',
}

const PROJECT_TYPES = [
  'New Construction',
  'Renovation / Remodel',
  'Repair / Maintenance',
  'Commercial Build-Out',
  'Historic Restoration',
  'Landscaping / Exterior',
  'Other',
]

const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 – $25,000',
  '$25,000 – $100,000',
  '$100,000 – $500,000',
  '$500,000+',
  'Prefer not to say',
]

const TIMELINE_OPTIONS = [
  'ASAP',
  '1–3 months',
  '3–6 months',
  '6–12 months',
  'Flexible / not sure yet',
]

const TRADE_CATEGORIES = [
  'General Contractor',
  'Electrician',
  'Plumber',
  'HVAC',
  'Carpenter',
  'Mason',
  'Roofer',
  'Painter',
  'Flooring',
  'Landscaper',
  'Ironworker',
  'Concrete',
  'Other',
]

interface LocationState {
  accountType?: AccountType
}

export default function SignupOwner() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const accountType: AccountType = state?.accountType ?? 'project_owner'

  const totalSteps = 3
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [emailConfirmSent, setEmailConfirmSent] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Step 1 — credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 — project preferences
  const [projectType, setProjectType] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [timeline, setTimeline] = useState('')
  const [tradesNeeded, setTradesNeeded] = useState<string[]>([])

  // Step 3 — profile info
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_AVATAR_SIZE = 5 * 1024 * 1024

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    if (!file.type.startsWith('image/')) {
      setAvatarError('Invalid file type — please upload an image (JPG, PNG, GIF, etc).')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('File too large — max 5 MB.')
      e.target.value = ''
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar(uid: string): Promise<string | null> {
    if (!avatarFile) return null
    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `${uid}.${ext}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30)
  }

  function toggleTrade(trade: string) {
    setTradesNeeded(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    )
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { error, userId: uid, needsEmailConfirmation } = await signUp(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    if (needsEmailConfirmation) {
      setEmailConfirmSent(true)
      return
    }
    if (uid) setUserId(uid)
    setStep(2)
  }

  function handleStep2(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!projectType) {
      setError('Please select a project type.')
      return
    }
    setStep(3)
  }

  async function handleStep3(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const uid = userId
      if (!uid) throw new Error('Session lost. Please start over.')

      const h = handle || slugify(displayName) || `user${Date.now()}`

      const uploadedAvatarUrl = await uploadAvatar(uid)

      const { error: profileError } = await supabase.from('users').insert({
        id: uid,
        email,
        display_name: displayName,
        handle: h,
        avatar_url: uploadedAvatarUrl || null,
        account_type: accountType,
        location_city: locationCity || null,
        location_state: locationState || null,
        location_zip: null,
        credit_balance: 50,
        deleted_at: null,
      })

      if (profileError) throw new Error(profileError.message)

      await supabase.from('credit_ledger').insert({
        user_id: uid,
        delta: 50,
        balance_after: 50,
        transaction_type: 'purchase',
        description: 'Welcome credits',
      })

      navigate('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
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

        {emailConfirmSent ? (
          <>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              We sent a confirmation link to <strong>{email}</strong>. Click it to verify your
              account, then sign in to continue.
            </p>
            <p className="auth-footer-text" style={{ marginTop: 20 }}>
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <div className="signup-steps">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                <div
                  key={s}
                  className={`signup-step ${s === step ? 'active' : s < step ? 'done' : ''}`}
                />
              ))}
            </div>

            {/* ── STEP 1: Credentials ── */}
            {step === 1 && (
              <>
                <h1 className="auth-title">Create your account</h1>
                <p className="auth-subtitle">Step 1 of {totalSteps} · Account credentials</p>
                <div
                  style={{
                    background: 'rgba(232, 93, 4, 0.08)',
                    border: '1px solid rgba(232, 93, 4, 0.2)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-brand)',
                      marginBottom: 4,
                    }}
                  >
                    {ACCOUNT_TYPE_LABELS[accountType]} · Credit-based access
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {CREDIT_INFO[accountType] || ''} You'll receive{' '}
                    <strong style={{ color: 'var(--color-text)' }}>50 welcome credits</strong> free.
                  </div>
                </div>
                <form onSubmit={handleStep1} className="auth-form">
                  {error && <div className="auth-error">{error}</div>}
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <div className="password-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        onClick={() => setShowPassword(p => !p)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <div className="password-wrap">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        onClick={() => setShowConfirm(p => !p)}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary btn-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Continue'}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 2: Project Preferences ── */}
            {step === 2 && (
              <>
                <h1 className="auth-title">Project preferences</h1>
                <p className="auth-subtitle">
                  Step 2 of {totalSteps} · Help us match you with the right contractors
                </p>
                <form onSubmit={handleStep2} className="auth-form">
                  {error && <div className="auth-error">{error}</div>}

                  <div className="form-group">
                    <label>Type of project</label>
                    <select
                      value={projectType}
                      onChange={e => setProjectType(e.target.value)}
                      required
                    >
                      <option value="">Select project type</option>
                      {PROJECT_TYPES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Typical budget range</label>
                    <select value={budgetRange} onChange={e => setBudgetRange(e.target.value)}>
                      <option value="">Select budget range</option>
                      {BUDGET_RANGES.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Typical timeline</label>
                    <select value={timeline} onChange={e => setTimeline(e.target.value)}>
                      <option value="">Select timeline</option>
                      {TIMELINE_OPTIONS.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      Trades you typically need{' '}
                      <span
                        style={{
                          fontWeight: 400,
                          textTransform: 'none',
                          letterSpacing: 0,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        (select all that apply)
                      </span>
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      {TRADE_CATEGORIES.map(trade => (
                        <button
                          key={trade}
                          type="button"
                          onClick={() => toggleTrade(trade)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 20,
                            border: `1.5px solid ${tradesNeeded.includes(trade) ? 'var(--color-brand)' : 'var(--color-border)'}`,
                            background: tradesNeeded.includes(trade)
                              ? 'rgba(232,93,4,0.1)'
                              : 'var(--color-bg)',
                            color: tradesNeeded.includes(trade)
                              ? 'var(--color-brand)'
                              : 'var(--color-text-muted)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {trade}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="step-nav">
                    <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                      Continue
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── STEP 3: Profile Info ── */}
            {step === 3 && (
              <>
                <h1 className="auth-title">Your profile</h1>
                <p className="auth-subtitle">Step 3 of {totalSteps} · Basic info</p>
                <form onSubmit={handleStep3} className="auth-form">
                  {error && <div className="auth-error">{error}</div>}
                  <div className="form-group">
                    <label>
                      Profile Photo{' '}
                      <span
                        style={{
                          fontWeight: 400,
                          textTransform: 'none',
                          letterSpacing: 0,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        (optional)
                      </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="Preview"
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 8,
                              objectFit: 'cover',
                              border: '2px solid var(--color-border)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 8,
                              background: 'var(--color-surface)',
                              border: '2px dashed var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 22,
                            }}
                          >
                            📷
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            position: 'absolute',
                            bottom: -6,
                            right: -6,
                            background: 'var(--color-brand)',
                            border: '2px solid var(--color-bg)',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 10,
                          }}
                        >
                          ✏️
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-secondary"
                          style={{ fontSize: 12, padding: '6px 14px' }}
                        >
                          Choose Photo
                        </button>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                          JPG, PNG or GIF · Max 5MB
                        </p>
                        {avatarError && (
                          <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                            {avatarError}
                          </p>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={handle}
                      onChange={e => setHandle(slugify(e.target.value))}
                      placeholder={`@${slugify(displayName) || 'yourhandle'}`}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        value={locationCity}
                        onChange={e => setLocationCity(e.target.value)}
                        placeholder="Denver"
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <select
                        value={locationState}
                        onChange={e => setLocationState(e.target.value)}
                      >
                        <option value="">State</option>
                        {US_STATES.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="step-nav">
                    <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ flex: 1 }}
                      disabled={loading}
                    >
                      {loading ? 'Creating profile...' : 'Finish Setup'}
                    </button>
                  </div>
                </form>
              </>
            )}

            <p className="auth-footer-text" style={{ marginTop: 20 }}>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
