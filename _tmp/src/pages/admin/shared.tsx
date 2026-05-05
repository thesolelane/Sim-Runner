export interface SectionProps {
  authHeaders: () => Record<string, string>
}

export function SectionCard({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '0.3px',
          }}
        >
          {title}
        </span>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  color = 'var(--color-brand)',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </span>
        <span style={{ color, opacity: 0.75 }}>{icon}</span>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          fontFamily: 'var(--font-condensed)',
          color: 'var(--color-text)',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  )
}

export function AdminInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 13,
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        outline: 'none',
        ...style,
      }}
    />
  )
}

export function LoadingRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <div
            style={{ height: 14, background: 'var(--color-border)', borderRadius: 4, opacity: 0.5 }}
          />
        </td>
      ))}
    </tr>
  )
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export const tableHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--color-text-muted)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
}

export const tableCellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-text)',
}
