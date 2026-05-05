import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Send, ArrowLeft, AlertCircle, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProjectInquiryModal from '../components/ProjectInquiryModal'

interface Message {
  id: string
  thread_id: string
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
}

interface OtherUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: string
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

const COLD_MSG_COST = 3

export default function MessageThread() {
  const { threadId } = useParams<{ threadId: string }>()
  const [searchParams] = useSearchParams()
  const withId = searchParams.get('with')
  const { profile, canDelegate, logDelegateAction, delegateSession } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [isFirstContact, setIsFirstContact] = useState(false)
  const [showInquiryModal, setShowInquiryModal] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadMessages = useCallback(async () => {
    if (!profile || !threadId) return

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    const msgs = (data ?? []) as Message[]
    setMessages(msgs)
    setIsFirstContact(msgs.length === 0)

    // Mark unread messages as read
    const unreadIds = msgs.filter(m => m.recipient_id === profile.id && !m.read_at).map(m => m.id)
    if (unreadIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
    }
  }, [profile, threadId])

  const loadOtherUser = useCallback(
    async (msgs: Message[]) => {
      // Prefer the explicit ?with= param; fall back to deriving from messages
      let targetId = withId
      if (!targetId && profile && msgs.length > 0) {
        const m = msgs[0]
        targetId = m.sender_id === profile.id ? m.recipient_id : m.sender_id
      }
      if (!targetId) return

      const { data } = await supabase
        .from('users')
        .select('id, display_name, handle, avatar_url, account_type')
        .eq('id', targetId)
        .single()

      if (data) setOtherUser(data as OtherUser)
    },
    [withId, profile]
  )

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadMessages()
      // loadMessages sets state asynchronously; resolve directly to get msgs for other-user lookup
      const { data } = await supabase
        .from('messages')
        .select('sender_id, recipient_id')
        .eq('thread_id', threadId ?? '')
        .limit(1)
      await loadOtherUser((data ?? []) as Message[])
      setLoading(false)
    }
    init()
  }, [loadMessages, loadOtherUser, threadId])

  useEffect(() => {
    if (!profile || !threadId) return
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        async payload => {
          const msg = payload.new as Message
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          setIsFirstContact(false)
          if (msg.recipient_id === profile.id && !msg.read_at) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', msg.id)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(overrideBody?: string) {
    const messageBody = overrideBody ?? body.trim()
    if (!profile || !otherUser || !threadId || !messageBody || sending) return

    if (!canDelegate('message')) {
      setSendError('As a Contributor, you do not have permission to send messages.')
      return
    }

    setSending(true)
    setSendError('')

    const { error } = await supabase.rpc('send_message', {
      p_recipient_id: otherUser.id,
      p_thread_id: threadId,
      p_body: messageBody,
    })

    if (error) {
      if (error.message.includes('Insufficient credits')) {
        navigate('/credits')
        return
      }
      setSendError(error.message)
      setSending(false)
      throw new Error(error.message)
    }

    setBody('')
    setIsFirstContact(false)
    setShowInquiryModal(false)
    await loadMessages()
    setSending(false)
    inputRef.current?.focus()
    if (delegateSession) {
      void logDelegateAction('send_message', { thread_id: threadId, recipient_id: otherUser?.id })
    }
  }

  async function handleInquirySubmit(formattedBody: string) {
    await handleSend(formattedBody)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '24px 20px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        Loading...
      </div>
    )
  }

  const isMe = (m: Message) => m.sender_id === profile?.id
  const isNonContractorToContractor =
    profile?.account_type !== 'contractor' && otherUser?.account_type === 'contractor'

  const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E85D04']
  const initials = otherUser?.display_name?.slice(0, 2).toUpperCase() ?? '??'
  const color = otherUser ? COLORS[otherUser.id.charCodeAt(0) % COLORS.length] : '#ccc'

  return (
    <div
      style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
      }}
    >
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}
      >
        <button
          onClick={() => navigate('/messages')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            padding: 4,
          }}
        >
          <ArrowLeft size={20} />
        </button>
        {otherUser ? (
          <Link
            to={`/profile/${otherUser.handle}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
          >
            {otherUser.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt=""
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="avatar-placeholder"
                style={{ width: 36, height: 36, background: color, fontSize: 12 }}
              >
                {initials}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                {otherUser.display_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                @{otherUser.handle}
              </div>
            </div>
          </Link>
        ) : (
          <span style={{ fontSize: 15, fontWeight: 700 }}>Thread</span>
        )}
      </div>

      {/* First-contact inquiry prompt for non-contractors messaging contractors */}
      {isNonContractorToContractor && isFirstContact && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '20px 20px',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--color-brand-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <FileText size={20} color="var(--color-brand)" />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--color-text)',
              marginBottom: 6,
            }}
          >
            Send a Project Inquiry
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
              marginBottom: 16,
              maxWidth: 380,
              margin: '0 auto 16px',
            }}
          >
            Fill out a structured request — trade, location, timeline, and budget — so{' '}
            {otherUser?.display_name ?? 'this contractor'} gets everything they need to give you a
            real answer.
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: 'var(--color-brand)',
                background: 'var(--color-brand-light)',
                borderRadius: 99,
                padding: '3px 10px',
              }}
            >
              {COLD_MSG_COST} credits to send
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Balance: {profile?.credit_balance ?? 0} credits
            </span>
          </div>
          <button
            onClick={() => setShowInquiryModal(true)}
            className="btn btn-primary"
            style={{ padding: '10px 28px' }}
          >
            Fill out project inquiry →
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingBottom: 12,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              marginTop: 40,
            }}
          >
            No messages yet. Say hello!
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              flexDirection: isMe(m) ? 'row-reverse' : 'row',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            {!isMe(m) && otherUser && (
              <div style={{ flexShrink: 0 }}>
                {otherUser.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="avatar-placeholder"
                    style={{ width: 28, height: 28, background: color, fontSize: 10 }}
                  >
                    {initials}
                  </div>
                )}
              </div>
            )}
            <div
              style={{
                maxWidth: '72%',
                background: isMe(m) ? 'var(--color-brand)' : 'var(--color-surface)',
                color: isMe(m) ? '#fff' : 'var(--color-text)',
                borderRadius: isMe(m) ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '9px 13px',
                fontSize: 14,
                lineHeight: 1.5,
                border: isMe(m) ? 'none' : '1px solid var(--color-border)',
              }}
            >
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 10,
                  opacity: 0.65,
                  textAlign: isMe(m) ? 'right' : 'left',
                }}
              >
                {formatTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Send area — hidden when waiting for inquiry submission */}
      {!(isNonContractorToContractor && isFirstContact) && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          {sendError && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10,
                fontSize: 13,
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={14} /> {sendError}
              {sendError.includes('credits') && (
                <Link
                  to="/credits"
                  style={{
                    color: 'var(--color-brand)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    marginLeft: 4,
                  }}
                >
                  Buy credits →
                </Link>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={2}
              style={{
                flex: 1,
                padding: '9px 12px',
                border: '1.5px solid var(--color-border)',
                borderRadius: 10,
                fontSize: 14,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || !body.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <Send size={15} /> {sending ? '…' : 'Send'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Shift+Enter for new line
          </p>
        </div>
      )}

      {/* Project Inquiry Modal */}
      {showInquiryModal && otherUser && (
        <ProjectInquiryModal
          contractorName={otherUser.display_name}
          creditCost={COLD_MSG_COST}
          creditBalance={profile?.credit_balance ?? 0}
          onSubmit={handleInquirySubmit}
          onCancel={() => setShowInquiryModal(false)}
        />
      )}
    </div>
  )
}
