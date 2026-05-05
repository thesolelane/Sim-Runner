-- Migration 008: Badge system + vouches table
-- Run this in the Supabase SQL Editor against your existing database.

-- Add badge_tier column to contractor_profiles
alter table public.contractor_profiles
  add column if not exists badge_tier text
  check (badge_tier in ('pro_verified', 'licensed', 'vouched'));

-- Create vouches table (Pro Verified contractors can vouch for others)
create table if not exists public.vouches (
  id          uuid primary key default uuid_generate_v4(),
  voucher_id  uuid not null references public.contractor_profiles(id) on delete cascade,
  vouchee_id  uuid not null references public.contractor_profiles(id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  unique(voucher_id, vouchee_id)
);

alter table public.vouches enable row level security;

create policy "Vouches are public" on public.vouches
  for select using (true);

create policy "Pro contractors can vouch" on public.vouches
  for insert with check (
    auth.uid() = (select user_id from public.contractor_profiles where id = voucher_id)
    and exists (
      select 1 from public.contractor_profiles
      where id = voucher_id and badge_tier = 'pro_verified'
    )
  );

create policy "Vouchers can delete own vouches" on public.vouches
  for delete using (
    auth.uid() = (select user_id from public.contractor_profiles where id = voucher_id)
  );

-- NOTE: badge_tier is set manually by admin or via a database function.
-- To test the badge system, run this to grant a test contractor Pro Verified status:
-- UPDATE contractor_profiles SET badge_tier = 'pro_verified' WHERE user_id = '<user-id>';
