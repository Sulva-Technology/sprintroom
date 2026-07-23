-- Auto-start due scheduled focus sessions directly in Postgres.
--
-- Previously scheduling relied entirely on the `process-schedules` edge function
-- being deployed and invoked by an external cron with secrets — which was never
-- wired up, so scheduled sessions never fired. This runs the core auto-start in
-- the database on a pg_cron schedule, independent of the edge function (the edge
-- function remains for optional web-push notifications).

-- Idempotently start any pending schedule whose time has arrived, and mark it
-- started. Skips users who already have an active session, and starts at most
-- one session per user per run (the earliest due).
CREATE OR REPLACE FUNCTION public.process_due_focus_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH due AS (
    SELECT DISTINCT ON (fs.user_id) fs.*
    FROM public.focus_schedules fs
    WHERE fs.status IN ('pending', 'warning_sent')
      AND fs.start_time <= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.focus_sessions s
        WHERE s.user_id = fs.user_id AND s.status = 'active'
      )
    ORDER BY fs.user_id, fs.start_time ASC
  ),
  started AS (
    INSERT INTO public.focus_sessions
      (user_id, task_id, workspace_id, project_id, status, duration_minutes, started_at)
    SELECT user_id, task_id, workspace_id, project_id, 'active', COALESCE(duration_minutes, 25), now()
    FROM due
    RETURNING id
  )
  UPDATE public.focus_schedules
  SET status = 'started'
  WHERE id IN (SELECT id FROM due);
END;
$$;

-- Best-effort pg_cron scheduling. Wrapped so a database/environment without
-- pg_cron (e.g. some local setups) still installs the function above and applies
-- cleanly; you can then call process_due_focus_schedules() from any scheduler.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Replace any existing job of the same name.
  BEGIN
    PERFORM cron.unschedule('process-due-focus-schedules');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- no existing job
  END;

  PERFORM cron.schedule(
    'process-due-focus-schedules',
    '* * * * *',
    $cron$SELECT public.process_due_focus_schedules();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (%). process_due_focus_schedules() was installed; schedule it with your own cron.', SQLERRM;
END;
$$;
