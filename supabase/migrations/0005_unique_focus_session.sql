-- Prevent duplicate active focus sessions per user
create unique index if not exists unique_active_focus_session_per_user
on focus_sessions(user_id)
where status = 'active';
