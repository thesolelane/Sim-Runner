-- Migration 017: Restore table-level grants on public.users
-- Migration 011 revoked table-level SELECT and replaced with column-level grants.
-- Supabase's PostgREST API layer requires table-level SELECT to function — column-level
-- grants alone cause silent null returns from fetchProfile. This restores table-level
-- access so the REST API works correctly. Sensitive column privacy is enforced at
-- the application layer (fetchProfile only selects safe columns) and via RLS policies.

GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;
