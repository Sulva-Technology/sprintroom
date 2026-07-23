-- Real pause support for focus (pomodoro) sessions.
-- paused_at: when the current pause began (NULL when running).
-- total_paused_seconds: accumulated paused time across the session, subtracted
-- from elapsed so the countdown freezes while paused.
ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_paused_seconds integer NOT NULL DEFAULT 0;
