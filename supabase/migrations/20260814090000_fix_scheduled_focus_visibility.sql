-- Scheduled focus sessions were started but invisible to their own owner.
--
-- Chain of failure:
--   1. /dashboard/focus renders <ScheduleFocusDialog /> with no workspace, so
--      focus_schedules.workspace_id was NULL.
--   2. process_due_focus_schedules() (SECURITY DEFINER, bypasses RLS) copied
--      that NULL onto the new focus_sessions row.
--   3. The only SELECT policy was is_workspace_member(workspace_id), and
--      is_workspace_member(NULL) is false — so getActiveFocusSession() returned
--      nothing and the focus tube never appeared.
--   4. startFocusSession()'s "already active?" guard was equally blind, so the
--      next manual start hit unique_active_focus_session_per_user and errored.
--      The user was stuck with a session they could not see, finish or replace.
--
-- Fixed in three places: the policy admits the owner, the schedule processor
-- backfills a workspace, and the existing bad rows are repaired below.

-- ---------------------------------------------------------------------------
-- 1. A user can always read their own focus session, workspace or not.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sessions viewable by members" ON public.focus_sessions;
CREATE POLICY "Sessions viewable by members" ON public.focus_sessions
  FOR SELECT USING (is_workspace_member(workspace_id) OR user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Track which auto-starts have already been pushed, so the process-schedules
--    edge function can notify exactly once without re-reading session state.
-- ---------------------------------------------------------------------------
ALTER TABLE public.focus_schedules
  ADD COLUMN IF NOT EXISTS notified_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_focus_schedules_status_start_time
  ON public.focus_schedules(status, start_time);

-- ---------------------------------------------------------------------------
-- 3. Repair existing rows.
-- ---------------------------------------------------------------------------

-- Schedules: inherit the workspace from their task or project when known.
UPDATE public.focus_schedules fs
SET workspace_id = t.workspace_id
FROM public.tasks t
WHERE fs.task_id = t.id
  AND fs.workspace_id IS NULL
  AND t.workspace_id IS NOT NULL;

UPDATE public.focus_schedules fs
SET workspace_id = p.workspace_id
FROM public.projects p
WHERE fs.project_id = p.id
  AND fs.workspace_id IS NULL;

-- Otherwise fall back to the owner's oldest membership (the same stable
-- ordering pickActiveWorkspaceId uses on the client).
UPDATE public.focus_schedules fs
SET workspace_id = m.workspace_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, workspace_id
  FROM public.workspace_members
  ORDER BY user_id, created_at ASC
) m
WHERE fs.user_id = m.user_id
  AND fs.workspace_id IS NULL;

-- Sessions: same treatment.
UPDATE public.focus_sessions s
SET workspace_id = t.workspace_id
FROM public.tasks t
WHERE s.task_id = t.id
  AND s.workspace_id IS NULL
  AND t.workspace_id IS NOT NULL;

UPDATE public.focus_sessions s
SET workspace_id = p.workspace_id
FROM public.projects p
WHERE s.project_id = p.id
  AND s.workspace_id IS NULL;

UPDATE public.focus_sessions s
SET workspace_id = m.workspace_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, workspace_id
  FROM public.workspace_members
  ORDER BY user_id, created_at ASC
) m
WHERE s.user_id = m.user_id
  AND s.workspace_id IS NULL;

-- Any session still active but older than 3 hours is stranded (this is the
-- same threshold getActiveFocusSession() uses). Abandon it so the partial
-- unique index stops blocking new sessions.
UPDATE public.focus_sessions
SET status = 'abandoned',
    ended_at = COALESCE(ended_at, now())
WHERE status = 'active'
  AND started_at <= now() - interval '3 hours';

-- ---------------------------------------------------------------------------
-- 4. Never mint a workspace-less session again: resolve the workspace at
--    auto-start time from the task, the project, or the user's membership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_due_focus_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  WITH due AS (
    SELECT DISTINCT ON (fs.user_id)
      fs.id,
      fs.user_id,
      fs.task_id,
      fs.project_id,
      fs.duration_minutes,
      COALESCE(
        fs.workspace_id,
        (SELECT t.workspace_id FROM public.tasks t WHERE t.id = fs.task_id),
        (SELECT p.workspace_id FROM public.projects p WHERE p.id = fs.project_id),
        (SELECT wm.workspace_id
           FROM public.workspace_members wm
          WHERE wm.user_id = fs.user_id
          ORDER BY wm.created_at ASC
          LIMIT 1)
      ) AS resolved_workspace_id
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
    SELECT user_id, task_id, resolved_workspace_id, project_id, 'active',
           COALESCE(duration_minutes, 25), now()
    FROM due
    RETURNING id
  )
  UPDATE public.focus_schedules fs
  SET status = 'started',
      workspace_id = COALESCE(fs.workspace_id, due.resolved_workspace_id)
  FROM due
  WHERE fs.id = due.id;
END;
$$;

NOTIFY pgrst, 'reload schema';
