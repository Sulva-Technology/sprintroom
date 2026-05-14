
-- Enable Realtime for the key tables to support WebSocket updates
BEGIN;
  -- 1. Create the publication if it doesn't exist
  -- Note: Supabase usually has a 'supabase_realtime' publication by default.
  -- We add our tables to it.
  
  -- Drop if exists and recreate to be sure we have the right tables
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_sessions;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_rhythm_logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
COMMIT;
