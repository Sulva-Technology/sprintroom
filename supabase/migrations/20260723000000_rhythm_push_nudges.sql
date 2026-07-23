-- Hourly rhythm nudges delivered as real web push, even when the app is closed.
--
-- The client-side AlarmManager only runs while a tab/PWA is alive, so the
-- 06:00-18:00 "clear your rhythm" reminder needs a server-side sender. That
-- sender has to know each user's local time, hence profiles.timezone.

-- ---------------------------------------------------------------------------
-- 1. Per-user timezone + opt-out
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rhythm_nudges_enabled boolean NOT NULL DEFAULT true;

-- An unknown timezone name makes `AT TIME ZONE` raise, which would kill the
-- whole batch. Fall back to UTC instead.
CREATE OR REPLACE FUNCTION public.safe_timezone(tz text)
RETURNS text AS $$
  SELECT CASE
    WHEN tz IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz)
      THEN tz
    ELSE 'UTC'
  END;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- 2. Dispatch ledger — one row per (user, local day, hour) so a retried cron
--    tick or an overlapping run can never double-notify.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rhythm_nudge_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  local_date date NOT NULL,
  hour integer NOT NULL CHECK (hour BETWEEN 0 AND 23),
  open_task_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date, hour)
);

ALTER TABLE public.rhythm_nudge_dispatches ENABLE ROW LEVEL SECURITY;

-- Readable by the owner; only the service role (which bypasses RLS) writes.
DROP POLICY IF EXISTS "Nudge dispatches viewable by owner" ON public.rhythm_nudge_dispatches;
CREATE POLICY "Nudge dispatches viewable by owner" ON public.rhythm_nudge_dispatches
  FOR SELECT USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rhythm_nudge_dispatches_user_date
  ON public.rhythm_nudge_dispatches(user_id, local_date);

-- ---------------------------------------------------------------------------
-- 3. Who is due right now?
--    Returns one row per user whose LOCAL clock is inside 06:00-18:00, who
--    still has unlogged rhythm tasks for their local day, and who has not been
--    notified for that hour slot yet.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_due_rhythm_nudges()
RETURNS TABLE (
  user_id uuid,
  local_date date,
  local_hour integer,
  open_titles text[]
) AS $$
  WITH local_now AS (
    SELECT
      p.id AS uid,
      (now() AT TIME ZONE public.safe_timezone(p.timezone)) AS local_ts
    FROM public.profiles p
    WHERE COALESCE(p.rhythm_nudges_enabled, true)
  ),
  slot AS (
    SELECT
      uid,
      local_ts::date AS ldate,
      EXTRACT(hour FROM local_ts)::int AS lhour
    FROM local_now
    WHERE EXTRACT(hour FROM local_ts)::int BETWEEN 6 AND 18
  ),
  open_tasks AS (
    SELECT s.uid, s.ldate, s.lhour, t.title
    FROM slot s
    JOIN public.weekly_rhythm_templates tpl ON tpl.user_id = s.uid
    JOIN public.weekly_rhythm_tasks t
      ON t.template_id = tpl.id
     AND t.day_of_week = EXTRACT(dow FROM s.ldate)::int
    WHERE NOT EXISTS (
      SELECT 1 FROM public.weekly_rhythm_logs l
      WHERE l.user_id = s.uid
        AND l.rhythm_task_id = t.id
        AND l.completed_at = s.ldate
    )
  )
  SELECT o.uid, o.ldate, o.lhour, array_agg(o.title ORDER BY o.title)
  FROM open_tasks o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rhythm_nudge_dispatches d
    WHERE d.user_id = o.uid
      AND d.local_date = o.ldate
      AND d.hour = o.lhour
  )
  GROUP BY o.uid, o.ldate, o.lhour;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Only the service role should call this (it returns other users' rows).
REVOKE ALL ON FUNCTION public.get_due_rhythm_nudges() FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Best-effort hourly schedule.
--    Web push requires VAPID signing, which SQL can't do, so this calls the
--    `rhythm-nudges` edge function via pg_net. It is wrapped so the migration
--    still applies where pg_cron/pg_net are unavailable or the GUCs are unset —
--    in that case schedule the function from the Supabase dashboard instead.
--    Configure once with:
--      ALTER DATABASE postgres SET app.settings.edge_base_url = 'https://<ref>.supabase.co/functions/v1';
--      ALTER DATABASE postgres SET app.settings.cron_secret   = '<CRON_SECRET>';
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  base_url text := current_setting('app.settings.edge_base_url', true);
  secret text := current_setting('app.settings.cron_secret', true);
BEGIN
  IF base_url IS NULL OR secret IS NULL THEN
    RAISE NOTICE 'rhythm-nudges cron not scheduled: app.settings.edge_base_url / app.settings.cron_secret not set';
    RETURN;
  END IF;

  PERFORM cron.unschedule('rhythm-nudges-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
DECLARE
  base_url text := current_setting('app.settings.edge_base_url', true);
  secret text := current_setting('app.settings.cron_secret', true);
BEGIN
  IF base_url IS NULL OR secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'rhythm-nudges-hourly',
    '0 * * * *',
    format(
      $cmd$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{}'::jsonb
      );$cmd$,
      base_url || '/rhythm-nudges',
      'Bearer ' || secret
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'rhythm-nudges cron not scheduled (pg_cron/pg_net unavailable): %', SQLERRM;
END $$;
