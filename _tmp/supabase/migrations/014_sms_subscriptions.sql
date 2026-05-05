-- Migration 014: SMS subscription preferences table
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.user_sms_prefs (
  user_id              uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  phone_e164           text,
  sms_active           boolean NOT NULL DEFAULT false,
  stripe_customer_id   text,
  stripe_subscription_id text,
  subscription_status  text NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive','active','past_due','canceled')),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sms_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sms prefs" ON public.user_sms_prefs
  FOR ALL USING (auth.uid() = user_id);
