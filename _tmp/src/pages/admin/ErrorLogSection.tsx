import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp, Circle } from 'lucide-react'
import { SectionCard, SectionProps } from './shared'

interface ErrorEntry {
  id: string
  timestamp: string
  context: string
  message: string
  detail: string | null
  stack: string | null
  userId: string | null
  route: string | null
  method: string | null
  statusCode: number | null
}

const CONTEXT_COLORS: Record<string, string> = {
  post: '#e05252',
  upload: '#e07c3a',
  onboarding: '#e0c23a',
  auth: '#9b6fe0',
  sms: '#3abfe0',
  stripe: '#5271e0',
  admin: '#e052a0',
  server: '#aaa',
}

export default function ErrorLogSection({ authHeaders }: SectionProps) {
  const [entries, setEntries] = useState<ErrorEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? `?context=${filter}` : ''
      const res = await fetch(`/api/admin/error-log${params}`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setEntries(data.items ?? [])
        setTotal(data.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function handleClear() {
    if (!confirm('Clear all error logs? This cannot be undone.')) return
    setClearing(true)
    await fetch('/api/admin/error-log', { method: 'DELETE', headers: authHeaders() })
    setEntries([])
    setTotal(0)
    setClearing(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const contexts = ['all', ...Array.from(new Set(entries.map(e => e.context)))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard
        title={`Error Log — ${total} recorded`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => void load()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--color-text)',
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => void handleClear()}
              disabled={clearing || entries.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: entries.length === 0 ? 'var(--color-bg)' : '#e0525220',
                border: `1px solid ${entries.length === 0 ? 'var(--color-border)' : '#e05252'}`,
                borderRadius: 6,
                cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
                color: entries.length === 0 ? 'var(--color-text-muted)' : '#e05252',
                opacity: clearing ? 0.6 : 1,
              }}
            >
              <Trash2 size={13} /> Clear All
            </button>
          </div>
        }
      >
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {contexts.map(ctx => (
            <button
              key={ctx}
              onClick={() => setFilter(ctx)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background:
                  filter === ctx
                    ? (CONTEXT_COLORS[ctx] ?? 'var(--color-brand)')
                    : 'var(--color-bg)',
                color: filter === ctx ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {ctx}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 13,
            }}
          >
            Loading error log...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <AlertTriangle size={28} color="var(--color-text-muted)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              No errors logged. That's a good sign.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry, i) => {
              const isOpen = expanded.has(entry.id)
              const color = CONTEXT_COLORS[entry.context] ?? '#aaa'
              return (
                <div
                  key={entry.id}
                  style={{
                    borderBottom: i < entries.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '12px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <Circle
                      size={8}
                      fill={color}
                      color={color}
                      style={{ marginTop: 5, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color,
                            padding: '2px 6px',
                            background: `${color}20`,
                            borderRadius: 4,
                          }}
                        >
                          {entry.context}
                        </span>
                        {entry.route && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-muted)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {entry.method} {entry.route}
                          </span>
                        )}
                        {entry.statusCode && (
                          <span
                            style={{
                              fontSize: 11,
                              color: entry.statusCode >= 500 ? '#e05252' : '#e0a03a',
                              fontWeight: 700,
                            }}
                          >
                            {entry.statusCode}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-muted)',
                            marginLeft: 'auto',
                          }}
                        >
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                        }}
                      >
                        {entry.message}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp size={14} color="var(--color-text-muted)" />
                    ) : (
                      <ChevronDown size={14} color="var(--color-text-muted)" />
                    )}
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        padding: '0 20px 16px 40px',
                        background: 'var(--color-bg)',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {entry.detail && (
                        <div style={{ marginTop: 12 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Detail
                          </p>
                          <p
                            style={{
                              fontSize: 13,
                              color: 'var(--color-text)',
                              margin: 0,
                              lineHeight: 1.6,
                            }}
                          >
                            {entry.detail}
                          </p>
                        </div>
                      )}
                      {entry.userId && (
                        <div style={{ marginTop: 10 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            User ID
                          </p>
                          <code
                            style={{
                              fontSize: 12,
                              color: 'var(--color-text)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {entry.userId}
                          </code>
                        </div>
                      )}
                      {entry.stack && (
                        <div style={{ marginTop: 10 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Stack Trace
                          </p>
                          <pre
                            style={{
                              fontSize: 11,
                              color: '#e05252',
                              fontFamily: 'monospace',
                              background: '#1a0a0a',
                              padding: 12,
                              borderRadius: 6,
                              overflowX: 'auto',
                              margin: 0,
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            {entry.stack}
                          </pre>
                        </div>
                      )}
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          margin: '10px 0 0',
                        }}
                      >
                        Error ID: <code style={{ fontFamily: 'monospace' }}>{entry.id}</code>
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="What These Errors Mean">
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              {
                ctx: 'post',
                label: 'Post Creation',
                desc: 'Errors when users try to create a feed post. Usually a database permission issue.',
              },
              {
                ctx: 'upload',
                label: 'File Upload',
                desc: 'Photo uploads failing. Usually Supabase storage bucket permissions.',
              },
              {
                ctx: 'onboarding',
                label: 'Onboarding',
                desc: 'Profile setup failures. Usually missing required fields or schema mismatch.',
              },
              {
                ctx: 'auth',
                label: 'Authentication',
                desc: 'Login or token verification failures.',
              },
              {
                ctx: 'stripe',
                label: 'Stripe / Payments',
                desc: 'Credit purchase or webhook processing errors.',
              },
              { ctx: 'sms', label: 'SMS', desc: 'Text message dispatch failures via Telnyx.' },
              {
                ctx: 'admin',
                label: 'Admin Actions',
                desc: 'Errors triggered by admin panel operations.',
              },
              {
                ctx: 'server',
                label: 'Server / General',
                desc: 'Uncaught server errors or unhandled exceptions.',
              },
            ].map(({ ctx, label, desc }) => (
              <div
                key={ctx}
                style={{
                  padding: 12,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${CONTEXT_COLORS[ctx] ?? '#aaa'}`,
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
