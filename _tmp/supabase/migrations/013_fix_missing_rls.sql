-- Migration 013: Fix missing RLS on partition tables and app tables
-- Run this in the Supabase SQL Editor.
-- spatial_ref_sys is a PostGIS extension system table — intentionally skipped.

-- ============================================================
-- PARTITION TABLES: dwell_events quarterly partitions
-- ============================================================
ALTER TABLE IF EXISTS public.dwell_events_2026_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2026_q2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2026_q3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2026_q4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2027_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2027_q2 ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE
  partitions TEXT[] := ARRAY[
    'dwell_events_2026_q1','dwell_events_2026_q2','dwell_events_2026_q3','dwell_events_2026_q4',
    'dwell_events_2027_q1','dwell_events_2027_q2'
  ];
  p TEXT;
BEGIN
  FOREACH p IN ARRAY partitions LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p AND policyname = 'Users can insert own dwell events') THEN
      EXECUTE format('CREATE POLICY "Users can insert own dwell events" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', p);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p AND policyname = 'Admins can read dwell events') THEN
      EXECUTE format('CREATE POLICY "Admins can read dwell events" ON public.%I FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = ''admin''))', p);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- PARTITION TABLES: interaction_events quarterly partitions
-- ============================================================
ALTER TABLE IF EXISTS public.interaction_events_2026_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2026_q2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2026_q3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2026_q4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2027_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2027_q2 ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE
  partitions TEXT[] := ARRAY[
    'interaction_events_2026_q1','interaction_events_2026_q2','interaction_events_2026_q3','interaction_events_2026_q4',
    'interaction_events_2027_q1','interaction_events_2027_q2'
  ];
  p TEXT;
BEGIN
  FOREACH p IN ARRAY partitions LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p AND policyname = 'Users see own events') THEN
      EXECUTE format('CREATE POLICY "Users see own events" ON public.%I FOR SELECT USING (auth.uid() = user_id)', p);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p AND policyname = 'Users create own events') THEN
      EXECUTE format('CREATE POLICY "Users create own events" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', p);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- post_likes
-- ============================================================
ALTER TABLE IF EXISTS public.post_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Post likes are public') THEN
    CREATE POLICY "Post likes are public" ON public.post_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Users manage own post likes') THEN
    CREATE POLICY "Users manage own post likes" ON public.post_likes FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- credit_bundles
-- ============================================================
ALTER TABLE IF EXISTS public.credit_bundles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_bundles' AND policyname = 'Credit bundles are public') THEN
    CREATE POLICY "Credit bundles are public" ON public.credit_bundles FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- credit_action_costs
-- ============================================================
ALTER TABLE IF EXISTS public.credit_action_costs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_action_costs' AND policyname = 'Credit action costs are public') THEN
    CREATE POLICY "Credit action costs are public" ON public.credit_action_costs FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- content_scores
-- ============================================================
ALTER TABLE IF EXISTS public.content_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_scores' AND policyname = 'Admins can read content scores') THEN
    CREATE POLICY "Admins can read content scores" ON public.content_scores
      FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'admin'));
  END IF;
END $$;

-- ============================================================
-- user_affinity_scores
-- ============================================================
ALTER TABLE IF EXISTS public.user_affinity_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_affinity_scores' AND policyname = 'Users see own affinity scores') THEN
    CREATE POLICY "Users see own affinity scores" ON public.user_affinity_scores FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- search_events
-- ============================================================
ALTER TABLE IF EXISTS public.search_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'search_events' AND policyname = 'Users see own search events') THEN
    CREATE POLICY "Users see own search events" ON public.search_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'search_events' AND policyname = 'Users create own search events') THEN
    CREATE POLICY "Users create own search events" ON public.search_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- profile_field_sources
-- ============================================================
ALTER TABLE IF EXISTS public.profile_field_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_field_sources' AND policyname = 'Users manage own profile field sources') THEN
    CREATE POLICY "Users manage own profile field sources" ON public.profile_field_sources FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- verification_orders
-- Uses contractor_id (FK to contractor_profiles.id), not user_id directly.
-- Must join through contractor_profiles to resolve the owning user.
-- ============================================================
ALTER TABLE IF EXISTS public.verification_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'verification_orders' AND policyname = 'Contractors see own verification orders') THEN
    CREATE POLICY "Contractors see own verification orders" ON public.verification_orders
      FOR SELECT USING (
        auth.uid() = (SELECT user_id FROM public.contractor_profiles WHERE id = contractor_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'verification_orders' AND policyname = 'Contractors create own verification orders') THEN
    CREATE POLICY "Contractors create own verification orders" ON public.verification_orders
      FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id FROM public.contractor_profiles WHERE id = contractor_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'verification_orders' AND policyname = 'Admins can manage verification orders') THEN
    CREATE POLICY "Admins can manage verification orders" ON public.verification_orders
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'admin')
      );
  END IF;
END $$;

-- ============================================================
-- DIAGNOSTIC: spatial_ref_sys will still show MISSING — that is expected.
-- It is a PostGIS system table and cannot have RLS applied. Ignore it.
-- All other tables should show 'enabled'.
-- ============================================================
SELECT
  t.tablename,
  CASE WHEN c.relrowsecurity THEN 'enabled' ELSE 'MISSING' END AS rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.schemaname = 'public'
ORDER BY c.relrowsecurity, t.tablename;
