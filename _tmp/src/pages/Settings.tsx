import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  User,
  Bell,
  Eye,
  CreditCard,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  Shield,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdmin } from '../lib/roles'
import TeamPanel from '../components/TeamPanel'
import StaffPanel from '../components/StaffPanel'
import AccountTab from './settings/AccountTab'
import NotificationsTab from './settings/NotificationsTab'
import PrivacyTab from './settings/PrivacyTab'
import BillingTab from './settings/BillingTab'
import VerificationTab from './settings/VerificationTab'
import WalletTab from './settings/WalletTab'
import DangerTab from './settings/DangerTab'

type Tab =
  | 'account'
  | 'notifications'
  | 'privacy'
  | 'billing'
  | 'verification'
  | 'danger'
  | 'team'
  | 'wallet'
  | 'staff'

interface TabDef {
  id: Tab
  label: string
  icon: React.ReactNode
  contractorOnly?: boolean
  ownerOnly?: boolean
  adminOnly?: boolean
}

export default function Settings() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isContractor = profile?.account_type === 'contractor'
  const isSuperAdminUser = isSuperAdmin(profile?.account_type)

  const rawTab = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(rawTab ?? 'account')

  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null
    if (t) setActiveTab(t)
  }, [searchParams])

  function goTab(tab: Tab) {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  const TABS: TabDef[] = [
    { id: 'account', label: 'Account', icon: <User size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'privacy', label: 'Privacy', icon: <Eye size={15} />, contractorOnly: true },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={15} />, ownerOnly: true },
    {
      id: 'verification',
      label: 'Verification',
      icon: <ShieldCheck size={15} />,
      contractorOnly: true,
    },
    { id: 'wallet', label: 'Crypto Wallet', icon: <Wallet size={15} />, contractorOnly: true },
    { id: 'team', label: 'Team', icon: <Users size={15} />, ownerOnly: true },
    { id: 'staff', label: 'Staff', icon: <Shield size={15} />, adminOnly: true },
    { id: 'danger', label: 'Danger Zone', icon: <Trash2 size={15} /> },
  ]

  const visibleTabs = TABS.filter(t => {
    if (t.contractorOnly && !isContractor) return false
    if (t.ownerOnly && isContractor) return false
    if (t.adminOnly && !isSuperAdminUser) return false
    return true
  })

  return (
    <div className="container" style={{ padding: '32px 0', maxWidth: 900 }}>
      <h1
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '0.3px',
          color: 'var(--color-text)',
          marginBottom: 20,
        }}
      >
        Settings
      </h1>

      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        <style>{`
          @media (max-width: 640px) {
            .settings-layout { flex-direction: column !important; }
            .settings-sidebar {
              width: 100% !important;
              flex-shrink: 0;
              border-right: none !important;
              border-bottom: 1px solid var(--color-border);
              flex-direction: row !important;
              overflow-x: auto;
              padding: 0 !important;
              gap: 0 !important;
            }
            .settings-tab {
              flex-direction: column !important;
              padding: 10px 14px !important;
              border-radius: 0 !important;
              white-space: nowrap;
              flex-shrink: 0;
              font-size: 11px !important;
              gap: 4px !important;
            }
            .settings-tab-label { display: block; }
            .settings-content { min-width: 0; width: 100% !important; padding: 20px 0 !important; }
          }
        `}</style>

        <div
          className="settings-layout"
          style={{ display: 'flex', width: '100%', gap: 0, alignItems: 'flex-start' }}
        >
          <nav
            className="settings-sidebar"
            style={{
              width: 200,
              flexShrink: 0,
              borderRight: '1px solid var(--color-border)',
              paddingRight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              paddingTop: 4,
            }}
          >
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  className="settings-tab"
                  onClick={() => goTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '10px 16px',
                    background: isActive ? 'var(--color-brand-light)' : 'transparent',
                    border: 'none',
                    borderRight: isActive
                      ? '2px solid var(--color-brand)'
                      : '2px solid transparent',
                    borderRadius: 0,
                    color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.3px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {tab.icon}
                  <span className="settings-tab-label">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          <div
            className="settings-content"
            style={{ flex: 1, paddingLeft: 32, paddingTop: 4, minWidth: 0 }}
          >
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'team' && (
              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: '0.2px',
                    color: 'var(--color-text)',
                    marginBottom: 20,
                    marginTop: 0,
                  }}
                >
                  Team
                </h2>
                <TeamPanel />
              </div>
            )}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'privacy' && isContractor && <PrivacyTab />}
            {activeTab === 'billing' && !isContractor && <BillingTab />}
            {activeTab === 'verification' && isContractor && <VerificationTab />}
            {activeTab === 'wallet' && isContractor && <WalletTab />}
            {activeTab === 'staff' && isSuperAdminUser && (
              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: '0.2px',
                    color: 'var(--color-text)',
                    marginBottom: 20,
                    marginTop: 0,
                  }}
                >
                  Staff
                </h2>
                <StaffPanel />
              </div>
            )}
            {activeTab === 'danger' && <DangerTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
