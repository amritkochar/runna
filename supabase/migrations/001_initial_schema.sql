-- Runna Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,

  -- Strava integration
  strava_athlete_id text unique,
  strava_access_token text,
  strava_refresh_token text,
  strava_token_expires_at timestamptz,

  -- Spotify integration
  spotify_user_id text unique,
  spotify_access_token text,
  spotify_refresh_token text,
  spotify_is_premium boolean default false,

  -- AI-generated runner profile
  runner_persona jsonb,

  -- Preferences
  voice_enabled boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Activities table (synced from Strava)
create table if not exists public.activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  strava_activity_id bigint unique,

  name text,
  type text, -- Run, Walk, etc.
  distance_meters float,
  moving_time_seconds int,
  elapsed_time_seconds int,
  start_date timestamptz,

  average_speed float,
  max_speed float,
  average_heartrate float,
  max_heartrate float,
  calories float,
  elevation_gain float,

  -- Store full Strava response for future use
  raw_data jsonb,

  created_at timestamptz default now()
);

-- Voice notes
create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,

  content text not null,
  transcription text, -- Original voice transcription if from voice
  activity_id uuid references public.activities(id) on delete set null,

  created_at timestamptz default now()
);

-- Conversation history for context
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete set null,

  messages jsonb default '[]'::jsonb,
  summary text, -- AI-generated summary for long conversations

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_start_date on public.activities(start_date desc);
create index if not exists idx_activities_type on public.activities(type);
create index if not exists idx_notes_user_id on public.notes(user_id);
create index if not exists idx_conversations_user_id on public.conversations(user_id);

-- Row Level Security (RLS) policies
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.notes enable row level security;
alter table public.conversations enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Activities policies
create policy "Users can view their own activities"
  on public.activities for select
  using (auth.uid() = user_id);

create policy "Users can insert their own activities"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own activities"
  on public.activities for update
  using (auth.uid() = user_id);

create policy "Users can delete their own activities"
  on public.activities for delete
  using (auth.uid() = user_id);

-- Notes policies
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Conversations policies
create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_conversations_updated_at
  before update on public.conversations
  for each row execute procedure public.update_updated_at_column();
