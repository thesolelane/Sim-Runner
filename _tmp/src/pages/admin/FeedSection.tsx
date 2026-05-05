import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  LoadingRow,
  formatDate,
  tableHeaderStyle,
  tableCellStyle,
} from './shared'

interface PostRow {
  id: string
  body: string
  post_type: string
  like_count: number
  comment_count: number
  created_at: string
  is_flagged: boolean
  author: { display_name: string; handle: string } | null
}

interface CommentRow {
  id: string
  body: string
  post_id: string
  created_at: string
  author: { display_name: string; handle: string } | null
}

export default function FeedSection({ authHeaders }: SectionProps) {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [flaggedPosts, setFlaggedPosts] = useState<PostRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingFlagged, setLoadingFlagged] = useState(true)
  const [loadingComments, setLoadingComments] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')

  function showMsg(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 2500)
  }
  function showErr(err: string) {
    setActionErr(err)
    setTimeout(() => setActionErr(''), 4000)
  }

  useEffect(() => {
    async function loadPosts() {
      setLoadingPosts(true)
      try {
        const res = await fetch('/api/admin/posts', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        setPosts((await res.json()).posts ?? [])
      } finally {
        setLoadingPosts(false)
      }
    }
    async function loadFlagged() {
      setLoadingFlagged(true)
      try {
        const res = await fetch('/api/admin/flagged-posts', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        setFlaggedPosts((await res.json()).posts ?? [])
      } finally {
        setLoadingFlagged(false)
      }
    }
    async function loadComments() {
      setLoadingComments(true)
      try {
        const res = await fetch('/api/admin/comments', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        setComments((await res.json()).comments ?? [])
      } finally {
        setLoadingComments(false)
      }
    }
    void loadPosts()
    void loadFlagged()
    void loadComments()
  }, [])

  async function deletePost(postId: string) {
    if (!confirm('Delete this post? This cannot be undone.')) return
    const res = await fetch(`/api/admin/post/${postId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId))
      showMsg('Post deleted.')
    } else {
      const json = await res.json().catch(() => ({}))
      showErr(json.error ?? 'Failed to delete post')
    }
  }

  async function flagPost(postId: string, flagged: boolean) {
    const res = await fetch(`/api/admin/post/${postId}/flag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ flagged }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, is_flagged: flagged } : p)))
      if (!flagged) {
        setFlaggedPosts(prev => prev.filter(p => p.id !== postId))
      } else {
        const flaggedPost = posts.find(p => p.id === postId)
        if (flaggedPost) setFlaggedPosts(prev => [{ ...flaggedPost, is_flagged: true }, ...prev])
      }
      showMsg(flagged ? 'Post flagged for review.' : 'Flag removed.')
    } else {
      const json = await res.json().catch(() => ({}))
      showErr(json.error ?? 'Failed to update flag')
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment? This cannot be undone.')) return
    const res = await fetch(`/api/admin/comment/${commentId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      showMsg('Comment deleted.')
    } else {
      const json = await res.json().catch(() => ({}))
      showErr(json.error ?? 'Failed to delete comment')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {actionMsg && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(5,150,105,0.08)',
            border: '1px solid rgba(5,150,105,0.25)',
            borderRadius: 8,
            fontSize: 13,
            color: '#059669',
          }}
        >
          {actionMsg}
        </div>
      )}
      {actionErr && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8,
            fontSize: 13,
            color: '#DC2626',
          }}
        >
          {actionErr}
        </div>
      )}

      <SectionCard title={`Flagged Content Queue (${loadingFlagged ? '…' : flaggedPosts.length})`}>
        {loadingFlagged ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : flaggedPosts.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            No flagged content. Flag posts from the list below to surface them here for review.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Author</th>
                  <th style={tableHeaderStyle}>Type</th>
                  <th style={tableHeaderStyle}>Content</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPosts.map(p => (
                  <tr key={p.id} style={{ background: 'rgba(245,158,11,0.04)' }}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.author?.display_name ?? '–'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        @{p.author?.handle ?? '–'}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          background: 'var(--color-border)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {p.post_type}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: 350 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.body}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => void flagPost(p.id, false)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(245,158,11,0.4)',
                            background: 'rgba(245,158,11,0.1)',
                            cursor: 'pointer',
                            color: '#B45309',
                            fontSize: 11,
                          }}
                        >
                          Unflag
                        </button>
                        <button
                          onClick={() => void deletePost(p.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(220,38,38,0.3)',
                            background: 'rgba(220,38,38,0.06)',
                            cursor: 'pointer',
                            color: '#DC2626',
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Posts (last 30)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Author</th>
                <th style={tableHeaderStyle}>Type</th>
                <th style={tableHeaderStyle}>Content</th>
                <th style={tableHeaderStyle}>Likes</th>
                <th style={tableHeaderStyle}>Posted</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingPosts ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={6} />)
              ) : posts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...tableCellStyle,
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      padding: 32,
                    }}
                  >
                    No posts.
                  </td>
                </tr>
              ) : (
                posts.map(p => (
                  <tr
                    key={p.id}
                    style={{ background: p.is_flagged ? 'rgba(245,158,11,0.04)' : 'transparent' }}
                  >
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.author?.display_name ?? '–'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        @{p.author?.handle ?? '–'}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          background: 'var(--color-border)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {p.post_type}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: 300 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.body}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{p.like_count}</td>
                    <td
                      style={{
                        ...tableCellStyle,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(p.created_at)}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => void flagPost(p.id, !p.is_flagged)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${p.is_flagged ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}`,
                            background: p.is_flagged ? 'rgba(245,158,11,0.1)' : 'none',
                            cursor: 'pointer',
                            color: p.is_flagged ? '#B45309' : 'var(--color-text-muted)',
                            fontSize: 11,
                          }}
                        >
                          {p.is_flagged ? 'Unflag' : 'Flag'}
                        </button>
                        <button
                          onClick={() => void deletePost(p.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(220,38,38,0.3)',
                            background: 'rgba(220,38,38,0.06)',
                            cursor: 'pointer',
                            color: '#DC2626',
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Recent Comments (last 30)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Author</th>
                <th style={tableHeaderStyle}>Comment</th>
                <th style={tableHeaderStyle}>Posted</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingComments ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={4} />)
              ) : comments.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...tableCellStyle,
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      padding: 32,
                    }}
                  >
                    No comments.
                  </td>
                </tr>
              ) : (
                comments.map(c => (
                  <tr key={c.id}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {c.author?.display_name ?? '–'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        @{c.author?.handle ?? '–'}
                      </div>
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: 350 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.body}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tableCellStyle,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(c.created_at)}
                    </td>
                    <td style={tableCellStyle}>
                      <button
                        onClick={() => void deleteComment(c.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(220,38,38,0.3)',
                          background: 'rgba(220,38,38,0.06)',
                          cursor: 'pointer',
                          color: '#DC2626',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
