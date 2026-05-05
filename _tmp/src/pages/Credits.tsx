import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Coins, CheckCircle, XCircle, Zap, TrendingUp, Award, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

export default function Credits() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [banner, setBanner] = useState<'success' | 'canceled' | null>(null)
  const [buyError, setBuyError] = useState('')

  const isContractor = profile?.account_type === 'contractor'

  // Contractors are redirected
  useEffect(() => {
    if (profile && isContractor) navigate('/feed', { replace: true })
  }, [profile, isContractor, navigate])

  // Handle return from Stripe Checkout: poll until webhook fulfills credits (max 30s)
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (canceled === 'true') {
      setBanner('canceled')
      window.history.replaceState(null, '', '/credits')
      return
    }

    if (success !== 'true' || !sessionId) return

    setBanner('success')
    window.history.replaceState(null, '', '/credits')

    // Poll the session status endpoint until the purchase is completed
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
          console.warn('[credits] Session status poll error:', err)
        }
      }
      // Fallback: refresh even if polling timed out
      await refreshProfile()
    }

    pollUntilFulfilled()
  }, [searchParams, refreshProfile])

  // Load credit ledger history
  useEffect(() => {
    if (!profile || isContractor) return
    supabase
      .from('credit_ledger')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setLedger((data ?? []) as LedgerRow[]))
  }, [profile, isContractor])

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

  if (isContractor) return null

  return (
    <div className="container" style={{ padding: '32px 0', maxWidth: 840 }}>
      {/* Banners */}
      {banner === 'success' && (
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
          <CheckCircle size={18} />
          <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, fontSize: 15 }}>
            Payment successful — credits added to your account!
          </span>
        </div>
      )}
      {banner === 'canceled' && (
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

      {/* Balance card */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          marginBottom: 32,
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
              size={28}
              color="var(--color-brand)"
              style={{ verticalAlign: 'middle', alignSelf: 'center' }}
            />
            <span
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 52,
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
                fontSize: 18,
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
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

      {/* Bundles */}
      <h2
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          color: 'var(--color-text)',
          marginBottom: 16,
        }}
      >
        Buy Credits
      </h2>

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: 16,
          marginBottom: 40,
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
                padding: '26px 20px',
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
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--color-brand)',
                    color: '#fff',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    padding: '3px 12px',
                    borderRadius: 99,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most Popular
                </div>
              )}
              <Icon size={26} color="var(--color-brand)" style={{ marginBottom: 10 }} />
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '0.3px',
                  color: 'var(--color-text)',
                  marginBottom: 6,
                }}
              >
                {bundle.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 36,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  lineHeight: 1,
                  marginBottom: 2,
                }}
              >
                {bundle.credits}
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    marginLeft: 3,
                  }}
                >
                  cr
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                {bundle.perCredit}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  marginBottom: 14,
                }}
              >
                {bundle.price}
              </div>
              <button
                onClick={() => handleBuy(bundle.id)}
                disabled={buying !== null}
                style={{
                  width: '100%',
                  padding: '9px 0',
                  background: bundle.popular ? 'var(--color-brand)' : 'transparent',
                  border: `1px solid var(--color-brand)`,
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13,
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

      {/* Ledger history */}
      <h2
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          color: 'var(--color-text)',
          marginBottom: 12,
        }}
      >
        Recent Activity
      </h2>

      {ledger.length === 0 ? (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '28px',
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
