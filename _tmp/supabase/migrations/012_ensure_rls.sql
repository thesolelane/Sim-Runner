-- Migration 012: Ensure RLS is enabled on all public tables
-- Safe to run multiple times (idempotent). Run this in the Supabase SQL Editor.
-- This fixes the Supabase security advisory: "Table publicly accessible (rls_disabled_in_public)"

-- ============================================================
-- STEP 1: Enable RLS on every known public table
-- (ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent — safe to re-run)
-- ============================================================

ALTER TABLE IF EXISTS public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contractor_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credentials              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vouches                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.posts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_listings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rfqs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bids                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_notification_prefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_ledger            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reviews                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.account_delegations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delegate_audit_log       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: Diagnostic check — lists any public table still missing RLS
-- Run the SELECT below after the ALTERs to confirm zero rows returned.
-- ============================================================
SELECT
  t.tablename                                      AS table_name,
  CASE WHEN c.relrowsecurity THEN 'enabled' ELSE 'MISSING' END AS rls_status
FROM pg_tables t
JOIN pg_class c
  ON c.relname    = t.tablename
JOIN pg_namespace n
  ON n.oid        = c.relnamespace
 AND n.nspname    = 'public'
WHERE t.schemaname = 'public'
ORDER BY c.relrowsecurity, t.tablename;
