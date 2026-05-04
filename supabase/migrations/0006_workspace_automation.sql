-- ======================================================================================
-- 0006: Workspace Automation & Fix RLS Helper Functions
--
-- Strategy: Drop all policies that depend on the helper functions, drop the functions,
-- recreate them with positional params ($1) so CREATE OR REPLACE works in the future,
-- then recreate all policies.
-- ======================================================================================

-- 1. DROP ALL DEPENDENT POLICIES
DROP POLICY IF EXISTS "Workspaces viewable by members" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces updatable by admins or owners" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces deletable by owners" ON public.workspaces;

DROP POLICY IF EXISTS "Members viewable by members" ON public.workspace_members;
DROP POLICY IF EXISTS "Members modifiable by admins/owners" ON public.workspace_members;
DROP POLICY IF EXISTS "Members removable by admins/owner or self" ON public.workspace_members;

DROP POLICY IF EXISTS "Invites viewable by members" ON public.workspace_invites;
DROP POLICY IF EXISTS "Invites creatable by admins" ON public.workspace_invites;
DROP POLICY IF EXISTS "Invites manageable by admins" ON public.workspace_invites;
DROP POLICY IF EXISTS "Invites deletable by admins" ON public.workspace_invites;

DROP POLICY IF EXISTS "Projects viewable by members" ON public.projects;
DROP POLICY IF EXISTS "Projects creatable by members" ON public.projects;
DROP POLICY IF EXISTS "Projects updatable by members" ON public.projects;
DROP POLICY IF EXISTS "Projects deletable by admins/owners" ON public.projects;

DROP POLICY IF EXISTS "Tasks viewable by members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks creatable by members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks updatable by members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks deletable by admins/owners/creator" ON public.tasks;

DROP POLICY IF EXISTS "Checklists viewable by members" ON public.task_checklist_items;
DROP POLICY IF EXISTS "Checklists creatable by members" ON public.task_checklist_items;
DROP POLICY IF EXISTS "Checklists updatable by members" ON public.task_checklist_items;
DROP POLICY IF EXISTS "Checklists deletable by members" ON public.task_checklist_items;

DROP POLICY IF EXISTS "Comments viewable by members" ON public.task_comments;
DROP POLICY IF EXISTS "Comments creatable by members" ON public.task_comments;
DROP POLICY IF EXISTS "Comments updatable by creator" ON public.task_comments;
DROP POLICY IF EXISTS "Comments deletable by creator or admin" ON public.task_comments;

DROP POLICY IF EXISTS "Sessions viewable by members" ON public.focus_sessions;
DROP POLICY IF EXISTS "Sessions creatable by members" ON public.focus_sessions;
DROP POLICY IF EXISTS "Sessions updatable by owner" ON public.focus_sessions;

DROP POLICY IF EXISTS "Activity viewable by members" ON public.task_activity;
DROP POLICY IF EXISTS "Activity insertable by members or system" ON public.task_activity;

-- 2. DROP OLD HELPER FUNCTIONS
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid);
DROP FUNCTION IF EXISTS public.is_workspace_admin(uuid);
DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid);

-- 3. RECREATE HELPER FUNCTIONS (using positional params so future OR REPLACE works)
CREATE FUNCTION public.is_workspace_member(uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = $1 AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.is_workspace_admin(uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = $1 AND user_id = auth.uid() AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.is_workspace_owner(uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = $1 AND user_id = auth.uid() AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ADD created_by COLUMN TO WORKSPACES (for the creator-can-see-their-own policy)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- 5. RECREATE ALL RLS POLICIES

-- Workspaces
CREATE POLICY "Workspaces viewable by members" ON public.workspaces
  FOR SELECT USING (is_workspace_member(id) OR created_by = auth.uid());
CREATE POLICY "Workspaces updatable by admins or owners" ON public.workspaces
  FOR UPDATE USING (is_workspace_admin(id));
CREATE POLICY "Workspaces deletable by owners" ON public.workspaces
  FOR DELETE USING (is_workspace_owner(id));

-- Workspace Members
CREATE POLICY "Members viewable by members" ON public.workspace_members
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Members modifiable by admins/owners" ON public.workspace_members
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "Members removable by admins/owner or self" ON public.workspace_members
  FOR DELETE USING (is_workspace_admin(workspace_id) OR user_id = auth.uid());

-- Workspace Invites
CREATE POLICY "Invites viewable by members" ON public.workspace_invites
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Invites creatable by admins" ON public.workspace_invites
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "Invites manageable by admins" ON public.workspace_invites
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "Invites deletable by admins" ON public.workspace_invites
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- Projects
CREATE POLICY "Projects viewable by members" ON public.projects
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Projects creatable by members" ON public.projects
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Projects updatable by members" ON public.projects
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "Projects deletable by admins/owners" ON public.projects
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- Tasks
CREATE POLICY "Tasks viewable by members" ON public.tasks
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Tasks creatable by members" ON public.tasks
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Tasks updatable by members" ON public.tasks
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "Tasks deletable by admins/owners/creator" ON public.tasks
  FOR DELETE USING (is_workspace_admin(workspace_id) OR created_by = auth.uid());

-- Task Checklist Items
CREATE POLICY "Checklists viewable by members" ON public.task_checklist_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id)));
CREATE POLICY "Checklists creatable by members" ON public.task_checklist_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id)));
CREATE POLICY "Checklists updatable by members" ON public.task_checklist_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id)));
CREATE POLICY "Checklists deletable by members" ON public.task_checklist_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id)));

-- Task Comments
CREATE POLICY "Comments viewable by members" ON public.task_comments
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Comments creatable by members" ON public.task_comments
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Comments updatable by creator" ON public.task_comments
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Comments deletable by creator or admin" ON public.task_comments
  FOR DELETE USING (user_id = auth.uid() OR is_workspace_admin(workspace_id));

-- Focus Sessions
CREATE POLICY "Sessions viewable by members" ON public.focus_sessions
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Sessions creatable by members" ON public.focus_sessions
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "Sessions updatable by owner" ON public.focus_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- Task Activity
CREATE POLICY "Activity viewable by members" ON public.task_activity
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Activity insertable by members or system" ON public.task_activity
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

-- 6. WORKSPACE CREATION TRIGGER (auto-add creator as owner)
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();
