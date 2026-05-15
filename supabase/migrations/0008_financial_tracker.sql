-- ==============================================================================
-- 0008: Financial Tracker Module
--
-- Adds the financial_entries table and associated RLS policies to allow
-- tracking of income, expenses, and adjustments linked to workspaces,
-- projects, and tasks.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  focus_session_id uuid REFERENCES public.focus_sessions(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'adjustment')),
  amount numeric(12,2) NOT NULL,
  description text NOT NULL,
  visibility text NOT NULL DEFAULT 'personal' CHECK (visibility IN ('workspace', 'personal')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy
-- Admins can view all entries in the workspace.
-- Members can only view their own personal entries.
CREATE POLICY "Financial entries viewable by admins or creator" ON public.financial_entries
  FOR SELECT USING (
    is_workspace_admin(workspace_id) OR created_by = auth.uid()
  );

-- 2. INSERT Policy
-- Any workspace member can insert an entry, but they must set themselves as the creator.
CREATE POLICY "Financial entries insertable by members" ON public.financial_entries
  FOR INSERT WITH CHECK (
    is_workspace_member(workspace_id) AND created_by = auth.uid()
  );

-- 3. UPDATE Policy
-- Admins can update any entry in the workspace.
-- Members can only update their own entries.
CREATE POLICY "Financial entries updatable by admins or creator" ON public.financial_entries
  FOR UPDATE USING (
    is_workspace_admin(workspace_id) OR created_by = auth.uid()
  );

-- 4. DELETE Policy
-- Admins can delete any entry in the workspace.
-- Members can only delete their own entries.
CREATE POLICY "Financial entries deletable by admins or creator" ON public.financial_entries
  FOR DELETE USING (
    is_workspace_admin(workspace_id) OR created_by = auth.uid()
  );

-- Enable Realtime for financial entries
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_entries;
COMMIT;
