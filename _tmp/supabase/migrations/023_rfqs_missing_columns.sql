-- Migration 023: Add ALL missing columns to rfqs and job_listings tables
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS throughout.
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ============================================================
-- rfqs table — add every column that may be missing
-- ============================================================
alter table public.rfqs
  add column if not exists requirements   text[]      not null default '{}',
  add column if not exists bid_deadline   timestamptz,
  add column if not exists awarded_to     uuid        references public.users(id),
  add column if not exists is_boosted     boolean     not null default false,
  add column if not exists bid_count      integer     not null default 0;

-- ============================================================
-- job_listings table — add every column that may be missing
-- ============================================================
alter table public.job_listings
  add column if not exists certs_required  text[]   not null default '{}',
  add column if not exists duration_weeks  integer,
  add column if not exists is_urgent       boolean  not null default false,
  add column if not exists is_boosted      boolean  not null default false;

-- ============================================================
-- bids table — add document_url if missing
-- ============================================================
alter table public.bids
  add column if not exists document_url text;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
