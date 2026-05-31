-- Keep Supabase Auth user creation from failing when invite emails create a new user.
-- Auth should only create the profile; profile-side onboarding handles workspaces idempotently.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Anonymous User'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  personal_workspace_id uuid;
BEGIN
  SELECT w.id
  INTO personal_workspace_id
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = NEW.id
    AND w.type = 'personal'
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF personal_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, type, created_by)
    VALUES ('Personal Workspace', 'personal', NEW.id)
    RETURNING id INTO personal_workspace_id;
  END IF;

  INSERT INTO public.projects (workspace_id, name, description, created_by)
  SELECT personal_workspace_id, 'My Rhythms', 'Your personal habits and weekly routines.', NEW.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.workspace_id = personal_workspace_id
      AND p.name = 'My Rhythms'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_onboarding ON public.profiles;
CREATE TRIGGER on_profile_created_onboarding
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_onboarding();

NOTIFY pgrst, 'reload schema';
