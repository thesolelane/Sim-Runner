import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Heart,
  MessageSquare,
  Briefcase,
  Award,
  UserPlus,
  UserCheck,
  AlertTriangle,
  Coins,
  Star,
  FileText,
  Info,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NotificationType } from '../lib/database.types'

interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  entity_id: string | null
  entity_type: string | null
  read_at: string | null
  created_at: string
}

function iconForType(type: NotificationType) {
  const s = 16
  switch (type) {
    case 'post_liked':
      return <Heart size={s} color="#E85D04" />
    case 'post_commented':
      return <MessageSquare size={s} color="#2563EB" />
    case 'bid_submitted':
      return <FileText size={s} color="#059669" />
    case 'bid_awarded':
      return <Award size={s} color="#D97706" />
    case 'job_applied':
      return <Briefcase size={s} color="#7C3AED" />
    case 'rfq_closing_soon':
      return <AlertTriangle size={s} color="#DC2626" />
    case 'connection_request':
      return <UserPlus size={s} color="#2563EB" />
    case 'connection_accepted':
      return <UserCheck size={s} color="#059669" />
    case 'message_received':
      return <MessageSquare size={s} color="#E85D04" />
    case 'credential_expiring':
      return <AlertTriangle size={s} color="#DC2626" />
    case 'referral_received':
      return <Star size={s} color="#D97706" />
    case 'safety_alert':
      return <AlertTriangle size={s} color="#DC2626" />
    case 'credits_added':
      return <Coins size={s} color="#059669" />
    default:
      return <Info size={s} color="var(--color-text-muted)" />
  }
}

function navTarget(n: Notification): string | null {
  switch (n.type) {
    case 'post_liked':
    case 'post_commented':
      return n.entity_id ? `/feed` : null
    case 'bid_submitted':
    case 'bid_awarded':
      return n.entity_id ? `/bids/${n.entity_id}` : '/bids'
    case 'job_applied':
      return n.entity_id ? `/jobs/${n.entity_id}` : '/jobs'
    case 'rfq_closing_soon':
      return n.entity_id ? `/bids/${n.entity_id}` : '/bids'
    case 'connection_request':
    case 'connection_accepted':
      return '/explore'
    case 'message_received': {
      // entity_type = 'thread:<threadId>', entity_id = sender user_id
      if (n.entity_type?.startsWith('thread:') && n.entity_id) {
        const tid = n.entity_type.replace('thread:', '')
        return `/messages/${tid}?with=${n.entity_id}`
      }
      return '/messages'
    }
    case 'credential_expiring':
      return '/profile'
    case 'referral_received':
      return '/feed'
    case 'safety_alert':
      return '/feed'
    case 'credits_added':
      return '/credits'
    default:
      return null
  }
}

function groupNotifications(notifications: Notification[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)

  const today: Notification[] = []
  const thisWeek: Notification[] = []
  const earlier: Notification[] = []

  for (const n of notifications) {
    const d = new Date(n.created_at)
    if (d >= todayStart) today.push(n)
    else if (d >= weekStart) thisWeek.push(n)
    else earlier.push(n)
  }

  return { today, thisWeek, earlier }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Notifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const loadAndMarkRead = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const list = (data ?? []) as Notification[]

    // Mark all unread as read optimistically in local state, then persist
    const now = new Date().toISOString()
    const markedList = list.map(n => (n.read_at ? n : { ...n, read_at: now }))
    setNotifications(markedList)
    setLoading(false)

    const unreadIds = list.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ read_at: now }).in('id', unreadIds)
    }
  }, [profile])

  useEffect(() => {
    loadAndMarkRead()
  }, [loadAndMarkRead])

  function handleClick(n: Notification) {
    const target = navTarget(n)
    if (target) navigate(target)
  }

  const groups = groupNotifications(notifications)

  function Section({ label, items }: { label: string; items: Notification[] }) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 10,
          }}
        >
          {label}
        </h2>
        <div className="card" style={{ overflow: 'hidden' }}>
          {items.map((n, i) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 16px',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                background: !n.read_at ? 'var(--color-brand-light)' : 'transparent',
                cursor: navTarget(n) ? 'pointer' : 'default',
                transition: 'background 0.15s',
                alignItems: 'flex-start',
              }}
              onMouseEnter={e => {
                if (navTarget(n)) e.currentTarget.style.background = 'var(--color-bg)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = !n.read_at
                  ? 'var(--color-brand-light)'
                  : 'transparent'
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--color-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {iconForType(n.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: n.read_at ? 500 : 700,
                      color: 'var(--color-text)',
                    }}
                  >
                    {n.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                    lineHeight: 1.5,
                  }}
                >
                  {n.body}
                </p>
              </div>
              {!n.read_at && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--color-brand)',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontFamily: 'var(--font-condensed)',
          fontWeight: 800,
          fontSize: 26,
          marginBottom: 20,
        }}
      >
        Notifications
      </h1>

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--color-text-muted)',
            fontSize: 14,
          }}
        >
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <Bell size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>You're all caught up</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Notifications will appear here</p>
        </div>
      ) : (
        <>
          <Section label="Today" items={groups.today} />
          <Section label="This Week" items={groups.thisWeek} />
          <Section label="Earlier" items={groups.earlier} />
        </>
      )}
    </div>
  )
}
