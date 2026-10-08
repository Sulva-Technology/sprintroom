-- In-app inbox. Rows are written ONLY by the triggers below (SECURITY DEFINER);
-- clients can read, mark read and delete their own, never insert.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('assigned', 'comment', 'blocked')),
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications readable by recipient" ON public.notifications;
CREATE POLICY "Notifications readable by recipient" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Notifications updatable by recipient" ON public.notifications;
CREATE POLICY "Notifications updatable by recipient" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Notifications deletable by recipient" ON public.notifications;
CREATE POLICY "Notifications deletable by recipient" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Insert one notification per distinct recipient, skipping the actor and anyone
-- who is no longer a member of the workspace.
CREATE OR REPLACE FUNCTION public.notify_recipients(
  recipients uuid[], ws uuid, task uuid, actor uuid, kind text, detail text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.notifications (user_id, workspace_id, task_id, actor_id, type, body)
  SELECT DISTINCT r, ws, task, actor, kind, left(detail, 200)
  FROM unnest(recipients) AS r
  WHERE r IS NOT NULL
    AND r IS DISTINCT FROM actor
    AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = ws AND m.user_id = r);
$$;
REVOKE ALL ON FUNCTION public.notify_recipients(uuid[], uuid, uuid, uuid, text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF NEW.owner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    PERFORM public.notify_recipients(ARRAY[NEW.owner_id], NEW.workspace_id, NEW.id, actor, 'assigned', NEW.title);
  END IF;

  IF NEW.status = 'blocked'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'blocked') THEN
    PERFORM public.notify_recipients(ARRAY[NEW.owner_id, NEW.created_by], NEW.workspace_id, NEW.id, actor, 'blocked', NEW.blocked_reason);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_task_changes ON public.tasks;
CREATE TRIGGER trigger_notify_task_changes
  AFTER INSERT OR UPDATE OF owner_id, status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_changes();

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t record;
BEGIN
  SELECT id, owner_id, created_by, workspace_id INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF FOUND THEN
    PERFORM public.notify_recipients(ARRAY[t.owner_id, t.created_by], t.workspace_id, t.id, NEW.user_id, 'comment', NEW.content);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_task_comment ON public.task_comments;
CREATE TRIGGER trigger_notify_task_comment
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

-- Live inbox: publish to Realtime (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
