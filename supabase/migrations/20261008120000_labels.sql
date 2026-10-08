-- Workspace labels and their task assignments.

CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  color text NOT NULL DEFAULT 'slate',
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS labels_workspace_name_idx ON public.labels (workspace_id, lower(name));

CREATE TABLE IF NOT EXISTS public.task_labels (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);
CREATE INDEX IF NOT EXISTS task_labels_label_idx ON public.task_labels (label_id);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Labels viewable by members" ON public.labels;
CREATE POLICY "Labels viewable by members" ON public.labels
  FOR SELECT USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Labels creatable by editors" ON public.labels;
CREATE POLICY "Labels creatable by editors" ON public.labels
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Labels updatable by editors" ON public.labels;
CREATE POLICY "Labels updatable by editors" ON public.labels
  FOR UPDATE USING (is_workspace_editor(workspace_id)) WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Labels deletable by admins" ON public.labels;
CREATE POLICY "Labels deletable by admins" ON public.labels
  FOR DELETE USING (is_workspace_admin(workspace_id));

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Task labels viewable by members" ON public.task_labels;
CREATE POLICY "Task labels viewable by members" ON public.task_labels
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
  ));
-- The label must belong to the task's own workspace.
DROP POLICY IF EXISTS "Task labels addable by editors" ON public.task_labels;
CREATE POLICY "Task labels addable by editors" ON public.task_labels
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.labels l ON l.id = label_id
    WHERE t.id = task_id AND l.workspace_id = t.workspace_id AND is_workspace_editor(t.workspace_id)
  ));
DROP POLICY IF EXISTS "Task labels removable by editors" ON public.task_labels;
CREATE POLICY "Task labels removable by editors" ON public.task_labels
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_editor(t.workspace_id)
  ));
