-- Let invited users view and respond to workspace invitations for their own email.

ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS inviter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' NOT NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS responded_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_invites_workspace_id_email_key'
      AND conrelid = 'public.workspace_invites'::regclass
  ) THEN
    ALTER TABLE public.workspace_invites
      ADD CONSTRAINT workspace_invites_workspace_id_email_key UNIQUE (workspace_id, email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_status
  ON public.workspace_invites (lower(email), status);

DROP POLICY IF EXISTS "Invites viewable by invitee" ON public.workspace_invites;
CREATE POLICY "Invites viewable by invitee" ON public.workspace_invites
  FOR SELECT USING (lower(email) = lower(auth.email()));

CREATE OR REPLACE FUNCTION public.get_my_workspace_invites()
RETURNS TABLE (
  invite_id uuid,
  workspace_id uuid,
  workspace_name text,
  workspace_initial text,
  email text,
  role text,
  status text,
  inviter_id uuid,
  inviter_name text,
  inviter_email text,
  created_at timestamp with time zone,
  responded_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wi.id AS invite_id,
    wi.workspace_id,
    w.name AS workspace_name,
    w.initial AS workspace_initial,
    wi.email,
    wi.role,
    wi.status,
    wi.inviter_id,
    p.full_name AS inviter_name,
    p.email AS inviter_email,
    wi.created_at,
    wi.responded_at
  FROM public.workspace_invites wi
  JOIN public.workspaces w ON w.id = wi.workspace_id
  LEFT JOIN public.profiles p ON p.id = wi.inviter_id
  WHERE auth.uid() IS NOT NULL
    AND lower(wi.email) = lower(auth.email())
  ORDER BY
    CASE WHEN wi.status = 'pending' THEN 0 ELSE 1 END,
    wi.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(invite_id_input uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invite.';
  END IF;

  SELECT *
  INTO invite_record
  FROM public.workspace_invites
  WHERE id = invite_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found.';
  END IF;

  IF lower(invite_record.email) <> lower(auth.email()) THEN
    RAISE EXCEPTION 'This invite belongs to a different email address.';
  END IF;

  IF invite_record.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite has already been responded to.';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (invite_record.workspace_id, auth.uid(), invite_record.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites
  SET status = 'accepted',
      responded_at = now()
  WHERE id = invite_record.id;

  RETURN invite_record.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_workspace_invite(invite_id_input uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to decline an invite.';
  END IF;

  SELECT *
  INTO invite_record
  FROM public.workspace_invites
  WHERE id = invite_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found.';
  END IF;

  IF lower(invite_record.email) <> lower(auth.email()) THEN
    RAISE EXCEPTION 'This invite belongs to a different email address.';
  END IF;

  IF invite_record.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite has already been responded to.';
  END IF;

  UPDATE public.workspace_invites
  SET status = 'declined',
      responded_at = now()
  WHERE id = invite_record.id;

  RETURN invite_record.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_workspace_invite(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
