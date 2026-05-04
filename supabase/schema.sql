-- Copy and paste this into your Supabase SQL Editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tasks table
CREATE TYPE task_status AS ENUM ('backlog', 'today', 'doing', 'blocked', 'review', 'done');

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status task_status DEFAULT 'backlog' NOT NULL,
  priority int DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create pomodoros table
CREATE TYPE pomodoro_status AS ENUM ('active', 'completed', 'discarded');

CREATE TABLE IF NOT EXISTS public.pomodoros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone,
  notes text,
  status pomodoro_status DEFAULT 'active' NOT NULL
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoros ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Tasks Policies
CREATE POLICY "Users can view their own tasks."
  ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tasks."
  ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks."
  ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks."
  ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Pomodoros Policies
CREATE POLICY "Users can view their own pomodoros."
  ON public.pomodoros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own pomodoros."
  ON public.pomodoros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pomodoros."
  ON public.pomodoros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pomodoros."
  ON public.pomodoros FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.pomodoros;
