-- 011_sms_fields.sql
-- Adds SMS notification subscription fields to the users table.
-- phone_number is sensitive PII and must never be exposed to other users.

alter table public.users
  add column if not exists phone_number          text,
  add column if not exists phone_verified        boolean not null default false,
  add column if not exists sms_tier              text check (sms_tier in ('starter', 'unlimited')),
  add column if not exists sms_alerts_enabled    boolean not null default true,
  add column if not exists sms_count_this_period integer not null default 0,
  add column if not exists sms_otp_hash          text,
  add column if not exists sms_otp_expires_at    timestamptz,
  add column if not exists stripe_sms_sub_id     text;

-- Revoke direct SELECT on sensitive SMS columns from anon and authenticated roles.
-- Postgres does not support per-column RLS, so we use column-level GRANT/REVOKE.
-- First, revoke all column-level access, then re-grant only the safe columns.

-- Revoke SELECT on the entire table for anon/authenticated first, then re-grant only safe columns.
-- This approach ensures phone_number, sms_otp_hash, sms_otp_expires_at, stripe_sms_sub_id
-- are never readable by non-service-role clients.

revoke select on public.users from anon, authenticated;

grant select (
  id, display_name, handle, avatar_url, account_type,
  location_city, location_state, location_zip,
  credit_balance, social_links, created_at, deleted_at,
  is_delegate, delegate_principal_id,
  phone_verified, sms_tier, sms_alerts_enabled, sms_count_this_period
) on public.users to anon, authenticated;

grant insert on public.users to authenticated;

revoke update on public.users from anon, authenticated;

grant update (
  display_name, handle, avatar_url,
  location_city, location_state, location_zip,
  credit_balance, social_links, deleted_at,
  is_delegate, delegate_principal_id
) on public.users to authenticated;

comment on column public.users.phone_number is
  'Private — SMS recipient phone. Must only be read/written via service_role. Never returned to other users.';
comment on column public.users.sms_tier is
  'SMS subscription tier: null = not subscribed, starter = up to 150/month, unlimited = no cap.';
comment on column public.users.sms_alerts_enabled is
  'User-controlled pause toggle. When false, SMS is skipped but in-app notification still fires.';
comment on column public.users.sms_count_this_period is
  'Count of SMS sent in the current billing period. Reset by Stripe subscription renewal webhook.';
comment on column public.users.stripe_sms_sub_id is
  'Stripe subscription ID for the SMS add-on. Used to cancel / reactivate.';
