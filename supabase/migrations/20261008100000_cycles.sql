-- Cycles: timeboxed commitments per workspace, with automatic rollover.

CREATE TABLE IF NOT EXISTS public.cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  completed_at timestamptz,
  completed_count integer,
  carried_over_count integer,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cycles_dates_check CHECK (ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS cycles_workspace_start_idx ON public.cycles (workspace_id, starts_on);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.cycles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS carry_over_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS tasks_cycle_id_idx ON public.tasks (cycle_id);

ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cycles viewable by members" ON public.cycles;
CREATE POLICY "Cycles viewable by members" ON public.cycles
  FOR SELECT USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Cycles creatable by editors" ON public.cycles;
CREATE POLICY "Cycles creatable by editors" ON public.cycles
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Cycles updatable by editors" ON public.cycles;
CREATE POLICY "Cycles updatable by editors" ON public.cycles
  FOR UPDATE USING (is_workspace_editor(workspace_id)) WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Cycles deletable by admins" ON public.cycles;
CREATE POLICY "Cycles deletable by admins" ON public.cycles
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- A task may only join a cycle of its own workspace; the FK alone can't say that.
-- workspace_id may still be NULL on INSERT if this fires before
-- set_task_workspace_id, so fall back to the project's workspace.
CREATE OR REPLACE FUNCTION public.enforce_task_cycle_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  task_ws uuid := COALESCE(NEW.workspace_id, (SELECT p.workspace_id FROM public.projects p WHERE p.id = NEW.project_id));
BEGIN
  IF NEW.cycle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cycles c WHERE c.id = NEW.cycle_id AND c.workspace_id = task_ws
  ) THEN
    RAISE EXCEPTION 'Cycle belongs to a different workspace';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_enforce_task_cycle_workspace ON public.tasks;
CREATE TRIGGER trigger_enforce_task_cycle_workspace
  BEFORE INSERT OR UPDATE OF cycle_id, workspace_id, project_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_cycle_workspace();

-- Close every ended cycle: freeze its score, move unfinished tasks to the next
-- cycle (created if missing; starts today if the workspace was idle).
CREATE OR REPLACE FUNCTION public.rollover_ended_cycles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c record;
  next_id uuid;
  next_start date;
  done_count integer;
  moved_count integer;
  closed integer := 0;
BEGIN
  FOR c IN
    SELECT * FROM public.cycles
    WHERE completed_at IS NULL AND ends_on < current_date
    ORDER BY ends_on
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT id INTO next_id FROM public.cycles
    WHERE workspace_id = c.workspace_id AND starts_on > c.ends_on AND completed_at IS NULL
    ORDER BY starts_on LIMIT 1;

    IF next_id IS NULL THEN
      next_start := GREATEST(c.ends_on + 1, current_date);
      INSERT INTO public.cycles (workspace_id, name, starts_on, ends_on, created_by)
      VALUES (
        c.workspace_id,
        'Cycle · ' || to_char(next_start, 'Mon FMDD'),
        next_start,
        next_start + (c.ends_on - c.starts_on),
        c.created_by
      )
      RETURNING id INTO next_id;
    END IF;

    SELECT count(*) INTO done_count FROM public.tasks WHERE cycle_id = c.id AND status = 'done';

    UPDATE public.tasks
    SET cycle_id = next_id, carry_over_count = carry_over_count + 1
    WHERE cycle_id = c.id AND status <> 'done';
    GET DIAGNOSTICS moved_count = ROW_COUNT;

    UPDATE public.cycles
    SET completed_at = now(), completed_count = done_count, carried_over_count = moved_count
    WHERE id = c.id;

    closed := closed + 1;
  END LOOP;
  RETURN closed;
END;
$$;
REVOKE ALL ON FUNCTION public.rollover_ended_cycles() FROM public, anon, authenticated;

-- Best-effort hourly schedule (same pattern as 20260722110000).
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('rollover-ended-cycles');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  PERFORM cron.schedule('rollover-ended-cycles', '5 * * * *', $cron$SELECT public.rollover_ended_cycles();$cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (%). rollover_ended_cycles() was installed; schedule it with your own cron.', SQLERRM;
END;
$$;
