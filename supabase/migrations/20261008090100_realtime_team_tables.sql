-- Publish the team tables to Realtime so comments, the activity feed and the
-- member list update live. Idempotent: skips tables already in the publication
-- (plain ALTER PUBLICATION ... ADD TABLE errors on re-run).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['task_comments', 'task_activity', 'workspace_members'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
