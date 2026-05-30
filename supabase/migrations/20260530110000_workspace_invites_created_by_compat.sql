-- Keep legacy workspace_invites.created_by schemas compatible with the current inviter_id flow.

ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.workspace_invites
SET created_by = inviter_id
WHERE created_by IS NULL
  AND inviter_id IS NOT NULL;

UPDATE public.workspace_invites
SET inviter_id = created_by
WHERE inviter_id IS NULL
  AND created_by IS NOT NULL;

ALTER TABLE public.workspace_invites
  ALTER COLUMN created_by SET DEFAULT auth.uid();

NOTIFY pgrst, 'reload schema';
