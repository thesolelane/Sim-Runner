-- Migration 016: Fix service_role grants on users table + create admin profile
-- Run this in the Supabase SQL Editor.

-- ============================================================
-- STEP 1: Ensure service_role has full access to public.users
-- (Column-level revokes from other roles can unintentionally
--  block service_role if table-level grant was not set explicitly)
-- ============================================================
GRANT ALL ON public.users TO service_role;

-- Also ensure the update grant covers all needed columns for service_role
GRANT SELECT, INSERT, UPDATE ON public.users TO service_role;

-- ============================================================
-- STEP 2: Upsert Anthony Cooper as site admin
-- ============================================================
INSERT INTO public.users (
  id,
  email,
  display_name,
  handle,
  account_type,
  avatar_url,
  credit_balance,
  created_at
)
VALUES (
  'c012f282-b268-45ea-b207-56c09869c2f6',
  'acooper@cooperanth.com',
  'Anthony Cooper',
  'acooper',
  'admin',
  null,
  0,
  now()
)
ON CONFLICT (id) DO UPDATE
  SET account_type  = 'admin',
      display_name  = 'Anthony Cooper';

-- Confirm
SELECT id, display_name, handle, account_type FROM public.users
WHERE id = 'c012f282-b268-45ea-b207-56c09869c2f6';
