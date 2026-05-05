-- Migration 026: Replace FOR ALL USING on comments with explicit per-operation policies.
-- PostgREST does not apply the USING clause as WITH CHECK on INSERT for FOR ALL policies,
-- so direct inserts via authenticated user JWT fail with "new row violates row-level
-- security policy". Split into explicit INSERT / UPDATE / DELETE policies.

DROP POLICY IF EXISTS "Authors can manage own comments" ON public.comments;

CREATE POLICY "Authors can insert own comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

NOTIFY pgrst, 'reload schema';
