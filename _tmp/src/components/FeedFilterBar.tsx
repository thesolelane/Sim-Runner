import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FILTER_OPTIONS, FilterType } from '../types/feed'

export default function FeedFilterBar() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const active = (searchParams.get('type') ?? 'all') as FilterType

  function handleFilter(key: FilterType) {
    const params = new URLSearchParams()
    if (key !== 'all') params.set('type', key)
    navigate({ search: params.toString() })
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 56,
        zIndex: 90,
      }}
    >
      <div
        className="container feed-filter-inner"
        style={
          {
            display: 'flex',
            gap: 4,
            paddingTop: 10,
            paddingBottom: 10,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties
        }
      >
        {FILTER_OPTIONS.map(opt => {
          const isActive = active === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => handleFilter(opt.key)}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                border: isActive
                  ? '1.5px solid var(--color-brand)'
                  : '1.5px solid var(--color-border)',
                background: isActive ? 'var(--color-brand-light)' : 'transparent',
                color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-condensed)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
