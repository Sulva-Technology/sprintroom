
-- Table to track spreadsheet-style completions for weekly rhythms
CREATE TABLE IF NOT EXISTS public.weekly_rhythm_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rhythm_task_id uuid REFERENCES public.weekly_rhythm_tasks(id) ON DELETE CASCADE NOT NULL,
    completed_at date NOT NULL, -- The specific date of completion
    proof_note text,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, rhythm_task_id, completed_at)
);

-- RLS
ALTER TABLE public.weekly_rhythm_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rhythm logs" ON public.weekly_rhythm_logs
    FOR ALL USING (auth.uid() = user_id);
