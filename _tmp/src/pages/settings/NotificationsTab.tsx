import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Smartphone, Phone, Pause, Play, X, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { NotificationType } from '../../lib/database.types'
import {
  TabHeading,
  Section,
  SavedBanner,
  ErrorBanner,
  inputStyle,
  btnPrimary,
  btnGhost,
  apiFetch,
} from './shared'

const NOTIF_LABELS: { type: NotificationType; label: string; description: string }[] = [
  { type: 'message_received', label: 'New messages', description: 'Someone sends you a message' },
  {
    type: 'connection_request',
    label: 'Connection requests',
    description: 'Someone wants to connect with you',
  },
  {
    type: 'connection_accepted',
    label: 'Connection accepted',
    description: 'A connection request was accepted',
  },
  { type: 'bid_submitted', label: 'Bid received', description: 'A contractor bids on your RFQ' },
  { type: 'bid_awarded', label: 'Bid awarded', description: 'Your bid was selected' },
  {
    type: 'job_applied',
    label: 'Job application',
    description: 'Someone applies to your job listing',
  },
  {
    type: 'rfq_closing_soon',
    label: 'RFQ closing soon',
    description: 'A bid deadline is approaching',
  },
  { type: 'post_liked', label: 'Post likes', description: 'Someone likes your post' },
  { type: 'post_commented', label: 'Post comments', description: 'Someone comments on your post' },
  {
    type: 'credential_expiring',
    label: 'Credential expiring',
    description: 'A license or cert is about to expire',
  },
  {
    type: 'credits_added',
    label: 'Credits added',
    description: 'Credits are added to your account',
  },
  { type: 'referral_received', label: 'Referrals', description: 'Someone refers you for work' },
  {
    type: 'safety_alert',
    label: 'Safety alerts',
    description: 'Safety-related alerts from your network',
  },
]

type NotifPrefs = Partial<Record<NotificationType, boolean>>

interface SmsStatus {
  sms_tier: 'starter' | 'unlimited' | null
  sms_alerts_enabled: boolean
  phone_verified: boolean
  sms_count_this_period: number
  has_subscription: boolean
  masked_phone: string | null
}

