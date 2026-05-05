import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface MessageRow {
  id: string
  thread_id: string
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
}

interface ThreadSummary {
  threadId: string
  otherId: string
  otherName: string
  otherHandle: string
  otherAvatar: string | null
  lastBody: string
  lastAt: string
  hasUnread: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function Messages() {
  const { profile } = useAuth()
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadThreads = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data: msgs } = await supabase
      .from('messages')
      .select('id, thread_id, sender_id, recipient_id, body, read_at, created_at')
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!msgs) {
      setLoading(false)
      return
    }

    const threadMap = new Map<string, MessageRow>()
    const threadUnread = new Map<string, boolean>()

    for (const m of msgs as MessageRow[]) {
      if (!threadMap.has(m.thread_id)) {
        threadMap.set(m.thread_id, m)
      }
      if (m.recipient_id === profile.id && !m.read_at) {
        threadUnread.set(m.thread_id, true)
      }
    }

    const otherIds = [...threadMap.values()].map(m =>
      m.sender_id === profile.id ? m.recipient_id : m.sender_id
    )
    const uniqueOtherIds = [...new Set(otherIds)]

    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, handle, avatar_url')
      .in('id', uniqueOtherIds)

    const userMap = new Map<
      string,
      { display_name: string; handle: string; avatar_url: string | null }
    >(
      (users ?? []).map(
        (u: { id: string; display_name: string; handle: string; avatar_url: string | null }) => [
          u.id,
          u,
        ]
      )
    )

    const summaries: ThreadSummary[] = []
    for (const [tid, latest] of threadMap.entries()) {
      const otherId = latest.sender_id === profile.id ? latest.recipient_id : latest.sender_id
      const other = userMap.get(otherId)
      if (!other) continue
      summaries.push({
        threadId: tid,
        otherId,
        otherName: other.display_name,
        otherHandle: other.handle,
        otherAvatar: other.avatar_url,
        lastBody: latest.body,
        lastAt: latest.created_at,
        hasUnread: threadUnread.get(tid) ?? false,
      })
    }

    summaries.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    setThreads(summaries)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('messages-inbox')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          loadThreads()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, loadThreads])

  const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E85D04']

  const filteredThreads = search.trim()
    ? threads.filter(t => t.otherName.toLowerCase().includes(search.toLowerCase()))
    : threads

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontFamily: 'var(--font-condensed)',
          fontWeight: 800,
          fontSize: 26,
          marginBottom: 16,
        }}
      >
        Messages
      </h1>

      {/* Search bar */}
      <div
        style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 20 }}
      >
        <Search
          size={14}
          color="var(--color-text-muted)"
          style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
        />
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 36px 10px 36px',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            outline: 'none',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              right: 10,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

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
      ) : threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <MessageSquare size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No messages yet</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            Start a conversation from the{' '}
            <Link to="/explore" style={{ color: 'var(--color-brand)' }}>
              Explore
            </Link>{' '}
            page.
          </p>
        </div>
      ) : filteredThreads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: 14 }}>No conversations match "{search}"</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filteredThreads.map((t, i) => {
            const initials = t.otherName.slice(0, 2).toUpperCase()
            const color = COLORS[t.otherId.charCodeAt(0) % COLORS.length]
            return (
              <Link
                key={t.threadId}
                to={`/messages/${t.threadId}?with=${t.otherId}`}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 18px',
                  textDecoration: 'none',
                  alignItems: 'center',
                  borderBottom:
                    i < filteredThreads.length - 1 ? '1px solid var(--color-border)' : 'none',
                  background: t.hasUnread ? 'var(--color-brand-light)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.background = t.hasUnread
                    ? 'rgba(232,93,4,0.12)'
                    : 'var(--color-bg)')
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.background = t.hasUnread
                    ? 'var(--color-brand-light)'
                    : 'transparent')
                }
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {t.otherAvatar ? (
                    <img
                      src={t.otherAvatar}
                      alt=""
                      style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="avatar-placeholder"
                      style={{ width: 42, height: 42, background: color, fontSize: 13 }}
                    >
                      {initials}
                    </div>
                  )}
                  {t.hasUnread && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        background: 'var(--color-brand)',
                        borderRadius: '50%',
                        border: '2px solid var(--color-surface)',
                      }}
                    />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: t.hasUnread ? 700 : 600,
                        fontSize: 14,
                        color: 'var(--color-text)',
                      }}
                    >
                      {t.otherName}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {timeAgo(t.lastAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: t.hasUnread ? 'var(--color-text)' : 'var(--color-text-muted)',
                      fontWeight: t.hasUnread ? 500 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.lastBody}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
