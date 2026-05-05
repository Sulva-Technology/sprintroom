-- Create task_recurrence_rules table
CREATE TYPE task_recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly');

CREATE TABLE IF NOT EXISTS public.task_recurrence_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE, -- Can be null if it's a personal task
    template_title text NOT NULL,
    template_description text,
    frequency task_recurrence_frequency NOT NULL,
    days_of_week integer[], -- For weekly (0=Sun, 1=Mon, etc)
    day_of_month integer,   -- For monthly
    target_status task_status DEFAULT 'backlog' NOT NULL,
    priority int DEFAULT 0,
    last_run_at timestamptz,
    next_run_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.task_recurrence_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurrence rules"
    ON public.task_recurrence_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recurrence rules"
    ON public.task_recurrence_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurrence rules"
    ON public.task_recurrence_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurrence rules"
    ON public.task_recurrence_rules FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_recurrence_rules;

/*
-- NOTE: The pg_cron job to invoke the edge function.
-- Should be executed after deploying edge function and setting secrets
SELECT cron.schedule(
  'process-recurring-tasks',
  '0 * * * *', -- Run every hour
  $$
    SELECT net.http_post(
      url:='https://[PROJECT-REF].supabase.co/functions/v1/process-recurring-tasks',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
      ),
      body:='{}'::jsonb
    )
  $$
);
*/