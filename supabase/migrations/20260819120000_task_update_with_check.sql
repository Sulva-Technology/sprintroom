-- Tenant-boundary hardening for public.tasks UPDATE.
--
-- Two gaps, both reachable by an authenticated member of workspace A who has no
-- membership in workspace B:
--
--   1. "Tasks updatable by editors" declared only USING. Postgres reuses USING
--      as the row check when WITH CHECK is absent, which happens to block a
--      relocation into a workspace the caller is not an editor of — but that is
--      an implicit side effect, not a stated rule. Declare it explicitly so the
--      guarantee survives any future edit to the USING clause.
--
--   2. Nothing tied tasks.project_id to tasks.workspace_id. set_task_workspace_id
--      fired BEFORE INSERT only, so an UPDATE could re-parent an A task onto a B
--      project and leave the two columns permanently disagreeing — a row inside
--      B's project board carrying A's tenancy. Recompute workspace_id whenever
--      project_id changes, so such an attempt now moves the row's tenancy too
--      and is then rejected by the WITH CHECK above.

-- ---------------------------------------------------------------------------
-- 1. Say the check out loud.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tasks updatable by editors" ON public.tasks;
CREATE POLICY "Tasks updatable by editors" ON public.tasks
  FOR UPDATE
  USING (is_workspace_editor(workspace_id))
  WITH CHECK (is_workspace_editor(workspace_id));

-- ---------------------------------------------------------------------------
-- 2. Keep workspace_id derived from project_id on UPDATE as well as INSERT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_task_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    SELECT p.workspace_id INTO NEW.workspace_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_task_workspace_id ON public.tasks;
CREATE TRIGGER trigger_sync_task_workspace_id
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_workspace_id();

-- ---------------------------------------------------------------------------
-- 3. Pin search_path on the existing INSERT-side trigger function too — it is
--    SECURITY DEFINER and resolves unqualified names through the caller's path
--    (Supabase linter: function_search_path_mutable).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_task_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Repair any row where the two columns already disagree.
UPDATE public.tasks t
SET workspace_id = p.workspace_id
FROM public.projects p
WHERE t.project_id = p.id
  AND t.workspace_id IS DISTINCT FROM p.workspace_id;

NOTIFY pgrst, 'reload schema';
