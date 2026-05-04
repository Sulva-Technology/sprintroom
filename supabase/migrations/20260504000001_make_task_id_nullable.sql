-- Make task_id nullable in focus_sessions to support instant focus sessions
ALTER TABLE public.focus_sessions ALTER COLUMN task_id DROP NOT NULL;
