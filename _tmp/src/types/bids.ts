export interface RFQ {
  id: string
  poster_id: string
  title: string
  trade_needed: string
  project_type: string | null
  scope_description: string
  budget_min: number | null
  budget_max: number | null
  sq_footage: number | null
  start_date: string | null
  duration_weeks: number | null
  bid_deadline: string | null
  location_zip: string
  location_city: string | null
  location_state: string | null
  requirements: string[]
  bid_count: number
  status: 'open' | 'awarded' | 'closed' | 'archived'
  awarded_to: string | null
  is_boosted: boolean
  created_at: string
  poster_name?: string
  poster_handle?: string
  poster_avatar?: string | null
  poster_account_type?: string
}

export interface BidRow {
  id: string
  rfq_id: string
  bidder_id: string
  amount: number
  timeline_weeks: number | null
  cover_note: string | null
  document_url: string | null
  status: 'pending' | 'under_review' | 'awarded' | 'not_awarded'
  submitted_at: string
  bidder_name?: string
  bidder_handle?: string
  bidder_avatar?: string | null
  bidder_trade?: string | null
  bidder_years_exp?: number
  bidder_rating?: number
  bidder_rating_count?: number
  bidder_projects_completed?: number
}

export interface MyBid {
  id: string
  rfq_id: string
  amount: number
  timeline_weeks: number | null
  status: 'pending' | 'under_review' | 'awarded' | 'not_awarded'
  submitted_at: string
  rfq_title: string
  rfq_trade: string
  rfq_location_city: string | null
  rfq_location_state: string | null
  rfq_budget_min: number | null
  rfq_budget_max: number | null
  rfq_deadline: string | null
  rfq_status: string
  poster_name: string
  poster_handle: string
}
