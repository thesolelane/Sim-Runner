import { useState } from 'react'
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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdmin } from '../lib/roles'
import OverviewSection from './admin/OverviewSection'
import UsersSection from './admin/UsersSection'
import WalletsSection from './admin/WalletsSection'
import FeedSection from './admin/FeedSection'
import ControlsSection from './admin/ControlsSection'
import PaymentsSection from './admin/PaymentsSection'
import DomainsSection from './admin/DomainsSection'
import SecretsSection from './admin/SecretsSection'
import ErrorLogSection from './admin/ErrorLogSection'

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

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode; superOnly?: boolean }[] = [
  { id: 'overview', label: 'Analytics Overview', icon: <BarChart2 size={16} /> },
  { id: 'users', label: 'User Management', icon: <Users size={16} /> },
  { id: 'wallets', label: 'Wallet & Credits', icon: <Wallet size={16} /> },
  { id: 'feed', label: 'Feed Moderation', icon: <MessageSquare size={16} /> },
  { id: 'controls', label: 'Platform Controls', icon: <Settings size={16} /> },
  { id: 'payments', label: 'Stripe & Payments', icon: <CreditCard size={16} /> },
  { id: 'domains', label: 'Domain Status', icon: <Globe size={16} /> },
  { id: 'secrets', label: 'Secrets & Env', icon: <KeyRound size={16} /> },
  { id: 'errors', label: 'Error Log', icon: <AlertTriangle size={16} />, superOnly: true },
]

export default function Admin() {
  const { session, profile } = useAuth()
  const [section, setSection] = useState<Section>('overview')
  const isSuperAdminUser = isSuperAdmin(profile?.account_type)

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }

  return (
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
              ADMIN
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {isSuperAdminUser ? 'Super Admin' : 'Admin'}
          </div>
        </div>
        {NAV_ITEMS.filter(item => !item.superOnly || isSuperAdminUser).map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              background: section === item.id ? 'rgba(226,114,42,0.1)' : 'none',
              border: 'none',
              borderRight:
                section === item.id ? '3px solid var(--color-brand)' : '3px solid transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              fontWeight: 600,
              color:
                section === item.id
                  ? 'var(--color-brand)'
                  : item.id === 'errors'
                    ? '#e05252cc'
                    : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
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
            Traydbook Admin Control Center
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
  )
}
