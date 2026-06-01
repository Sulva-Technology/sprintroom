-- Allow token-backed invite links to resolve without exposing the invites table.

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invites_token_unique
  ON public.workspace_invites (token)
  WHERE token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_workspace_invite_by_token(invite_token_input text)
RETURNS TABLE (
  invite_id uuid,
  workspace_id uuid,
  workspace_name text,
  workspace_initial text,
  email text,
  role text,
  status text,
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
    p.full_name AS inviter_name,
    p.email AS inviter_email,
    wi.created_at,
    wi.responded_at
  FROM public.workspace_invites wi
  JOIN public.workspaces w ON w.id = wi.workspace_id
  LEFT JOIN public.profiles p ON p.id = wi.inviter_id
  WHERE wi.token = invite_token_input
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_invite_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_invite_by_token(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
