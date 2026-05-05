import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Coins,
  Zap,
  TrendingUp,
  Award,
  Star,
  XCircle,
  CheckCircle as CheckCircleIcon,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TabHeading, SectionHeading } from './shared'

const BUNDLES = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 25,
    price: '$9',
    perCredit: '$0.36 / cr',
    icon: Zap,
    popular: false,
  },
  {
    id: 'builder',
    name: 'Builder',
    credits: 75,
    price: '$24',
    perCredit: '$0.32 / cr',
    icon: TrendingUp,
    popular: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    credits: 200,
    price: '$54',
    perCredit: '$0.27 / cr',
    icon: Award,
    popular: false,
  },
  {
    id: 'power',
    name: 'Power',
    credits: 500,
    price: '$99',
    perCredit: '$0.20 / cr',
    icon: Star,
    popular: false,
  },
]

const CREDIT_COSTS = [
  { action: 'Post an RFQ', cost: 10 },
  { action: 'Post a job listing', cost: 8 },
  { action: 'Cold-message a contractor', cost: 3 },
]

interface LedgerRow {
  id: string
  delta: number
  balance_after: number
  transaction_type: string
  description: string
  created_at: string
}

export default function BillingTab() {
  const { profile, refreshProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [billingBanner, setBillingBanner] = useState<'success' | 'canceled' | null>(null)
  const [buyError, setBuyError] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (canceled === 'true') {
      setBillingBanner('canceled')
      setSearchParams({ tab: 'billing' }, { replace: true })
      return
    }

    if (success !== 'true' || !sessionId) return

    setBillingBanner('success')
    setSearchParams({ tab: 'billing' }, { replace: true })

    async function pollUntilFulfilled() {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()
      const token = authSession?.access_token
      if (!token) {
        refreshProfile()
        return
      }

      const maxAttempts = 15
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const res = await fetch(`/api/session-status?session_id=${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) continue
          const { status } = await res.json()
          if (status === 'completed') {
            await refreshProfile()
            return
          }
        } catch (err) {
          console.warn('[billing] Session status poll error:', err)
        }
      }
      await refreshProfile()
    }

    pollUntilFulfilled()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return
    supabase
      .from('credit_ledger')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setLedger((data ?? []) as LedgerRow[]))
  }, [profile])

  async function handleBuy(bundleId: string) {
    if (!profile) return
    setBuyError('')
    setBuying(bundleId)
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()
      const token = authSession?.access_token
      if (!token) throw new Error('Not authenticated. Please sign in again.')

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bundleId }),
      })
      const { url, error } = await res.json()
      if (!res.ok || !url) throw new Error(error ?? 'Failed to create checkout session')
      if (!url.startsWith('https://checkout.stripe.com/')) throw new Error('Invalid checkout URL')
      window.location.href = url
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBuying(null)
    }
  }

  return (
    <div>
      <TabHeading>Billing & Credits</TabHeading>

      {/* Banners */}
      {billingBanner === 'success' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(5,150,105,0.1)',
            border: '1px solid rgba(5,150,105,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 24,
            color: '#059669',
          }}
        >
          <CheckCircleIcon size={18} />
          <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, fontSize: 15 }}>
            Payment successful — credits added to your account!
          </span>
        </div>
      )}
      {billingBanner === 'canceled' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 24,
            color: '#DC2626',
          }}
        >
          <XCircle size={18} />
          <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, fontSize: 15 }}>
            Checkout canceled — no charges were made.
          </span>
        </div>
      )}

      {/* Balance */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
            }}
          >
            Current Balance
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Coins
              size={26}
              color="var(--color-brand)"
              style={{ verticalAlign: 'middle', alignSelf: 'center' }}
            />
            <span
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 48,
                fontWeight: 800,
                lineHeight: 1,
                color: 'var(--color-text)',
              }}
            >
              {profile?.credit_balance ?? 0}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 16,
                color: 'var(--color-text-muted)',
                alignSelf: 'flex-end',
                paddingBottom: 4,
              }}
            >
              credits
            </span>
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
            }}
          >
            What credits buy
          </div>
          {CREDIT_COSTS.map(c => (
            <div
              key={c.action}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}
            >
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.action}</span>
              <span
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-brand)',
                  background: 'var(--color-brand-light)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {c.cost} cr
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Buy bundles */}
      <SectionHeading>Buy Credits</SectionHeading>
      {buyError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 16,
            color: '#DC2626',
            fontSize: 13,
          }}
        >
          <XCircle size={15} /> {buyError}
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
          marginBottom: 36,
        }}
      >
        {BUNDLES.map(bundle => {
          const Icon = bundle.icon
          return (
            <div
              key={bundle.id}
              style={{
                background: 'var(--color-surface)',
                border: bundle.popular
                  ? '2px solid var(--color-brand)'
                  : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px 16px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              {bundle.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -11,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--color-brand)',
                    color: '#fff',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    padding: '2px 10px',
                    borderRadius: 99,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most Popular
                </div>
              )}
              <Icon size={22} color="var(--color-brand)" style={{ marginBottom: 8 }} />
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  marginBottom: 4,
                }}
              >
                {bundle.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  lineHeight: 1,
                  marginBottom: 2,
                }}
              >
                {bundle.credits}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    marginLeft: 2,
                  }}
                >
                  cr
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                {bundle.perCredit}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  marginBottom: 12,
                }}
              >
                {bundle.price}
              </div>
              <button
                onClick={() => handleBuy(bundle.id)}
                disabled={buying !== null}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: bundle.popular ? 'var(--color-brand)' : 'transparent',
                  border: `1px solid var(--color-brand)`,
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: bundle.popular ? '#fff' : 'var(--color-brand)',
                  cursor: buying ? 'not-allowed' : 'pointer',
                  opacity: buying === bundle.id ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {buying === bundle.id ? 'Loading…' : 'Buy Now'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Ledger */}
      <SectionHeading>Recent Activity</SectionHeading>
      {ledger.length === 0 ? (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-condensed)',
            fontSize: 14,
          }}
        >
          No credit activity yet.
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          {ledger.map((row, i) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < ledger.length - 1 ? '1px solid var(--color-border)' : 'none',
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
                  {row.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {new Date(row.created_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: row.delta > 0 ? '#059669' : '#DC2626',
                  }}
                >
                  {row.delta > 0 ? '+' : ''}
                  {row.delta}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Balance: {row.balance_after}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
