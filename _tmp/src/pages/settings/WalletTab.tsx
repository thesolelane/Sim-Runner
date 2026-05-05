import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import {
  TabHeading,
  Section,
  SectionHeading,
  SavedBanner,
  ErrorBanner,
  btnPrimary,
  btnGhost,
  apiFetch,
} from './shared'

export default function WalletTab() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isContractor = profile?.account_type === 'contractor'

  const [walletPubkey, setWalletPubkey] = useState<string | null | undefined>(undefined)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletActionLoading, setWalletActionLoading] = useState(false)
  const [walletMsg, setWalletMsg] = useState('')
  const [walletErr, setWalletErr] = useState('')
  const [walletCopied, setWalletCopied] = useState(false)
  const [solanaAccordionOpen, setSolanaAccordionOpen] = useState(false)

  useEffect(() => {
    if (!isContractor) return
    setWalletLoading(true)
    apiFetch('/wallet/status', 'GET')
      .then(data => setWalletPubkey(data.solana_pubkey ?? null))
      .catch(() => setWalletPubkey(null))
      .finally(() => setWalletLoading(false))
  }, [isContractor])

  async function handleCopyPubkey() {
    if (!walletPubkey) return
    try {
      await navigator.clipboard.writeText(walletPubkey)
      setWalletCopied(true)
      setTimeout(() => setWalletCopied(false), 2000)
    } catch {
      setWalletErr('Failed to copy.')
    }
  }

  async function handleRemoveWallet() {
    if (
      !confirm(
        'Remove your wallet? Your public key will be cleared. You can set up a new wallet any time.'
      )
    )
      return
    setWalletActionLoading(true)
    setWalletErr('')
    try {
      await apiFetch('/wallet/remove', 'POST')
      setWalletPubkey(null)
      setWalletMsg('Wallet removed. You can set up a new one any time.')
      setTimeout(() => setWalletMsg(''), 3500)
    } catch (err: unknown) {
      setWalletErr(err instanceof Error ? err.message : 'Failed to remove wallet')
    } finally {
      setWalletActionLoading(false)
    }
  }

  return (
    <div>
      <TabHeading>Crypto Wallet</TabHeading>

      {walletLoading || walletPubkey === undefined ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '12px 0' }}>
          Loading…
        </div>
      ) : walletPubkey ? (
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            Your Solana wallet is active. TraydBook may send SOL reward drops to this address.
          </div>

          <Section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #9945ff, #14f195)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ◎
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                }}
              >
                Active Wallet
              </div>
              <span
                style={{
                  background: 'rgba(5,150,105,0.1)',
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
                Connected
              </span>
            </div>

            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-condensed)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Wallet Address (Public Key)
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 16,
              }}
            >
              <code
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: 'var(--color-text)',
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                }}
              >
                {walletPubkey}
              </code>
              <button
                onClick={handleCopyPubkey}
                style={{
                  padding: '5px 10px',
                  background: walletCopied ? 'rgba(5,150,105,0.12)' : 'transparent',
                  border: `1px solid ${walletCopied ? 'rgba(5,150,105,0.3)' : 'var(--color-border)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11,
                  color: walletCopied ? '#059669' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-condensed)',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {walletCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div
                style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  display: 'inline-block',
                }}
              >
                <QRCodeSVG value={walletPubkey} size={140} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={handleRemoveWallet}
                disabled={walletActionLoading}
                style={{
                  ...btnGhost,
                  fontSize: 12,
                  padding: '7px 14px',
                  color: '#DC2626',
                  borderColor: 'rgba(220,38,38,0.3)',
                  opacity: walletActionLoading ? 0.6 : 1,
                }}
              >
                Remove Wallet
              </button>
              <button
                onClick={() => navigate('/wallet-setup')}
                disabled={walletActionLoading}
                style={{
                  ...btnGhost,
                  fontSize: 12,
                  padding: '7px 14px',
                  opacity: walletActionLoading ? 0.6 : 1,
                }}
              >
                Replace Wallet
              </button>
            </div>

            {walletMsg && <SavedBanner msg={walletMsg} />}
            {walletErr && <ErrorBanner msg={walletErr} />}
          </Section>

          <SectionHeading>Import into a Wallet App</SectionHeading>
          <Section>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              You can import your TraydBook wallet into{' '}
              <strong style={{ color: 'var(--color-text)' }}>Phantom</strong> or{' '}
              <strong style={{ color: 'var(--color-text)' }}>Solflare</strong> using the private key
              JSON array you saved during setup.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  app: 'Phantom',
                  steps:
                    'Open Phantom → Add / Connect Wallet → Import Private Key → paste the JSON array',
                },
                {
                  app: 'Solflare',
                  steps:
                    'Open Solflare → Access Existing Wallet → Private Key → paste the JSON array',
                },
              ].map(({ app, steps }) => (
                <div
                  key={app}
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      marginBottom: 4,
                    }}
                  >
                    {app}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {steps}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <SectionHeading>About Solana</SectionHeading>
          <Section>
            <button
              onClick={() => setSolanaAccordionOpen(o => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                }}
              >
                What is Solana? ◇
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {solanaAccordionOpen ? '▲ Hide' : '▼ Show'}
              </span>
            </button>
            {solanaAccordionOpen && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.7,
                }}
              >
                <p style={{ marginBottom: 8 }}>
                  Solana is a fast, low-cost blockchain. SOL is its native token used to pay for
                  transactions and as a store of value.
                </p>
                <p style={{ marginBottom: 8 }}>
                  TraydBook uses Solana to send on-chain reward drops (SOL tokens) directly to your
                  wallet as a thank-you for your activity on the platform.
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong style={{ color: 'var(--color-text)' }}>Disclaimer:</strong> TraydBook is
                  not a custodian. We do not hold, store, or control your private key. You are
                  solely responsible for the security of your wallet credentials.
                </p>
              </div>
            )}
          </Section>
        </div>
      ) : (
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            You don't have a wallet connected yet. Set one up to receive SOL reward drops from
            TraydBook directly on-chain.
          </div>

          <Section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #9945ff, #14f195)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                ◎
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                  }}
                >
                  Solana Wallet
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Receive reward drops, import into Phantom or Solflare
                </div>
              </div>
            </div>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Your wallet keypair is generated entirely in your browser — the private key never
              leaves your device and TraydBook never sees it. We only store your public key (wallet
              address).
            </p>
            <button
              onClick={() => navigate('/wallet-setup')}
              style={{ ...btnPrimary, fontSize: 13 }}
            >
              Set Up My Wallet
            </button>

            {walletMsg && <SavedBanner msg={walletMsg} />}
            {walletErr && <ErrorBanner msg={walletErr} />}
          </Section>
        </div>
      )}
    </div>
  )
}