export default function NotificationsTab() {
  const { profile } = useAuth()
  const isContractor = profile?.account_type === 'contractor'
  const [searchParams] = useSearchParams()

  // ── Notification prefs ──
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({})
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifSavedMsg, setNotifSavedMsg] = useState('')

  useEffect(() => {
    if (!profile) return
    supabase
      .from('user_notification_prefs')
      .select('prefs')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.prefs) setNotifPrefs(data.prefs as NotifPrefs)
      })
  }, [profile])

  async function handleNotifToggle(type: NotificationType) {
    if (!profile || savingNotif) return
    const current = notifPrefs[type] !== false
    const updated = { ...notifPrefs, [type]: !current }
    setNotifPrefs(updated)
    setSavingNotif(true)
    setNotifSavedMsg('')
    const { error } = await supabase
      .from('user_notification_prefs')
      .upsert({ user_id: profile.id, prefs: updated, updated_at: new Date().toISOString() })
    setSavingNotif(false)
    if (error) {
      setNotifPrefs(notifPrefs)
      setNotifSavedMsg('Failed to save. Please try again.')
    } else {
      setNotifSavedMsg('Preferences saved.')
    }
    setTimeout(() => setNotifSavedMsg(''), 2500)
  }

  // ── SMS Alerts ──
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsSubscribing, setSmsSubscribing] = useState(false)
  const [smsCancelling, setSmsCancelling] = useState(false)
  const [smsTogglingPause, setSmsTogglingPause] = useState(false)
  const [smsMsg, setSmsMsg] = useState('')
  const [smsErr, setSmsErr] = useState('')
  const [smsSuccessBanner, setSmsSuccessBanner] = useState(false)
  const [smsCanceledBanner, setSmsCanceledBanner] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpErr, setOtpErr] = useState('')

  const loadSmsStatus = useCallback(async () => {
    if (!profile) return
    setSmsLoading(true)
    try {
      const data = await apiFetch('/sms/status', 'GET')
      setSmsStatus(data)
    } catch {
      setSmsStatus(null)
    } finally {
      setSmsLoading(false)
    }
  }, [profile])

  useEffect(() => {
    loadSmsStatus()
  }, [loadSmsStatus])

  useEffect(() => {
    if (searchParams.get('sms_success') === 'true') {
      setSmsSuccessBanner(true)
      loadSmsStatus()
    }
    if (searchParams.get('sms_canceled') === 'true') {
      setSmsCanceledBanner(true)
    }
  }, [searchParams, loadSmsStatus])

  async function handleSmsSubscribe(plan: 'starter' | 'unlimited') {
    setSmsSubscribing(true)
    setSmsErr('')
    try {
      const { url } = await apiFetch('/sms/create-subscription', 'POST', { plan })
      window.location.href = url
    } catch (err: unknown) {
      setSmsErr(err instanceof Error ? err.message : 'Failed to start subscription')
      setSmsSubscribing(false)
    }
  }

  async function handleSmsCancel() {
    if (
      !confirm(
        'Cancel your SMS subscription? This will remove your phone number and disable SMS alerts.'
      )
    )
      return
    setSmsCancelling(true)
    setSmsErr('')
    try {
      await apiFetch('/sms/cancel-subscription', 'POST')
      setSmsMsg('Subscription cancelled. SMS alerts are now disabled.')
      await loadSmsStatus()
    } catch (err: unknown) {
      setSmsErr(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setSmsCancelling(false)
    }
  }

  async function handleSmsPauseToggle() {
    if (!smsStatus) return
    const newEnabled = !smsStatus.sms_alerts_enabled
    setSmsTogglingPause(true)
    setSmsErr('')
    try {
      await apiFetch('/sms/toggle-alerts', 'POST', { enabled: newEnabled })
      setSmsStatus(prev => (prev ? { ...prev, sms_alerts_enabled: newEnabled } : prev))
      setSmsMsg(newEnabled ? 'SMS alerts resumed.' : 'SMS alerts paused.')
      setTimeout(() => setSmsMsg(''), 2500)
    } catch (err: unknown) {
      setSmsErr(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSmsTogglingPause(false)
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setSendingOtp(true)
    setOtpErr('')
    try {
      await apiFetch('/sms/send-verification', 'POST', { phone: phoneInput })
      setOtpSent(true)
    } catch (err: unknown) {
      setOtpErr(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setVerifyingOtp(true)
    setOtpErr('')
    try {
      await apiFetch('/sms/verify', 'POST', { otp: otpInput })
      setOtpSent(false)
      setOtpInput('')
      setPhoneInput('')
      setSmsMsg('Phone verified! You will now receive SMS alerts.')
      await loadSmsStatus()
      setTimeout(() => setSmsMsg(''), 3500)
    } catch (err: unknown) {
      setOtpErr(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setVerifyingOtp(false)
    }
  }

  return (
    <div>
      <TabHeading>Notifications</TabHeading>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Choose which notifications you receive. Changes are saved automatically.
        {notifSavedMsg && (
          <span
            style={{
              marginLeft: 12,
              fontWeight: 600,
              color: notifSavedMsg.startsWith('Failed') ? '#ef4444' : '#22c55e',
            }}
          >
            {notifSavedMsg}
          </span>
        )}
      </div>
      <Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NOTIF_LABELS.map(({ type, label, description }) => {
            const enabled = notifPrefs[type] !== false
            return (
              <div
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {description}
                  </div>
                </div>
                <button
                  onClick={() => handleNotifToggle(type)}
                  disabled={savingNotif}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: enabled ? 'var(--color-brand)' : 'var(--color-border)',
                    border: 'none',
                    cursor: savingNotif ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                    opacity: savingNotif ? 0.7 : 1,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: enabled ? 20 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── SMS Alerts (contractors only) ── */}
      {isContractor && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Smartphone size={16} color="var(--color-brand)" />
            <span
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--color-text)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              SMS Alerts
            </span>
            {smsStatus?.sms_tier && (
              <span
                style={{
                  background: 'rgba(5,150,105,0.12)',
                  color: '#059669',
                  borderRadius: 99,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-condensed)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                {smsStatus.sms_tier === 'starter' ? 'Starter' : 'Unlimited'}
              </span>
            )}
          </div>

          {smsSuccessBanner && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(5,150,105,0.1)',
                border: '1px solid rgba(5,150,105,0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: '#059669',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-condensed)',
                marginBottom: 14,
              }}
            >
              <CheckCircle size={14} /> Subscription activated! Now verify your phone number below.
            </div>
          )}
          {smsCanceledBanner && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: '#DC2626',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-condensed)',
                marginBottom: 14,
              }}
            >
              <XCircle size={14} /> Checkout canceled — no charges were made.
            </div>
          )}

          {smsLoading ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
              Loading…
            </div>
          ) : !smsStatus?.sms_tier ? (
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  marginBottom: 16,
                  lineHeight: 1.6,
                }}
              >
                Never miss a message — even when you're on a job site. Get SMS alerts when someone
                sends you a message on TraydBook. Your phone number is private and never shared with
                senders.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                {[
                  {
                    plan: 'starter' as const,
                    label: 'Starter',
                    price: '$3.99/mo',
                    desc: 'Up to 150 SMS alerts per month',
                  },
                  {
                    plan: 'unlimited' as const,
                    label: 'Unlimited',
                    price: '$5.99/mo',
                    desc: 'No cap — unlimited SMS alerts',
                  },
                ].map(({ plan, label, price, desc }) => (
                  <div
                    key={plan}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 20,
                        fontWeight: 800,
                        color: 'var(--color-brand)',
                      }}
                    >
                      {price}
                    </div>
                    <div
                      style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}
                    >
                      {desc}
                    </div>
                    <button
                      onClick={() => handleSmsSubscribe(plan)}
                      disabled={smsSubscribing}
                      style={{
                        ...btnPrimary,
                        marginTop: 4,
                        opacity: smsSubscribing ? 0.6 : 1,
                        fontSize: 12,
                        padding: '8px 14px',
                      }}
                    >
                      {smsSubscribing ? 'Redirecting…' : 'Subscribe'}
                    </button>
                  </div>
                ))}
              </div>
              {smsErr && <ErrorBanner msg={smsErr} />}
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                    Current plan
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 14,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: 'var(--color-brand-light)',
                        color: 'var(--color-brand)',
                        padding: '3px 10px',
                        borderRadius: 4,
                      }}
                    >
                      {smsStatus.sms_tier === 'starter'
                        ? 'Starter — $3.99/mo'
                        : 'Unlimited — $5.99/mo'}
                    </span>
                    {smsStatus.sms_tier === 'starter' && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {smsStatus.sms_count_this_period} / 150 used this period
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleSmsPauseToggle}
                    disabled={smsTogglingPause}
                    style={{
                      ...btnGhost,
                      fontSize: 12,
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: smsTogglingPause ? 0.6 : 1,
                    }}
                  >
                    {smsStatus.sms_alerts_enabled ? (
                      <>
                        <Pause size={13} /> Pause alerts
                      </>
                    ) : (
                      <>
                        <Play size={13} /> Resume alerts
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSmsCancel}
                    disabled={smsCancelling}
                    style={{
                      ...btnGhost,
                      fontSize: 12,
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#DC2626',
                      borderColor: 'rgba(220,38,38,0.3)',
                      opacity: smsCancelling ? 0.6 : 1,
                    }}
                  >
                    <X size={13} /> Cancel plan
                  </button>
                </div>
              </div>

              {!smsStatus.sms_alerts_enabled && (
                <div
                  style={{
                    background: 'rgba(217,119,6,0.08)',
                    border: '1px solid rgba(217,119,6,0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: '#D97706',
                    fontSize: 12,
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Pause size={13} /> SMS alerts are paused. In-app notifications still work.
                </div>
              )}

              {!smsStatus.phone_verified ? (
                <div
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Phone size={14} /> Verify your phone number
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    Enter your US phone number to receive SMS alerts. We'll send a 6-digit
                    verification code.
                  </p>
                  {!otpSent ? (
                    <form
                      onSubmit={handleSendOtp}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 200px' }}>
                        <label
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-muted)',
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          Phone number (US only)
                        </label>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={e => setPhoneInput(e.target.value)}
                          placeholder="(555) 555-5555"
                          required
                          style={inputStyle}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingOtp || !phoneInput.trim()}
                        style={{
                          ...btnPrimary,
                          opacity: sendingOtp || !phoneInput.trim() ? 0.6 : 1,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {sendingOtp ? 'Sending…' : 'Send Code'}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleVerifyOtp}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 160px' }}>
                        <label
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-muted)',
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          Enter the 6-digit code
                        </label>
                        <input
                          type="text"
                          value={otpInput}
                          onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456"
                          required
                          maxLength={6}
                          style={inputStyle}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={verifyingOtp || otpInput.length < 6}
                        style={{
                          ...btnPrimary,
                          opacity: verifyingOtp || otpInput.length < 6 ? 0.6 : 1,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {verifyingOtp ? 'Verifying…' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false)
                          setOtpInput('')
                          setOtpErr('')
                        }}
                        style={{ ...btnGhost, fontSize: 12, flexShrink: 0 }}
                      >
                        Change number
                      </button>
                    </form>
                  )}
                  {otpErr && <ErrorBanner msg={otpErr} />}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(5,150,105,0.08)',
                    border: '1px solid rgba(5,150,105,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                  }}
                >
                  <CheckCircle size={15} style={{ color: '#059669', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                      Phone verified
                      {smsStatus.masked_phone ? ` — ${smsStatus.masked_phone}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      SMS alerts are active. To change your number, cancel and re-subscribe.
                    </div>
                  </div>
                </div>
              )}

              {smsMsg && <SavedBanner msg={smsMsg} />}
              {smsErr && <ErrorBanner msg={smsErr} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
