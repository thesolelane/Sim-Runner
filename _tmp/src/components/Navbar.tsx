import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  Bell,
  ChevronDown,
  Coins,
  Plus,
  MessageSquare,
  Home,
  Briefcase,
  Users,
  FileText,
  MoreHorizontal,
  Settings,
  User,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { isStaff } from '../lib/roles'

function TraydBookLogo({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 32 : 26
  const fontSize = size === 'md' ? 28 : 22
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'md' ? 10 : 8 }}>
      <div
        style={{
          width: iconSize,
          height: iconSize,
          background: 'var(--color-brand)',
          borderRadius: size === 'md' ? 7 : 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 17 17" fill="none" width={iconSize * 0.6} height={iconSize * 0.6}>
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
          <path d="M7 6h4M7 9h3M7 12h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}
      >
        <span style={{ color: 'var(--color-text)' }}>Trayd</span>
        <span style={{ color: 'var(--color-brand)' }}>Book</span>
      </span>
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false)
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const tabs = [
    { to: '/feed', label: 'Feed', Icon: Home },
    { to: '/jobs', label: 'Jobs', Icon: Briefcase },
    { to: '/explore', label: 'Explore', Icon: Users },
    { to: '/bids', label: 'Bids', Icon: FileText },
  ]

  const checkUnread = useCallback(async () => {
    if (!profile) return
    const [notifRes, msgRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .is('read_at', null),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .is('read_at', null),
    ])
    setHasUnreadNotifs((notifRes.count ?? 0) > 0)
    setHasUnreadMessages((msgRes.count ?? 0) > 0)
  }, [profile])

  useEffect(() => {
    checkUnread()
  }, [checkUnread])

  useEffect(() => {
    if (location.pathname === '/notifications') setHasUnreadNotifs(false)
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname.startsWith('/messages')) {
      const t = setTimeout(() => checkUnread(), 800)
      return () => clearTimeout(t)
    }
  }, [location.pathname, checkUnread])

  useEffect(() => {
    if (!profile) return
    const ch1 = supabase
      .channel('navbar-notifs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => setHasUnreadNotifs(true)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => checkUnread()
      )
      .subscribe()
    const ch2 = supabase
      .channel('navbar-msgs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => setHasUnreadMessages(true)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => checkUnread()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [profile, checkUnread])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    setUserMenuOpen(false)
    setMoreDrawerOpen(false)
    await signOut()
    navigate('/')
  }

  const initials = profile?.display_name
    ? profile.display_name
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  const isContractor = profile?.account_type === 'contractor'
  const isAdmin = isStaff(profile?.account_type)
  const canPostRfq =
    profile?.account_type === 'project_owner' || profile?.account_type === 'agent' || isAdmin

  function Dot() {
    return (
      <span
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 7,
          height: 7,
          background: 'var(--color-brand)',
          borderRadius: '50%',
          border: '1.5px solid var(--color-surface)',
        }}
      />
    )
  }

  return (
    <>
      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <nav
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="container"
          style={{ display: 'flex', alignItems: 'center', height: 56, gap: 20 }}
        >
          {/* Logo */}
          <Link to="/feed" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <TraydBookLogo />
          </Link>

          {/* Search — hidden on mobile */}
          <div
            className="nav-search"
            style={{
              flex: 1,
              maxWidth: 260,
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <Search
              size={13}
              color="var(--color-text-light)"
              style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
            />
            <input
              type="search"
              placeholder="Search trades, people, jobs..."
              style={{
                width: '100%',
                padding: '6px 12px 6px 28px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {/* Desktop nav links — hidden on mobile */}
          <div
            className="nav-links-desktop"
            style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}
          >
            {tabs.map(({ to, label }) => {
              const active = location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    background: active ? 'var(--color-brand-light)' : 'transparent',
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          >
            {/* Post Work / Post RFQ — hidden on mobile */}
            {profile && isContractor && (
              <Link
                to="/feed"
                state={{ openCompose: true }}
                className="nav-post-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--color-brand)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#fff',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={13} /> Post Work
              </Link>
            )}
            {profile && canPostRfq && (
              <Link
                to="/bids/new"
                className="nav-post-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--color-brand)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#fff',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={13} /> Post RFQ
              </Link>
            )}

            {/* Credits pill — desktop only */}
            {profile && !isContractor && (
              <div
                className="credits-pill-desktop"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--color-brand-light)',
                  border: '1px solid rgba(232,93,4,0.2)',
                  borderRadius: 3,
                  padding: '4px 10px',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: 'var(--color-brand)',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/credits')}
              >
                <Coins size={13} />
                {profile.credit_balance} credits
              </div>
            )}

            {/* Messages icon */}
            <Link
              to="/messages"
              className="nav-icon-btn"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                padding: '5px 7px',
                borderRadius: 'var(--radius-md)',
                color: location.pathname.startsWith('/messages')
                  ? 'var(--color-brand)'
                  : 'var(--color-text-muted)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
              }}
            >
              <MessageSquare size={16} />
              {hasUnreadMessages && <Dot />}
            </Link>

            {/* Bell icon */}
            <Link
              to="/notifications"
              className="nav-icon-btn"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                padding: '5px 7px',
                borderRadius: 'var(--radius-md)',
                color:
                  location.pathname === '/notifications'
                    ? 'var(--color-brand)'
                    : 'var(--color-text-muted)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
              }}
            >
              <Bell size={16} />
              {hasUnreadNotifs && <Dot />}
            </Link>

            {/* Profile menu */}
            {profile && (
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px 10px 4px 4px',
                    cursor: 'pointer',
                  }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 'var(--radius-sm)',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-brand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      {initials}
                    </div>
                  )}
                  <span
                    className="nav-name"
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '0.3px',
                      color: 'var(--color-text)',
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {profile.display_name}
                  </span>
                  <ChevronDown size={12} color="var(--color-text-light)" className="nav-chevron" />
                </button>

                {userMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 6,
                      minWidth: 200,
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 200,
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid var(--color-border)',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                        }}
                      >
                        {profile.display_name}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 11,
                          color: 'var(--color-text-light)',
                          marginTop: 2,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {profile.account_type.replace('_', ' ')}
                      </div>
                    </div>
                    {[
                      { label: 'My Profile', to: '/profile' },
                      { label: 'Settings', to: '/settings' },
                      ...(!isContractor && !isAdmin
                        ? [{ label: 'Buy Credits', to: '/credits' }]
                        : []),
                    ].map(item => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'block',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          color: 'var(--color-text)',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div
                      style={{
                        borderTop: '1px solid var(--color-border)',
                        marginTop: 4,
                        paddingTop: 4,
                      }}
                    >
                      <button
                        onClick={handleSignOut}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'none',
                          border: 'none',
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          color: '#e05252',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e =>
                          (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')
                        }
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── MOBILE BOTTOM NAV BAR ────────────────────────────────────────────── */}
      {profile && (
        <nav
          className="mobile-bottom-nav"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'var(--bottom-nav-height)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            display: 'none',
            zIndex: 100,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div
            style={{
              display: 'flex',
              height: '100%',
              alignItems: 'stretch',
            }}
          >
            {tabs.map(({ to, label, Icon }) => {
              const active = location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    textDecoration: 'none',
                    color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    borderTop: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                    transition: 'color 0.15s',
                    position: 'relative',
                  }}
                >
                  <Icon size={20} />
                  <span
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}

            {/* More tab */}
            <button
              onClick={() => setMoreDrawerOpen(o => !o)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                color: moreDrawerOpen ? 'var(--color-brand)' : 'var(--color-text-muted)',
                borderTop: moreDrawerOpen
                  ? '2px solid var(--color-brand)'
                  : '2px solid transparent',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {(hasUnreadMessages || hasUnreadNotifs) && !moreDrawerOpen && (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 'calc(50% - 14px)',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--color-brand)',
                    border: '1.5px solid var(--color-surface)',
                  }}
                />
              )}
              <MoreHorizontal size={20} />
              <span
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                More
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* ── MOBILE "MORE" DRAWER ────────────────────────────────────────────── */}
      {moreDrawerOpen && profile && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 98,
              background: 'rgba(0,0,0,0.5)',
            }}
          />

          {/* Drawer */}
          <div
            style={{
              position: 'fixed',
              bottom: 'var(--bottom-nav-height)',
              left: 0,
              right: 0,
              zIndex: 99,
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              borderRadius: '16px 16px 0 0',
              padding: '16px 0 8px',
            }}
          >
            {/* Handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--color-border)',
                margin: '0 auto 16px',
              }}
            />

            {/* Profile header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 20px 16px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--color-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {initials}
                </div>
              )}
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                  }}
                >
                  {profile.display_name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {profile.account_type.replace('_', ' ')}
                </div>
              </div>
              {!isContractor && (
                <div
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--color-brand-light)',
                    borderRadius: 99,
                    padding: '4px 10px',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-brand)',
                  }}
                >
                  <Coins size={12} /> {profile.credit_balance}
                </div>
              )}
            </div>

            {/* Drawer links */}
            {[
              { label: 'Messages', Icon: MessageSquare, to: '/messages', dot: hasUnreadMessages },
              { label: 'Notifications', Icon: Bell, to: '/notifications', dot: hasUnreadNotifs },
              { label: 'My Profile', Icon: User, to: '/profile', dot: false },
              ...(!isContractor && !isAdmin
                ? [{ label: 'Buy Credits', Icon: CreditCard, to: '/credits', dot: false }]
                : []),
              ...(isContractor || isAdmin || canPostRfq
                ? [
                    {
                      label: isContractor ? 'Post Work' : 'Post RFQ',
                      Icon: Plus,
                      to: isContractor ? '/feed' : '/bids/new',
                      state: isContractor ? { openCompose: true } : undefined,
                      dot: false,
                    },
                  ]
                : []),
              { label: 'Settings', Icon: Settings, to: '/settings', dot: false },
            ].map(({ label, Icon, to, dot, state: linkState }) => (
              <Link
                key={to}
                to={to}
                state={linkState}
                onClick={() => setMoreDrawerOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 20px',
                  color: location.pathname.startsWith(to)
                    ? 'var(--color-brand)'
                    : 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Icon size={20} />
                  {dot && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'var(--color-brand)',
                        border: '1.5px solid var(--color-surface)',
                      }}
                    />
                  )}
                </div>
                {label}
              </Link>
            ))}

            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '13px 20px',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#e05252',
                  cursor: 'pointer',
                }}
              >
                <LogOut size={20} /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        /* Desktop: show nav links, hide bottom nav */
        @media (min-width: 768px) {
          .mobile-bottom-nav { display: none !important; }
          .nav-search { display: flex !important; }
          .nav-links-desktop { display: flex !important; }
          .nav-post-btn { display: flex !important; }
          .credits-pill-desktop { display: flex !important; }
          .nav-icon-btn { display: flex !important; }
          .nav-name { display: inline !important; }
          .nav-chevron { display: block !important; }
        }

        /* Mobile: bottom nav visible, top nav slimmed down */
        @media (max-width: 767px) {
          .mobile-bottom-nav { display: flex !important; }
          .nav-search { display: none !important; }
          .nav-links-desktop { display: none !important; }
          .nav-post-btn { display: none !important; }
          .credits-pill-desktop { display: none !important; }
          .nav-icon-btn { display: none !important; }
          .nav-name { display: none !important; }
          .nav-chevron { display: none !important; }
        }
      `}</style>
    </>
  )
}

export { TraydBookLogo }
