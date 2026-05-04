-- Create web_push_subscriptions table
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint text NOT NULL,
    keys_p256dh text NOT NULL,
    keys_auth text NOT NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
    ON public.web_push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id);

-- Create focus_schedules table
CREATE TABLE IF NOT EXISTS public.focus_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    start_time timestamptz NOT NULL,
    duration_minutes integer DEFAULT 25,
    status text DEFAULT 'pending', -- pending, warning_sent, started, cancelled
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.focus_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own focus schedules"
    ON public.focus_schedules
    FOR ALL
    USING (auth.uid() = user_id);

-- Ensure pg_net is available for edge function calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: The cron job creation (using pg_cron) should ideally be executed
-- after the Edge Function is deployed and the environment variables for URL/Keys
-- are available. A sample script is below:

/*
SELECT cron.schedule(
  'process-pomodoro-schedules',
  '* * * * *',
  $$
    SELECT net.http_post(
      url:='https://[PROJECT-REF].supabase.co/functions/v1/process-schedules',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
      ),
      body:='{}'::jsonb
    )
  $$
);
*/
