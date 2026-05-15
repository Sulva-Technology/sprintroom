-- ======================================================================================
-- 20260515000001_onboarding_workspace.sql
--
-- Strategy: Automatically create a "Personal Workspace" and a default project for a 
-- new user when their profile is created. This ensures the dashboard is never empty.
-- ======================================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS trigger AS $$
DECLARE
    new_workspace_id uuid;
BEGIN
    -- 1. Create Personal Workspace
    -- Note: Setting created_by allows the 'handle_new_workspace' trigger 
    -- to automatically add the user as an owner.
    INSERT INTO public.workspaces (name, type, created_by)
    VALUES ('Personal Workspace', 'personal', NEW.id)
    RETURNING id INTO new_workspace_id;

    -- 2. Create default "My Rhythms" project
    INSERT INTO public.projects (workspace_id, name, description)
    VALUES (new_workspace_id, 'My Rhythms', 'Your personal habits and weekly routines.');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_onboarding ON public.profiles;
CREATE TRIGGER on_profile_created_onboarding
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_onboarding();
