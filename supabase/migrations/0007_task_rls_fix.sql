-- Fix Task RLS by ensuring workspace_id is populated from project
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- Trigger to automatically set workspace_id on task insert
CREATE OR REPLACE FUNCTION public.set_task_workspace_id()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_task_workspace_id ON public.tasks;
CREATE TRIGGER trigger_set_task_workspace_id
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_task_workspace_id();
