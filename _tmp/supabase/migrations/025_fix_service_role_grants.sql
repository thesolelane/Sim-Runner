-- Migration 025: Grant service_role full access to all public tables
-- Required for supabaseAdmin (service role) to insert/update via PostgREST.
-- Without table-level grants, service_role gets "permission denied" even
-- though it bypasses RLS — the Postgres GRANT and RLS are separate mechanisms.
-- Safe to re-run (GRANT is idempotent).

GRANT ALL ON public.posts              TO service_role;
GRANT ALL ON public.comments           TO service_role;
GRANT ALL ON public.connections        TO service_role;
GRANT ALL ON public.rfqs               TO service_role;
GRANT ALL ON public.bids               TO service_role;
GRANT ALL ON public.job_listings       TO service_role;
GRANT ALL ON public.job_applications   TO service_role;
GRANT ALL ON public.messages           TO service_role;
GRANT ALL ON public.notifications      TO service_role;
GRANT ALL ON public.credentials        TO service_role;
GRANT ALL ON public.contractor_profiles TO service_role;
GRANT ALL ON public.purchases          TO service_role;
GRANT ALL ON public.credit_ledger      TO service_role;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
