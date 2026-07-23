-- Role-based permissions.
--
-- Roles (highest to lowest): owner > admin > member > viewer
--   owner  - full control, manages roles, deletes the workspace
--   admin  - manages members/invites, edits & deletes projects and any task
--   member - creates and edits content (tasks, comments, focus sessions)
--   viewer - read-only
--
-- Fixes a critical privilege-escalation hole: migration 0004 created
--   "Members insertable by system/authenticated on workspace create or invite"
--   ON workspace_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)
-- and migration 0006 never dropped it. That allowed ANY authenticated user to
-- insert themselves into ANY workspace with role 'owner' — a full takeover of
-- every workspace in the system. All legitimate insert paths
-- (handle_new_workspace, accept_workspace_invite) are SECURITY DEFINER and so
-- bypass RLS, meaning this can be tightened safely.

-- ---------------------------------------------------------------------------
-- 1. Constrain role values (previously free text)
-- ---------------------------------------------------------------------------
UPDATE public.workspace_members
  SET role = 'member'
  WHERE role IS NULL OR role NOT IN ('owner', 'admin', 'member', 'viewer');

ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

UPDATE public.workspace_invites
  SET role = 'member'
  WHERE role IS NULL OR role NOT IN ('owner', 'admin', 'member', 'viewer');

ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_role_check;
ALTER TABLE public.workspace_invites
  ADD CONSTRAINT workspace_invites_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

-- ---------------------------------------------------------------------------
-- 2. "Editor" helper: anyone who may write content (i.e. not a viewer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_editor(uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = $1
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. CRITICAL: close the workspace_members self-insert hole
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members insertable by system/authenticated on workspace create or invite" ON public.workspace_members;
DROP POLICY IF EXISTS "Members insertable by workspace admins" ON public.workspace_members;
CREATE POLICY "Members insertable by workspace admins" ON public.workspace_members
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- 4. Content policies — viewers become read-only
-- ---------------------------------------------------------------------------

-- Projects: editors create; admins or the creator edit.
DROP POLICY IF EXISTS "Projects creatable by members" ON public.projects;
DROP POLICY IF EXISTS "Projects creatable by editors" ON public.projects;
CREATE POLICY "Projects creatable by editors" ON public.projects
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));

DROP POLICY IF EXISTS "Projects updatable by members" ON public.projects;
DROP POLICY IF EXISTS "Projects updatable by admins or creator" ON public.projects;
CREATE POLICY "Projects updatable by admins or creator" ON public.projects
  FOR UPDATE USING (is_workspace_admin(workspace_id) OR created_by = auth.uid());

-- Tasks: editors create and edit (collaborative board); delete stays admin/creator.
DROP POLICY IF EXISTS "Tasks creatable by members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks creatable by editors" ON public.tasks;
CREATE POLICY "Tasks creatable by editors" ON public.tasks
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));

DROP POLICY IF EXISTS "Tasks updatable by members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks updatable by editors" ON public.tasks;
CREATE POLICY "Tasks updatable by editors" ON public.tasks
  FOR UPDATE USING (is_workspace_editor(workspace_id));

-- Checklists
DROP POLICY IF EXISTS "Checklists creatable by members" ON public.task_checklist_items;
DROP POLICY IF EXISTS "Checklists creatable by editors" ON public.task_checklist_items;
CREATE POLICY "Checklists creatable by editors" ON public.task_checklist_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_editor(t.workspace_id))
  );

DROP POLICY IF EXISTS "Checklists updatable by members" ON public.task_checklist_items;
DROP POLICY IF EXISTS "Checklists updatable by editors" ON public.task_checklist_items;
CREATE POLICY "Checklists updatable by editors" ON public.task_checklist_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_editor(t.workspace_id))
  );

DROP POLICY IF EXISTS "Checklists deletable by members" ON public.task_checklist_items;
DROP POLICY IF EXISTS "Checklists deletable by editors" ON public.task_checklist_items;
CREATE POLICY "Checklists deletable by editors" ON public.task_checklist_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_editor(t.workspace_id))
  );

-- Comments: editors only, and authorship is pinned to the caller.
DROP POLICY IF EXISTS "Comments creatable by members" ON public.task_comments;
DROP POLICY IF EXISTS "Comments creatable by editors" ON public.task_comments;
CREATE POLICY "Comments creatable by editors" ON public.task_comments
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id) AND user_id = auth.uid());

-- Focus sessions
DROP POLICY IF EXISTS "Sessions creatable by members" ON public.focus_sessions;
DROP POLICY IF EXISTS "Sessions creatable by editors" ON public.focus_sessions;
CREATE POLICY "Sessions creatable by editors" ON public.focus_sessions
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id) AND user_id = auth.uid());

-- Task activity
DROP POLICY IF EXISTS "Activity insertable by members or system" ON public.task_activity;
DROP POLICY IF EXISTS "Activity insertable by editors" ON public.task_activity;
CREATE POLICY "Activity insertable by editors" ON public.task_activity
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));

-- Financial entries
DROP POLICY IF EXISTS "Financial entries insertable by members" ON public.financial_entries;
DROP POLICY IF EXISTS "Financial entries insertable by editors" ON public.financial_entries;
CREATE POLICY "Financial entries insertable by editors" ON public.financial_entries
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id) AND created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Guard against role escalation and orphaned workspaces
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_workspace_role_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_owner boolean;
  owner_exists boolean;
  remaining_owners integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Never let the last owner be removed.
    IF OLD.role = 'owner' THEN
      SELECT count(*) INTO remaining_owners
      FROM public.workspace_members
      WHERE workspace_id = OLD.workspace_id AND role = 'owner' AND id <> OLD.id;

      IF remaining_owners = 0 THEN
        RAISE EXCEPTION 'A workspace must keep at least one owner';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  actor_is_owner := public.is_workspace_owner(NEW.workspace_id);

  -- Only an existing owner may grant the owner role. The very first owner
  -- (created with the workspace) is allowed through as a bootstrap.
  IF NEW.role = 'owner' AND COALESCE(OLD.role, '') <> 'owner' AND NOT actor_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = NEW.workspace_id AND role = 'owner'
    ) INTO owner_exists;

    IF owner_exists THEN
      RAISE EXCEPTION 'Only a workspace owner can grant the owner role';
    END IF;
  END IF;

  -- Demoting an owner requires being an owner, and must leave one behind.
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    IF NOT actor_is_owner THEN
      RAISE EXCEPTION 'Only a workspace owner can change another owner''s role';
    END IF;

    SELECT count(*) INTO remaining_owners
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id AND role = 'owner' AND id <> OLD.id;

    IF remaining_owners = 0 THEN
      RAISE EXCEPTION 'A workspace must keep at least one owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_workspace_role_rules ON public.workspace_members;
CREATE TRIGGER trigger_enforce_workspace_role_rules
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_role_rules();
