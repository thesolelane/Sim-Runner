import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import VerifiedBadge from '../../components/VerifiedBadge'
import type { BadgeTier } from '../../types/profile'
import {
  TabHeading,
  Section,
  SectionHeading,
  SavedBanner,
  ErrorBanner,
  inputStyle,
  btnPrimary,
} from './shared'

interface CredRow {
  id: string
  credential_type: string
  masked_display: string
  issuing_state: string | null
  expiry_date: string | null
  verified_at: string | null
  status: string
}

export default function VerificationTab() {
  const { profile } = useAuth()
  const isContractor = profile?.account_type === 'contractor'

  const [badgeTier, setBadgeTier] = useState<BadgeTier>(null)
  const [cpId, setCpId] = useState<string | null>(null)
  const [creds, setCreds] = useState<CredRow[]>([])
  const [credsLoading, setCredsLoading] = useState(false)
  const [credType, setCredType] = useState('license')
  const [credDisplay, setCredDisplay] = useState('')
  const [credState, setCredState] = useState('')
  const [credExpiry, setCredExpiry] = useState('')
  const [submittingCred, setSubmittingCred] = useState(false)
  const [credMsg, setCredMsg] = useState('')
  const [credErr, setCredErr] = useState('')

  useEffect(() => {
    if (!profile || !isContractor) return
    setCredsLoading(true)
    supabase
      .from('contractor_profiles')
      .select('id, badge_tier')
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setCpId(data.id)
          setBadgeTier(data.badge_tier as BadgeTier)
          supabase
            .from('credentials')
            .select(
              'id, credential_type, masked_display, issuing_state, expiry_date, verified_at, status'
            )
            .eq('contractor_id', data.id)
            .order('created_at', { ascending: false })
            .then(({ data: cd }) => {
              setCreds((cd ?? []) as CredRow[])
              setCredsLoading(false)
            })
        } else {
          setCredsLoading(false)
        }
      })
  }, [profile, isContractor])

  async function handleSubmitCredential(e: React.FormEvent) {
    e.preventDefault()
    if (!cpId || !credDisplay.trim()) return
    setSubmittingCred(true)
    setCredMsg('')
    setCredErr('')
    const { error } = await supabase.from('credentials').insert({
      contractor_id: cpId,
      credential_type: credType,
      masked_display: credDisplay.trim(),
      issuing_state: credState || null,
      expiry_date: credExpiry || null,
      status: 'pending',
    })
    setSubmittingCred(false)
    if (error) {
      setCredErr('Failed to submit. ' + error.message)
    } else {
      setCredMsg("Submitted for review. We'll verify it within 2–3 business days.")
      setCredDisplay('')
      setCredState('')
      setCredExpiry('')
      const { data: cd } = await supabase
        .from('credentials')
        .select(
          'id, credential_type, masked_display, issuing_state, expiry_date, verified_at, status'
        )
        .eq('contractor_id', cpId)
        .order('created_at', { ascending: false })
      setCreds((cd ?? []) as CredRow[])
    }
  }

  return (
    <div>
      <TabHeading>Verification & Badges</TabHeading>

      {/* Badge status */}
      <Section>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Your current verification badge
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {badgeTier ? (
            <>
              <VerifiedBadge tier={badgeTier} size="lg" />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {badgeTier === 'pro_verified' && 'Licensed + fully insured. Highest trust tier.'}
                {badgeTier === 'licensed' && 'License verified. Add insurance for Pro Verified.'}
                {badgeTier === 'vouched' && 'Endorsed by a Pro Verified contractor.'}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No badge yet. Submit credentials to get verified.
            </span>
          )}
        </div>
      </Section>

      {/* How badges work */}
      <SectionHeading>How badges work</SectionHeading>
      <Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              tier: 'pro_verified' as const,
              desc: "License + General Liability + Workers' Comp — all verified",
            },
            { tier: 'licensed' as const, desc: 'License verified. Insurance not yet on file.' },
            {
              tier: 'vouched' as const,
              desc: 'Vouched by a Pro Verified contractor in your network.',
            },
          ].map(({ tier, desc }) => (
            <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <VerifiedBadge tier={tier} size="sm" />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {desc}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Submitted credentials */}
      {credsLoading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 0',
            color: 'var(--color-text-muted)',
            fontSize: 13,
          }}
        >
          Loading credentials…
        </div>
      ) : (
        creds.length > 0 && (
          <>
            <SectionHeading>Submitted credentials</SectionHeading>
            <Section>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {creds.map(c => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                        {c.credential_type === 'license'
                          ? 'License'
                          : c.credential_type === 'general_liability'
                            ? 'General Liability Insurance'
                            : c.credential_type === 'workers_comp'
                              ? "Workers' Comp Insurance"
                              : c.credential_type}
                        {c.issuing_state && ` — ${c.issuing_state}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {c.masked_display}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 10,
                        padding: '2px 7px',
                        flexShrink: 0,
                        ...(c.verified_at
                          ? { color: '#059669', background: 'rgba(5,150,105,0.1)' }
                          : c.status === 'pending'
                            ? { color: '#D97706', background: 'rgba(217,119,6,0.1)' }
                            : { color: '#DC2626', background: 'rgba(220,38,38,0.1)' }),
                      }}
                    >
                      {c.verified_at
                        ? '✓ Verified'
                        : c.status === 'pending'
                          ? 'Pending Review'
                          : c.status}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )
      )}

      {/* Submit credential */}
      {badgeTier !== 'pro_verified' && (
        <>
          <SectionHeading>Submit a credential</SectionHeading>
          <Section>
            <form
              onSubmit={handleSubmitCredential}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Credential type
                </label>
                <select
                  value={credType}
                  onChange={e => setCredType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="license">Contractor / Trade License</option>
                  <option value="general_liability">General Liability Insurance</option>
                  <option value="workers_comp">Workers&apos; Comp Insurance</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  License / policy display (e.g. ending in 1234)
                </label>
                <input
                  type="text"
                  value={credDisplay}
                  onChange={e => setCredDisplay(e.target.value)}
                  placeholder="e.g. License #****-1234"
                  required
                  style={inputStyle}
                />
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Only masked info is stored publicly. Our team will verify via the issuing
                  authority.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Issuing state (optional)
                  </label>
                  <input
                    type="text"
                    value={credState}
                    onChange={e => setCredState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="TX"
                    maxLength={2}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Expiry date (optional)
                  </label>
                  <input
                    type="date"
                    value={credExpiry}
                    onChange={e => setCredExpiry(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={submittingCred || !credDisplay.trim()}
                  style={{
                    ...btnPrimary,
                    opacity: submittingCred || !credDisplay.trim() ? 0.6 : 1,
                  }}
                >
                  {submittingCred ? 'Submitting…' : 'Submit for Verification'}
                </button>
              </div>
              {credMsg && <SavedBanner msg={credMsg} />}
              {credErr && <ErrorBanner msg={credErr} />}
            </form>
          </Section>
        </>
      )}
    </div>
  )
}
