export type AccountType =
  | 'contractor'
  | 'project_owner'
  | 'agent'
  | 'homeowner'
  | 'admin'
  | 'admin_2'
  | 'hired_dev'
  | 'moderator'
export type AvailabilityStatus = 'available' | 'busy' | 'not_available'
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected'
export type DelegationStatus = 'pending' | 'active' | 'revoked'
export type DelegationRole = 'admin' | 'contributor'
export type PostType =
  | 'project_update'
  | 'job_post'
  | 'bid_post'
  | 'trade_tip'
  | 'safety_alert'
  | 'referral'
  | 'story'
export type JobType = 'full_time' | 'contract' | 'per_diem' | 'subcontract'
export type RfqStatus = 'open' | 'awarded' | 'closed' | 'archived'
export type BidStatus = 'pending' | 'under_review' | 'awarded' | 'not_awarded'
export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'post_liked'
  | 'post_commented'
  | 'bid_submitted'
  | 'bid_awarded'
  | 'job_applied'
  | 'rfq_closing_soon'
  | 'credential_expiring'
  | 'referral_received'
  | 'safety_alert'
  | 'credits_added'
  | 'message_received'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string
          handle: string
          avatar_url: string | null
          account_type: AccountType
          location_city: string | null
          location_state: string | null
          location_zip: string | null
          credit_balance: number
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      contractor_profiles: {
        Row: {
          id: string
          user_id: string
          business_name: string | null
          primary_trade: string
          secondary_trades: string[]
          years_experience: number
          bio: string | null
          service_radius_miles: number
          availability_status: AvailabilityStatus
          available_from: string | null
          visible_to_owners: boolean
          rating_avg: number
          rating_count: number
          projects_completed: number
          total_work_value: number
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['contractor_profiles']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<Database['public']['Tables']['contractor_profiles']['Insert']>
      }
      credentials: {
        Row: {
          id: string
          contractor_id: string
          credential_type: string
          license_number_encrypted: string | null
          masked_display: string
          issuing_state: string | null
          expiry_date: string | null
          verified_at: string | null
          status: 'active' | 'expired' | 'pending'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['credentials']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['credentials']['Insert']>
      }
      connections: {
        Row: {
          id: string
          requester_id: string
          recipient_id: string
          status: ConnectionStatus
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['connections']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['connections']['Insert']>
      }
      posts: {
        Row: {
          id: string
          author_id: string
          post_type: PostType
          body: string
          media_urls: string[]
          hashtags: string[]
          linked_job_id: string | null
          linked_rfq_id: string | null
          tagged_user_id: string | null
          like_count: number
          comment_count: number
          share_count: number
          is_urgent: boolean
          is_boosted: boolean
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['posts']['Row'],
          'id' | 'created_at' | 'like_count' | 'comment_count' | 'share_count'
        >
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
      job_listings: {
        Row: {
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
          pay_unit: 'hourly' | 'salary' | 'project'
          certs_required: string[]
          start_date: string | null
          duration_weeks: number | null
          is_urgent: boolean
          is_boosted: boolean
          status: 'open' | 'filled' | 'closed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['job_listings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['job_listings']['Insert']>
      }
      job_applications: {
        Row: {
          id: string
          listing_id: string
          applicant_id: string
          cover_note: string | null
          status: 'applied' | 'reviewed' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['job_applications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['job_applications']['Insert']>
      }
      rfqs: {
        Row: {
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
          status: RfqStatus
          awarded_to: string | null
          is_boosted: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['rfqs']['Row'], 'id' | 'created_at' | 'bid_count'>
        Update: Partial<Database['public']['Tables']['rfqs']['Insert']>
      }
      bids: {
        Row: {
          id: string
          rfq_id: string
          bidder_id: string
          amount: number
          timeline_weeks: number | null
          cover_note: string | null
          document_url: string | null
          status: BidStatus
          submitted_at: string
        }
        Insert: Omit<Database['public']['Tables']['bids']['Row'], 'id' | 'submitted_at'>
        Update: Partial<Database['public']['Tables']['bids']['Insert']>
      }
      messages: {
        Row: {
          id: string
          thread_id: string
          sender_id: string
          recipient_id: string
          body: string
          read_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          body: string
          entity_id: string | null
          entity_type: string | null
          read_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      credit_ledger: {
        Row: {
          id: string
          user_id: string
          delta: number
          balance_after: number
          transaction_type: 'purchase' | 'spend' | 'refund'
          description: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['credit_ledger']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['credit_ledger']['Insert']>
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          stripe_session_id: string
          credits: number
          amount_cents: number
          status: 'pending' | 'completed' | 'failed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchases']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>
      }
      projects: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      reviews: {
        Row: {
          id: string
          reviewer_id: string
          reviewee_id: string
          rating: number
          body: string
          verified_job: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>
      }
      dwell_events: {
        Row: {
          id: string
          user_id: string | null
          entity_type: 'post' | 'rfq' | 'job' | 'profile' | 'bid'
          entity_id: string
          dwell_ms: number
          session_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['dwell_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['dwell_events']['Insert']>
      }
      account_delegations: {
        Row: {
          id: string
          principal_id: string
          delegate_id: string | null
          role: DelegationRole
          invite_email: string
          invite_token: string | null
          invite_expires_at: string | null
          status: DelegationStatus
          responsibility_accepted_at: string
          responsibility_terms_version: string
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['account_delegations']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<Database['public']['Tables']['account_delegations']['Insert']>
      }
      delegate_audit_log: {
        Row: {
          id: string
          delegation_id: string
          actual_user_id: string
          acting_as_user_id: string
          action_type: string
          action_detail: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['delegate_audit_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['delegate_audit_log']['Insert']>
      }
    }
  }
}
