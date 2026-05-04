

-- ======================================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================================

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  is_completed boolean default false not null,
  created_at timestamp with time zone default now() not null,
  position integer default 0
);

INSERT INTO public.task_checklist_items (id, task_id, title, is_completed, created_at, position)
SELECT id, task_id, title, is_completed, created_at, position
FROM public.task_checklists
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

UPDATE public.tasks t
SET workspace_id = p.workspace_id
FROM public.projects p
WHERE t.project_id = p.id
  AND t.workspace_id IS NULL;

ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

UPDATE public.task_comments c
SET workspace_id = t.workspace_id,
    project_id = t.project_id
FROM public.tasks t
WHERE c.task_id = t.id
  AND (c.workspace_id IS NULL OR c.project_id IS NULL);

ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

UPDATE public.focus_sessions s
SET workspace_id = t.workspace_id,
    project_id = t.project_id
FROM public.tasks t
WHERE s.task_id = t.id
  AND (s.workspace_id IS NULL OR s.project_id IS NULL);

CREATE TABLE IF NOT EXISTS public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  body text,
  created_at timestamp with time zone default now() not null
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can read profiles. Users can update their own profile.
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces: Members can read.
CREATE POLICY "Workspaces viewable by members" ON public.workspaces FOR SELECT USING (is_workspace_member(id));
CREATE POLICY "Workspaces insertable by authenticated users" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Workspaces updatable by admins or owners" ON public.workspaces FOR UPDATE USING (is_workspace_admin(id));
CREATE POLICY "Workspaces deletable by owners" ON public.workspaces FOR DELETE USING (is_workspace_owner(id));

-- Workspace Members: Members can see other members.
CREATE POLICY "Members viewable by members" ON public.workspace_members FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Members insertable by system/authenticated on workspace create or invite" ON public.workspace_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members modifiable by admins/owners" ON public.workspace_members FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "Members removable by admins/owner or self" ON public.workspace_members FOR DELETE USING (is_workspace_admin(workspace_id) OR user_id = auth.uid());

-- Workspace Invites
CREATE POLICY "Invites viewable by members" ON public.workspace_invites FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Invites creatable by admins" ON public.workspace_invites FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "Invites manageable by admins" ON public.workspace_invites FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "Invites deletable by admins" ON public.workspace_invites FOR DELETE USING (is_workspace_admin(workspace_id));

-- Projects
CREATE POLICY "Projects viewable by members" ON public.projects FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Projects creatable by members" ON public.projects FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Projects updatable by members" ON public.projects FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "Projects deletable by admins/owners" ON public.projects FOR DELETE USING (is_workspace_admin(workspace_id));

-- Tasks
CREATE POLICY "Tasks viewable by members" ON public.tasks FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Tasks creatable by members" ON public.tasks FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Tasks updatable by members" ON public.tasks FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "Tasks deletable by admins/owners/creator" ON public.tasks FOR DELETE USING (
  is_workspace_admin(workspace_id) OR created_by = auth.uid()
);

-- Task Checklist Items
CREATE POLICY "Checklists viewable by members" ON public.task_checklist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id))
);
CREATE POLICY "Checklists creatable by members" ON public.task_checklist_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id))
);
CREATE POLICY "Checklists updatable by members" ON public.task_checklist_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id))
);
CREATE POLICY "Checklists deletable by members" ON public.task_checklist_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id))
);

-- Task Comments
CREATE POLICY "Comments viewable by members" ON public.task_comments FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Comments creatable by members" ON public.task_comments FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Comments updatable by creator" ON public.task_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Comments deletable by creator or admin" ON public.task_comments FOR DELETE USING (
  user_id = auth.uid() OR is_workspace_admin(workspace_id)
);

-- Focus Sessions
CREATE POLICY "Sessions viewable by members" ON public.focus_sessions FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Sessions creatable by members" ON public.focus_sessions FOR INSERT WITH CHECK (
  is_workspace_member(workspace_id) AND user_id = auth.uid()
);
CREATE POLICY "Sessions updatable by owner" ON public.focus_sessions FOR UPDATE USING (user_id = auth.uid());

-- Task Activity
CREATE POLICY "Activity viewable by members" ON public.task_activity FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Activity insertable by members or system" ON public.task_activity FOR INSERT WITH CHECK (is_workspace_member(workspace_id));


-- ======================================================================================
-- 5. UPDATE AND LOGIC TRIGGERS
-- ======================================================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER set_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger function for Task State Changes (Blocked, Done)
CREATE OR REPLACE FUNCTION handle_task_status_changes() RETURNS trigger AS $$
BEGIN
  -- Handle 'blocked' status
  IF NEW.status = 'blocked' AND OLD.status <> 'blocked' THEN
    NEW.blocked_at = now();
  ELSIF NEW.status <> 'blocked' AND OLD.status = 'blocked' THEN
    NEW.blocked_reason = NULL;
    NEW.blocked_at = NULL;
  END IF;

  -- Handle 'done' status
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_task_status_changes ON public.tasks;
CREATE TRIGGER trigger_handle_task_status_changes 
  BEFORE UPDATE ON public.tasks 
  FOR EACH ROW EXECUTE FUNCTION handle_task_status_changes();

-- Trigger function for Focus Session completion -> increment completed_pomodoros
CREATE OR REPLACE FUNCTION process_focus_session_completion() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status <> 'completed')) THEN
    IF NEW.task_id IS NOT NULL THEN
      UPDATE public.tasks 
      SET completed_pomodoros = completed_pomodoros + 1
      WHERE id = NEW.task_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_process_focus_session_completion ON public.focus_sessions;
CREATE TRIGGER trigger_process_focus_session_completion
  AFTER INSERT OR UPDATE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION process_focus_session_completion();

-- Auth user signup trigger -> creates profile
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Anonymous User'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- In case there is already a trigger from previous migrations, drop it usually
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ======================================================================================
-- 6. INDEXES
-- ======================================================================================

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_workspace_id ON public.focus_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity(task_id);
