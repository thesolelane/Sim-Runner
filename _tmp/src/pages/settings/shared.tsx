import { CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function SavedBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(5,150,105,0.1)',
        border: '1px solid rgba(5,150,105,0.25)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        color: '#059669',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--font-condensed)',
        marginTop: 10,
      }}
    >
      <CheckCircle size={14} /> {msg}
    </div>
  )
}

export function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(220,38,38,0.08)',
        border: '1px solid rgba(220,38,38,0.2)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        color: '#DC2626',
        fontSize: 13,
        marginTop: 10,
      }}
    >
      <AlertTriangle size={14} /> {msg}
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
}

export const btnPrimary: React.CSSProperties = {
  padding: '9px 18px',
  background: 'var(--color-brand)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-condensed)',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: '#fff',
  cursor: 'pointer',
}

export const btnGhost: React.CSSProperties = {
  padding: '9px 18px',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-condensed)',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
}

const API_BASE = '/api'

export async function apiFetch(path: string, method: string, body?: object) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json
}

export function TabHeading({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </h2>
  )
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-condensed)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.7px',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        marginBottom: 10,
        marginTop: 24,
      }}
    >
      {children}
    </div>
  )
}

export function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
      }}
    >
      {children}
    </div>
  )
}
