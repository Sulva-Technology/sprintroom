create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member' not null,
  created_at timestamp with time zone default now() not null,
  unique(workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Note: The tasks table might already exist if created previously, we use 'create table if not exists'
-- and add columns if they don't exist in a later step if necessary, but since this is a clean migration we define it fully.
-- If 'tasks' already exists without these columns, we should drop and recreate or alter. Let's assume it was partially created. 
-- Wait, let's just alter table if tasks exists, or drop it and recreate since development.
drop table if exists public.tasks cascade;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'backlog' not null,
  priority text default 'medium' not null,
  owner_id uuid references auth.users(id) on delete set null,
  deadline timestamp with time zone,
  estimate_pomodoros integer default 0,
  blocked_reason text,
  last_progress_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- We probably need focus_sessions to count them per project/task
drop table if exists public.focus_sessions cascade;

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  duration_minutes integer not null default 25,
  status text default 'completed' not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  created_at timestamp with time zone default now() not null
);

-- Trigger to set updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();
