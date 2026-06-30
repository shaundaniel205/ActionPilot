-- SQL Schema for ActionPilot Tasks
-- Run this in your Supabase SQL Editor

-- Create the tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references auth.users(id) on delete cascade (can be set if FK relation is desired)
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    deadline TIMESTAMPTZ NOT NULL,
    available_hours DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (optional, if querying directly from frontend with RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage only their own tasks
CREATE POLICY "Users can manage their own tasks" ON public.tasks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks (user_id);
