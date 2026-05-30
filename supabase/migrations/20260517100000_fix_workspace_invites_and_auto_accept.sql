-- ======================================================================================
-- 20260517100000_fix_workspace_invites_and_auto_accept.sql
--
-- 1. Correctly structure workspace_invites ensuring the 'email' column and constraints exist.
-- 2. Add an automatic trigger to add new users to workspaces if they had pending invites.
-- ======================================================================================

-- Ensure the workspace_invites table is structured correctly with the email column
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  inviter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' NOT NULL,
  status text DEFAULT 'pending' NOT NULL, -- pending, accepted, declined
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone,
  UNIQUE(workspace_id, email)
);

-- Force add the email column if it is missing due to cache or table existing previously
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='workspace_invites' AND column_name='email'
  ) THEN
    ALTER TABLE public.workspace_invites ADD COLUMN email text NOT NULL;
    ALTER TABLE public.workspace_invites ADD CONSTRAINT workspace_invites_workspace_id_email_key UNIQUE (workspace_id, email);
  END IF;
END $$;

ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' NOT NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS responded_at timestamp with time zone;

-- Enable RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies to be absolutely certain
DROP POLICY IF EXISTS "Invites viewable by members" ON public.workspace_invites;
DROP POLICY IF EXISTS "Invites creatable by admins" ON public.workspace_invites;
DROP POLICY IF EXISTS "Invites manageable by admins" ON public.workspace_invites;
DROP POLICY IF EXISTS "Invites deletable by admins" ON public.workspace_invites;

CREATE POLICY "Invites viewable by members" ON public.workspace_invites FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Invites creatable by admins" ON public.workspace_invites FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "Invites manageable by admins" ON public.workspace_invites FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "Invites deletable by admins" ON public.workspace_invites FOR DELETE USING (is_workspace_admin(workspace_id));

-- Trigger function: Automatically accept invites when a new user inserts a profile
CREATE OR REPLACE FUNCTION public.handle_accept_invites_on_signup()
RETURNS trigger AS $$
DECLARE
    invite_record record;
BEGIN
    -- Loop through all pending invites for this email
    FOR invite_record IN 
        SELECT workspace_id, role, id 
        FROM public.workspace_invites 
        WHERE LOWER(email) = LOWER(NEW.email) AND status = 'pending'
    LOOP
        -- Insert into workspace_members
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (invite_record.workspace_id, NEW.id, invite_record.role)
        ON CONFLICT (workspace_id, user_id) DO NOTHING;

        -- Mark the invite as accepted
        UPDATE public.workspace_invites 
        SET status = 'accepted',
            responded_at = now()
        WHERE id = invite_record.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_profile_created_accept_invites ON public.profiles;
CREATE TRIGGER on_profile_created_accept_invites
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_accept_invites_on_signup();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
