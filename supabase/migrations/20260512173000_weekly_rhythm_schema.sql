
-- Add type to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS type text DEFAULT 'team' NOT NULL;

-- Update handle_new_user to create Personal Workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  personal_workspace_id uuid;
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Create Personal Workspace
  -- Note: Setting created_by allows the 'handle_new_workspace' trigger 
  -- to automatically add the user as an owner.
  INSERT INTO public.workspaces (name, type, created_by)
  VALUES ('Personal Workspace', 'personal', new.id)
  RETURNING id INTO personal_workspace_id;

  -- 3. Create a default "My Rhythms" project in the personal workspace
  INSERT INTO public.projects (workspace_id, name, description)
  VALUES (personal_workspace_id, 'My Rhythms', 'Your personal habits and weekly routines.');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Weekly Rhythms Tables
CREATE TABLE IF NOT EXISTS public.weekly_rhythm_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.weekly_rhythm_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.weekly_rhythm_templates(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    description text,
    day_of_week integer NOT NULL, -- 0-6 (Sun-Sat)
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE, 
    rhythm_task_id uuid REFERENCES public.weekly_rhythm_tasks(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'push', 'email', 'alarm'
    reminder_time time NOT NULL,
    is_enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.weekly_rhythm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_rhythm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rhythm templates" ON public.weekly_rhythm_templates
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage tasks of their own templates" ON public.weekly_rhythm_tasks
    FOR ALL USING (EXISTS (SELECT 1 FROM public.weekly_rhythm_templates t WHERE t.id = template_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can manage their own reminders" ON public.task_reminders
    FOR ALL USING (auth.uid() = user_id);
