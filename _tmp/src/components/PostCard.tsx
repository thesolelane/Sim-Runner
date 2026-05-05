import { useState } from 'react'
import {
  Heart,
  MessageCircle,
  Share2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react'
import { FeedPost, FeedComment, POST_TYPE_BADGE } from '../types/feed'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface PostCardProps {
  post: FeedPost
  likedPosts: Set<string>
  onLikeToggle: (postId: string, wasLiked: boolean) => void
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function AuthorAvatar({
  name,
  avatar,
  size = 44,
}: {
  name: string
  avatar: string | null
  size?: number
}) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const colors = ['#E85D04', '#2563EB', '#059669', '#7C3AED', '#D97706', '#DC2626', '#0891B2']
  const color = colors[name.charCodeAt(0) % colors.length]

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: 'var(--radius-sm)',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-condensed)',
        fontSize: size * 0.32,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

export { AuthorAvatar }

function MediaGrid({ urls }: { urls: string[] }) {
  const count = Math.min(urls.length, 4)
  const shown = urls.slice(0, 4)

  const containerStyle: React.CSSProperties = {
    marginTop: 12,
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    display: 'grid',
    gap: 3,
  }

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  }

  if (count === 1) {
    return (
      <div style={{ ...containerStyle, gridTemplateColumns: '1fr' }}>
        <div style={{ height: 360 }}>
          <img src={shown[0]} alt="Post photo" style={imgStyle} />
        </div>
      </div>
    )
  }

  if (count === 2) {
    return (
      <div style={{ ...containerStyle, gridTemplateColumns: '1fr 1fr', height: 260 }}>
        {shown.map((url, i) => (
          <img key={i} src={url} alt={`Photo ${i + 1}`} style={imgStyle} />
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div style={{ ...containerStyle, gridTemplateColumns: '2fr 1fr', height: 300 }}>
        <img src={shown[0]} alt="Photo 1" style={imgStyle} />
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 3, height: '100%' }}>
          <img src={shown[1]} alt="Photo 2" style={imgStyle} />
          <img src={shown[2]} alt="Photo 3" style={imgStyle} />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        ...containerStyle,
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        height: 300,
      }}
    >
      {shown.map((url, i) => (
        <img key={i} src={url} alt={`Photo ${i + 1}`} style={imgStyle} />
      ))}
    </div>
  )
}

export default function PostCard({ post, likedPosts, onLikeToggle }: PostCardProps) {
  const { profile } = useAuth()
  const liked = likedPosts.has(post.id)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const badge = POST_TYPE_BADGE[post.post_type]
  const isUrgentJob = post.post_type === 'job_post' && post.is_urgent

  async function handleLike() {
    const wasLiked = liked
    const delta = wasLiked ? -1 : 1
    const prevCount = likeCount
    setLikeCount(c => c + delta)
    onLikeToggle(post.id, wasLiked)
    const { error } = await supabase.rpc('increment_post_like', {
      post_id: post.id,
      delta,
    })
    if (error) {
      setLikeCount(prevCount)
      onLikeToggle(post.id, !wasLiked)
    }
  }

  async function handleToggleComments() {
    const next = !commentsOpen
    setCommentsOpen(next)
    if (next && !commentsLoaded) {
      const { data } = await supabase
        .from('comments')
        .select(
          'id, post_id, body, created_at, author_id, users!author_id (display_name, handle, avatar_url)'
        )
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(20)

      if (data) {
        setComments(
          data.map((c: Record<string, unknown>) => {
            const u = c.users as {
              display_name: string
              handle: string
              avatar_url: string | null
            } | null
            return {
              id: c.id as string,
              post_id: c.post_id as string,
              body: c.body as string,
              created_at: c.created_at as string,
              author_id: c.author_id as string,
              author_name: u?.display_name ?? 'Unknown',
              author_handle: u?.handle ?? '',
              author_avatar: u?.avatar_url ?? null,
            }
          })
        )
      }
      setCommentsLoaded(true)
    }
  }

  async function handleCommentSubmit() {
    if (!commentText.trim() || !profile) return
    setSubmitting(true)
    const optimistic: FeedComment = {
      id: `opt-${Date.now()}`,
      post_id: post.id,
      body: commentText.trim(),
      created_at: new Date().toISOString(),
      author_id: profile.id,
      author_name: profile.display_name ?? 'You',
      author_handle: profile.handle ?? '',
      author_avatar: profile.avatar_url ?? null,
    }
    setComments(prev => [...prev, optimistic])
    setCommentCount(c => c + 1)
    setCommentText('')

    await supabase.from('comments').insert({
      post_id: post.id,
      author_id: profile.id,
      body: optimistic.body,
    })
    setSubmitting(false)
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AuthorAvatar name={post.author_name} avatar={post.author_avatar} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{post.author_name}</span>
            {post.author_verified && <CheckCircle size={13} color="#2563EB" fill="#2563EB" />}
            {post.is_boosted && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#D97706',
                  fontFamily: 'var(--font-condensed)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                ⚡ Boosted
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
            {post.author_trade ? `${post.author_trade} · ` : ''}
            {timeAgo(post.created_at)}
          </p>
        </div>
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 12,
            background: isUrgentJob ? 'rgba(220,38,38,0.15)' : badge?.bg,
            color: isUrgentJob ? '#DC2626' : badge?.text,
            fontFamily: 'var(--font-condensed)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {isUrgentJob ? 'Urgent Hire' : badge?.label}
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--color-text)',
            whiteSpace: 'pre-line',
          }}
        >
          {post.body}
        </p>
      </div>

      {post.media_urls.length > 0 && <MediaGrid urls={post.media_urls} />}

      {post.hashtags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {post.hashtags.map(tag => (
            <span key={tag} style={{ fontSize: 12, color: 'var(--color-brand)', fontWeight: 600 }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--color-border)', margin: '14px 0' }} />

      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={handleLike}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            color: liked ? 'var(--color-brand)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Heart size={15} fill={liked ? 'var(--color-brand)' : 'none'} />
          {likeCount}
        </button>
        <button
          onClick={handleToggleComments}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            color: commentsOpen ? 'var(--color-brand)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <MessageCircle size={15} />
          {commentCount}
          {commentsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <Share2 size={15} />
          {post.share_count}
        </button>
      </div>

      {commentsOpen && (
        <div style={{ marginTop: 4 }}>
          <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 14 }} />

          {comments.length === 0 && commentsLoaded && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              No comments yet. Be the first!
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AuthorAvatar name={c.author_name} avatar={c.author_avatar} size={30} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{c.author_name} </span>
                    <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
                      {c.body}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 12 }}>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {profile && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AuthorAvatar
                name={profile.display_name ?? 'You'}
                avatar={profile.avatar_url ?? null}
                size={30}
              />
              <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleCommentSubmit()
                    }
                  }}
                  style={{
                    flex: 1,
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 13,
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                <button
                  onClick={() => void handleCommentSubmit()}
                  disabled={!commentText.trim() || submitting}
                  style={{
                    background: commentText.trim() ? 'var(--color-brand)' : 'var(--color-border)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <Send size={13} color="#fff" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
