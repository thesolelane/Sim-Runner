-- Add social_links JSONB column to users table
-- Stores URLs for: website, instagram, linkedin, tiktok, facebook, youtube
alter table public.users
  add column if not exists social_links jsonb not null default '{}'::jsonb;
