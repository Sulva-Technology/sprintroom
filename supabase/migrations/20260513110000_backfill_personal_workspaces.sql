
-- Backfill script for existing users to have a Personal Workspace
DO $$
DECLARE
    user_record RECORD;
    personal_workspace_id uuid;
BEGIN
    FOR user_record IN SELECT id FROM public.profiles LOOP
        -- Check if user already has a personal workspace
        IF NOT EXISTS (
            SELECT 1 
            FROM public.workspaces w
            JOIN public.workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = user_record.id AND w.type = 'personal'
        ) THEN
            -- 1. Create Personal Workspace
            -- Note: Setting created_by allows the 'handle_new_workspace' trigger 
            -- to automatically add the user as an owner.
            INSERT INTO public.workspaces (name, type, created_by)
            VALUES ('Personal Workspace', 'personal', user_record.id)
            RETURNING id INTO personal_workspace_id;

            -- 2. Create default "My Rhythms" project
            INSERT INTO public.projects (workspace_id, name, description)
            VALUES (personal_workspace_id, 'My Rhythms', 'Your personal habits and weekly routines.');
        END IF;
    END LOOP;
END;
$$;
