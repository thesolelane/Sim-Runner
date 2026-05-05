import { ShieldCheck, Shield, ThumbsUp } from 'lucide-react'

export type BadgeTier = 'pro_verified' | 'licensed' | 'vouched' | null

interface Props {
  tier: BadgeTier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const CONFIG = {
  pro_verified: {
    label: 'Pro Verified',
    tooltip: 'Licensed, insured, and background-checked by TraydBook',
    color: '#E85D04',
    bg: 'rgba(232,93,4,0.12)',
    border: 'rgba(232,93,4,0.3)',
    Icon: ShieldCheck,
  },
  licensed: {
    label: 'Licensed',
    tooltip: 'License verified by TraydBook',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.3)',
    Icon: Shield,
  },
  vouched: {
    label: 'Vouched',
    tooltip: 'Endorsed by a Pro Verified TraydBook contractor',
    color: '#059669',
    bg: 'rgba(5,150,105,0.12)',
    border: 'rgba(5,150,105,0.3)',
    Icon: ThumbsUp,
  },
}

const SIZE_MAP = {
  sm: { fontSize: 10, padding: '2px 7px', iconSize: 10, gap: 3 },
  md: { fontSize: 12, padding: '3px 9px', iconSize: 12, gap: 4 },
  lg: { fontSize: 14, padding: '5px 12px', iconSize: 14, gap: 6 },
}

export default function VerifiedBadge({ tier, size = 'sm', showLabel = true }: Props) {
  if (!tier) return null
  const c = CONFIG[tier]
  const s = SIZE_MAP[size]
  const { Icon } = c

  return (
    <span
      title={c.tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        fontSize: s.fontSize,
        fontWeight: 700,
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: s.padding,
        lineHeight: 1,
        letterSpacing: 0.2,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={s.iconSize} strokeWidth={2.5} />
      {showLabel && c.label}
    </span>
  )
}
