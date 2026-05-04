-- Create workspace_invites table
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  inviter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' NOT NULL,
  status text DEFAULT 'pending' NOT NULL, -- pending, accepted, declined
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, email)
);

-- Enable RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Note: Policies were already defined in 0006_workspace_automation.sql
-- We just need the table to exist.
