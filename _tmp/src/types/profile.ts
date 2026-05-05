export interface SocialLinks {
  website?: string
  instagram?: string
  linkedin?: string
  tiktok?: string
  facebook?: string
  youtube?: string
}

export interface ProfileUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: string
  location_city: string | null
  location_state: string | null
  location_zip: string | null
  credit_balance: number
  social_links: SocialLinks | null
  created_at: string
}

export type BadgeTier = 'pro_verified' | 'licensed' | 'vouched' | null

export interface ContractorProfile {
  id: string
  user_id: string
  business_name: string | null
  primary_trade: string
  secondary_trades: string[]
  years_experience: number
  bio: string | null
  service_radius_miles: number
  availability_status: 'available' | 'busy' | 'not_available'
  available_from: string | null
  visible_to_owners: boolean
  rating_avg: number
  rating_count: number
  projects_completed: number
  total_work_value: number
  badge_tier: BadgeTier
}

export interface Credential {
  id: string
  contractor_id: string
  credential_type: string
  masked_display: string
  issuing_state: string | null
  expiry_date: string | null
  verified_at: string | null
  status: 'active' | 'expired' | 'pending'
  created_at: string
}

export interface PortfolioProject {
  id: string
  contractor_id: string
  title: string
  description: string | null
  trade_tags: string[]
  photo_urls: string[]
  completed_date: string | null
  is_featured: boolean
  created_at: string
}

export interface ProfileReview {
  id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  body: string
  verified_job: boolean
  created_at: string
  reviewer_name: string
  reviewer_handle: string
  reviewer_avatar: string | null
}

export type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected'

export type ProfileTab = 'feed' | 'portfolio' | 'bids' | 'reviews' | 'about'
