-- Migration 019: Performance indexes
-- Run in Supabase SQL Editor

-- Posts (most queried table — feed ordering + author lookup)
CREATE INDEX IF NOT EXISTS idx_posts_created_at   ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id     ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_post_type     ON public.posts (post_type);

-- Connections (used on every feed load to build connection set)
CREATE INDEX IF NOT EXISTS idx_connections_requester ON public.connections (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON public.connections (recipient_id, status);

-- Bids (contractor dashboard)
CREATE INDEX IF NOT EXISTS idx_bids_bidder_status   ON public.bids (bidder_id, status);
CREATE INDEX IF NOT EXISTS idx_bids_rfq_id          ON public.bids (rfq_id);

-- Job listings
CREATE INDEX IF NOT EXISTS idx_jobs_poster_status   ON public.job_listings (poster_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created  ON public.job_listings (status, created_at DESC);

-- Notifications (notification bell)
CREATE INDEX IF NOT EXISTS idx_notif_user_read      ON public.notifications (user_id, read_at);

-- Contractor profiles (sidebar + explore)
CREATE INDEX IF NOT EXISTS idx_cp_trade             ON public.contractor_profiles (primary_trade);
CREATE INDEX IF NOT EXISTS idx_cp_user_id           ON public.contractor_profiles (user_id);

-- RFQs
CREATE INDEX IF NOT EXISTS idx_rfqs_poster          ON public.rfqs (poster_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status_created  ON public.rfqs (status, created_at DESC);

SELECT 'Migration 019 complete — performance indexes created' AS status;
