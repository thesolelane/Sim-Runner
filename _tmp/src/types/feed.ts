export type PostType =
  | 'project_update'
  | 'job_post'
  | 'bid_post'
  | 'trade_tip'
  | 'safety_alert'
  | 'referral'
  | 'story'

export interface FeedPost {
  id: string
  post_type: PostType
  body: string
  media_urls: string[]
  hashtags: string[]
  like_count: number
  comment_count: number
  share_count: number
  is_urgent: boolean
  is_boosted: boolean
  created_at: string
  author_id: string
  tagged_user_id?: string | null
  linked_job_id?: string | null
  linked_rfq_id?: string | null
  author_name: string
  author_handle: string
  author_avatar: string | null
  author_account_type: string
  author_trade: string | null
  author_verified: boolean
}

export interface FeedComment {
  id: string
  post_id: string
  body: string
  created_at: string
  author_id: string
  author_name: string
  author_handle: string
  author_avatar: string | null
}

export type FilterType =
  | 'all'
  | 'project_update'
  | 'bid_post'
  | 'job_post'
  | 'trade_tip'
  | 'safety_alert'

export interface FilterOption {
  key: FilterType
  label: string
}

export const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All' },
  { key: 'project_update', label: 'Projects' },
  { key: 'bid_post', label: 'Bids' },
  { key: 'job_post', label: 'Jobs' },
  { key: 'trade_tip', label: 'Tips' },
  { key: 'safety_alert', label: 'Safety' },
]

export interface PostTypeBadge {
  bg: string
  text: string
  label: string
}

export const POST_TYPE_BADGE: Record<string, PostTypeBadge> = {
  project_update: { bg: 'rgba(37,99,235,0.15)', text: '#2563EB', label: 'Project Update' },
  bid_post: { bg: 'rgba(232,93,4,0.15)', text: '#E85D04', label: 'Open Bid' },
  job_post: { bg: 'rgba(220,38,38,0.15)', text: '#DC2626', label: 'Job Post' },
  trade_tip: { bg: 'rgba(5,150,105,0.15)', text: '#059669', label: 'Trade Tip' },
  safety_alert: { bg: 'rgba(217,119,6,0.15)', text: '#D97706', label: 'Safety Alert' },
  referral: { bg: 'rgba(124,58,237,0.15)', text: '#7C3AED', label: 'Referral' },
  story: { bg: 'rgba(14,165,233,0.15)', text: '#0EA5E9', label: 'Story' },
}

export interface SidebarUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: string
  primary_trade: string | null
  location: string | null
}
