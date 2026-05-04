create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  is_completed boolean default false not null,
  created_at timestamp with time zone default now() not null,
  position integer default 0
);

alter table public.focus_sessions add column if not exists started_at timestamp with time zone default now();
alter table public.focus_sessions add column if not exists ended_at timestamp with time zone;
alter table public.focus_sessions add column if not exists progress_note text;
alter table public.focus_sessions add column if not exists distractions_count integer default 0;
alter table public.focus_sessions add column if not exists is_meaningful boolean default false;
alter table public.tasks add column if not exists completed_pomodoros integer default 0;
