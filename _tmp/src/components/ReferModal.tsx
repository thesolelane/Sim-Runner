import { useState, useEffect } from 'react'
import { X, Search, CheckCircle, Send, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { FeedPost, PostType } from '../types/feed'
import { AuthorAvatar } from './PostCard'

interface ReferModalProps {
  onClose: () => void
  onPosted: (post: FeedPost) => void
}

interface SearchResult {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  primary_trade: string | null
  location: string | null
}

export default function ReferModal({ onClose, onPosted }: ReferModalProps) {
  const { profile } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => void doSearch(), 300)
    return () => clearTimeout(timer)
  }, [query])

  async function doSearch() {
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select(
        'id, display_name, handle, avatar_url, account_type, location_city, location_state, contractor_profiles!user_id (primary_trade)'
      )
      .eq('account_type', 'contractor')
      .ilike('display_name', `%${query}%`)
      .neq('id', profile?.id ?? '')
      .limit(6)

    if (data) {
      setResults(
        data.map(
          (u: {
            id: string
            display_name: string
            handle: string
            avatar_url: string | null
            location_city: string | null
            location_state: string | null
            contractor_profiles: unknown
          }) => {
            const cp = u.contractor_profiles as { primary_trade: string | null } | null
            return {
              id: u.id,
              display_name: u.display_name,
              handle: u.handle,
              avatar_url: u.avatar_url,
              primary_trade: cp?.primary_trade ?? null,
              location: [u.location_city, u.location_state].filter(Boolean).join(', ') || null,
            }
          }
        )
      )
    }
    setSearching(false)
  }

  async function handleSubmit() {
    if (!selected || !profile) return
    setSubmitting(true)
    setError('')

    const body = note.trim()
      ? `I'd like to refer ${selected.display_name} — ${selected.primary_trade ?? 'contractor'} — for your next project. ${note.trim()}`
      : `I'd like to refer ${selected.display_name}${selected.primary_trade ? ` (${selected.primary_trade})` : ''} — great to work with and highly recommended.`

    const { data, error: err } = await supabase
      .from('posts')
      .insert({
        author_id: profile.id,
        post_type: 'referral' as PostType,
        body,
        hashtags: [
          'Referral',
          ...(selected.primary_trade ? [selected.primary_trade.replace(/\s+/g, '')] : []),
        ],
        tagged_user_id: selected.id,
      })
      .select(
        `
        id, post_type, body, media_urls, hashtags, like_count, comment_count, share_count,
        is_urgent, is_boosted, created_at, author_id, tagged_user_id,
        users!author_id (display_name, handle, avatar_url, account_type)
      `
      )
      .single()

    if (err || !data) {
      setError('Failed to post referral. Please try again.')
      setSubmitting(false)
      return
    }

    const u = data.users as unknown as {
      display_name: string
      handle: string
      avatar_url: string | null
      account_type: string
    } | null
    const feedPost: FeedPost = {
      id: data.id as string,
      post_type: 'referral',
      body: data.body as string,
      media_urls: [],
      hashtags: (data.hashtags as string[]) ?? [],
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      is_urgent: false,
      is_boosted: false,
      created_at: data.created_at as string,
      author_id: data.author_id as string,
      tagged_user_id: data.tagged_user_id as string,
      author_name: u?.display_name ?? profile.display_name ?? 'You',
      author_handle: u?.handle ?? profile.handle ?? '',
      author_avatar: u?.avatar_url ?? profile.avatar_url ?? null,
      author_account_type: u?.account_type ?? profile.account_type ?? '',
      author_trade: null,
      author_verified: false,
    }

    onPosted(feedPost)
    onClose()
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 480,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '-0.3px',
          }}
        >
          Refer a Contractor
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20 }}>
        {!selected ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
              Search for a contractor in your network to refer.
            </p>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search
                size={13}
                color="var(--color-text-light)"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                autoFocus
                type="text"
                placeholder="Search by name or trade..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px 8px 30px',
                  fontSize: 13,
                  outline: 'none',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
                }}
              />
              {searching && (
                <Loader
                  size={13}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                  }}
                />
              )}
            </div>

            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    <AuthorAvatar name={r.display_name} avatar={r.avatar_url} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.display_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {[r.primary_trade, r.location].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <CheckCircle size={14} color="var(--color-brand)" style={{ opacity: 0 }} />
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && !searching && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                  padding: '20px 0',
                }}
              >
                No contractors found matching "{query}"
              </p>
            )}
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                border: '1px solid var(--color-brand)',
              }}
            >
              <AuthorAvatar name={selected.display_name} avatar={selected.avatar_url} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{selected.display_name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {[selected.primary_trade, selected.location].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <textarea
              placeholder="Add a note about why you're referring them (optional)..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.6,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />

            {error && <p style={{ fontSize: 13, color: '#e05252', marginTop: 8 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => setSelected(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                Back
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  padding: '8px 20px',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {submitting ? <Loader size={13} /> : <Send size={13} />}
                {submitting ? 'Posting...' : 'Post Referral'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
