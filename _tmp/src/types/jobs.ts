export type JobType = 'full_time' | 'contract' | 'per_diem' | 'subcontract'
export type JobPayUnit = 'hourly' | 'salary' | 'project'
export type JobStatus = 'open' | 'filled' | 'closed'

export interface JobListing {
  id: string
  poster_id: string
  title: string
  description: string
  trade_required: string
  job_type: JobType
  location_city: string
  location_state: string
  pay_min: number | null
  pay_max: number | null
  pay_unit: JobPayUnit
  certs_required: string[]
  start_date: string | null
  duration_weeks: number | null
  is_urgent: boolean
  is_boosted: boolean
  status: JobStatus
  created_at: string
  poster?: {
    display_name: string
    handle: string
    avatar_url: string | null
  }
}

export interface JobApplication {
  id: string
  listing_id: string
  applicant_id: string
  cover_note: string | null
  status: 'applied' | 'reviewed' | 'accepted' | 'rejected'
  created_at: string
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: 'Full-time',
  contract: 'Contract',
  per_diem: 'Per-diem',
  subcontract: 'Subcontract',
}

export const JOB_TYPE_DISPLAY_OPTIONS: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'per_diem', label: 'Per-diem' },
  { value: 'subcontract', label: 'Subcontract' },
]

export const JOB_CREDIT_COST = 8

export const TRADE_OPTIONS = [
  'Carpentry',
  'Concrete',
  'Drywall',
  'Electrical',
  'Engineering',
  'General Contractor',
  'HVAC',
  'Masonry',
  'Painting',
  'Plumbing',
  'Roofing',
  'Steel/Ironwork',
  'Tile',
  'Other',
]

export const CERT_OPTIONS = ['OSHA 10', 'OSHA 30', 'Union', 'Own Tools']

export interface PayRangeOption {
  label: string
  min: number | null
  max: number | null
}

export const PAY_RANGE_OPTIONS: PayRangeOption[] = [
  { label: 'Under $30/hr', min: null, max: 30 },
  { label: '$30–$50/hr', min: 30, max: 50 },
  { label: '$50–$75/hr', min: 50, max: 75 },
  { label: '$75+/hr', min: 75, max: null },
]

export function formatPay(listing: JobListing): string {
  if (!listing.pay_min && !listing.pay_max) return 'Pay TBD'
  const unit =
    listing.pay_unit === 'hourly' ? '/hr' : listing.pay_unit === 'salary' ? '/yr' : ' project'
  const fmt = (n: number) => (listing.pay_unit === 'salary' ? `$${Math.round(n / 1000)}K` : `$${n}`)
  if (listing.pay_min && listing.pay_max)
    return `${fmt(listing.pay_min)}–${fmt(listing.pay_max)}${unit}`
  if (listing.pay_min) return `${fmt(listing.pay_min)}+${unit}`
  if (listing.pay_max) return `Up to ${fmt(listing.pay_max)}${unit}`
  return 'Pay TBD'
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
