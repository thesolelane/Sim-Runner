-- Migration 020: Add is_flagged column to posts for admin moderation
-- Allows admins/moderators to flag posts for review queue

alter table public.posts add column if not exists is_flagged boolean not null default false;

-- Index for fast flagged content queries from admin dashboard
create index if not exists idx_posts_is_flagged on public.posts (is_flagged) where is_flagged = true;
