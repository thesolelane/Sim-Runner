import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import {
  BarChart2,
  Users,
  Wallet,
  MessageSquare,
  Settings,
  CreditCard,
  Globe,
  Shield,
  KeyRound,
  AlertTriangle,
  LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AdminAuthProvider } from '../context/AuthContext'
import OverviewSection from '@main/pages/admin/OverviewSection'
import UsersSection from '@main/pages/admin/UsersSection'
import WalletsSection from '@main/pages/admin/WalletsSection'
import FeedSection from '@main/pages/admin/FeedSection'
import ControlsSection from '@main/pages/admin/ControlsSection'
import PaymentsSection from '@main/pages/admin/PaymentsSection'
import DomainsSection from '@main/pages/admin/DomainsSection'
import SecretsSection from '@main/pages/admin/SecretsSection'
import ErrorLogSection from '@main/pages/admin/ErrorLogSection'

const SUPABASE_ENV = (import.meta.env.VITE_SUPABASE_ENV as string) || 'production'
const isBeta = SUPABASE_ENV === 'beta'

type Section =
  | 'overview'
  | 'users'
  | 'wallets'
  | 'feed'
  | 'controls'
  | 'payments'
  | 'domains'
  | 'secrets'
  | 'errors'

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Analytics Overview', icon: <BarChart2 size={16} /> },
  { id: 'users', label: 'User Management', icon: <Users size={16} /> },
  { id: 'wallets', label: 'Wallet & Credits', icon: <Wallet size={16} /> },
  { id: 'feed', label: 'Feed Moderation', icon: <MessageSquare size={16} /> },
  { id: 'controls', label: 'Platform Controls', icon: <Settings size={16} /> },
  { id: 'payments', label: 'Stripe & Payments', icon: <CreditCard size={16} /> },
  { id: 'domains', label: 'Domain Status', icon: <Globe size={16} /> },
  { id: 'secrets', label: 'Secrets & Env', icon: <KeyRound size={16} /> },
  { id: 'errors', label: 'Error Log', icon: <AlertTriangle size={16} /> },
]

interface Props {
  session: Session
}

export default function AdminPanel({ session }: Props) {
  const [section, setSection] = useState<Section>('overview')

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${session.access_token}` }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <AdminAuthProvider session={session}>
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--color-bg)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            padding: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '0 20px 20px',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="var(--color-brand)" />
              <span
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontWeight: 800,
                  fontSize: 16,
                  letterSpacing: '0.5px',
                }}
              >
                TRAYDBOOK
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Super Admin Panel
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-light)',
                marginTop: 2,
                wordBreak: 'break-all',
              }}
            >
              {session.user.email}
            </div>
            <div style={{ marginTop: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  fontFamily: 'var(--font-condensed)',
                  background: isBeta ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.12)',
                  color: isBeta ? '#eab308' : '#22c55e',
                  border: `1px solid ${isBeta ? 'rgba(234,179,8,0.35)' : 'rgba(34,197,94,0.3)'}`,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: isBeta ? '#eab308' : '#22c55e',
                    flexShrink: 0,
                  }}
                />
                {isBeta ? 'BETA DATABASE' : 'PRODUCTION DB'}
              </span>
            </div>
          </div>

          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                background: section === item.id ? 'rgba(232,93,4,0.1)' : 'none',
                border: 'none',
                borderRight:
                  section === item.id ? '3px solid var(--color-brand)' : '3px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 600,
                color:
                  item.id === 'errors'
                    ? section === item.id
                      ? '#e05252'
                      : '#e05252cc'
                    : section === item.id
                      ? 'var(--color-brand)'
                      : 'var(--color-text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <div style={{ marginTop: 'auto', padding: '16px 12px 0' }}>
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '9px 8px',
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, padding: 32, maxWidth: 1100, minWidth: 0 }}>
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 900,
                fontSize: 26,
                margin: 0,
                letterSpacing: '0.5px',
              }}
            >
              {NAV_ITEMS.find(n => n.id === section)?.label}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              TraydBook Admin Control Center
            </p>
          </div>

          {section === 'overview' && <OverviewSection authHeaders={authHeaders} />}
          {section === 'users' && <UsersSection authHeaders={authHeaders} />}
          {section === 'wallets' && <WalletsSection authHeaders={authHeaders} />}
          {section === 'feed' && <FeedSection authHeaders={authHeaders} />}
          {section === 'controls' && <ControlsSection />}
          {section === 'payments' && <PaymentsSection authHeaders={authHeaders} />}
          {section === 'domains' && <DomainsSection />}
          {section === 'secrets' && <SecretsSection authHeaders={authHeaders} />}
          {section === 'errors' && <ErrorLogSection authHeaders={authHeaders} />}
        </main>
      </div>
    </AdminAuthProvider>
  )
}
