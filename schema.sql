-- Peak — Supabase schema
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.
-- `users` is managed by Supabase Auth (auth.users); the tables below reference it.

-- ---------------------------------------------------------------------------
-- daily_logs
-- ---------------------------------------------------------------------------
create table if not exists public.daily_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  weight_kg   numeric(5, 2),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- nutrition_logs
-- ---------------------------------------------------------------------------
create table if not exists public.nutrition_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  meal_name   text not null,
  meal_type   text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  calories    numeric(7, 2),
  protein_g   numeric(7, 2),
  carbs_g     numeric(7, 2),
  fat_g       numeric(7, 2),
  created_at  timestamptz not null default now()
);

create index if not exists nutrition_logs_user_date_idx
  on public.nutrition_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- saved_meals
-- ---------------------------------------------------------------------------
create table if not exists public.saved_meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  calories     numeric(7, 2),
  protein_g    numeric(7, 2),
  carbs_g      numeric(7, 2),
  fat_g        numeric(7, 2),
  ingredients  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists saved_meals_user_idx
  on public.saved_meals (user_id);

-- ---------------------------------------------------------------------------
-- garmin_data
-- ---------------------------------------------------------------------------
create table if not exists public.garmin_data (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  date                  date not null,
  hrv_score             numeric(6, 2),
  sleep_score           numeric(6, 2),
  sleep_duration_hours  numeric(4, 2),
  resting_hr            integer,
  run_distance_km       numeric(6, 2),
  run_duration_mins     numeric(6, 2),
  run_avg_pace          text,
  created_at            timestamptz not null default now(),
  synced_at             timestamptz,
  unique (user_id, date)
);

-- Sleep-stage minutes (added after the initial schema). Safe to run repeatedly.
alter table public.garmin_data add column if not exists sleep_deep_min  integer;
alter table public.garmin_data add column if not exists sleep_light_min integer;
alter table public.garmin_data add column if not exists sleep_rem_min   integer;
alter table public.garmin_data add column if not exists sleep_awake_min integer;

-- ---------------------------------------------------------------------------
-- training_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.training_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  date            date not null,
  session_type    text not null check (session_type in ('climb', 'gym', 'run', 'rest', 'restrun')),
  problems_logged integer not null default 0,
  completed_items jsonb not null default '[]'::jsonb,
  notes           text,
  completed       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- If the table already existed (e.g. you ran an earlier version of this file),
-- bring it up to date. Safe to run repeatedly.
alter table public.training_sessions
  add column if not exists completed_items jsonb not null default '[]'::jsonb;

-- Refresh the session_type check to include 'restrun' (Wed = Rest + Run).
alter table public.training_sessions
  drop constraint if exists training_sessions_session_type_check;
alter table public.training_sessions
  add constraint training_sessions_session_type_check
  check (session_type in ('climb', 'gym', 'run', 'rest', 'restrun'));

create index if not exists training_sessions_user_date_idx
  on public.training_sessions (user_id, date);

-- ===========================================================================
-- Row Level Security
-- Each table: enable RLS, then a single policy scoping all access to the
-- authenticated owner (auth.uid() = user_id).
-- ===========================================================================

alter table public.daily_logs        enable row level security;
alter table public.nutrition_logs    enable row level security;
alter table public.saved_meals       enable row level security;
alter table public.garmin_data       enable row level security;
alter table public.training_sessions enable row level security;

-- daily_logs
drop policy if exists "Owner access" on public.daily_logs;
create policy "Owner access" on public.daily_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- nutrition_logs
drop policy if exists "Owner access" on public.nutrition_logs;
create policy "Owner access" on public.nutrition_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- saved_meals
drop policy if exists "Owner access" on public.saved_meals;
create policy "Owner access" on public.saved_meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- garmin_data
drop policy if exists "Owner access" on public.garmin_data;
create policy "Owner access" on public.garmin_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- training_sessions
drop policy if exists "Owner access" on public.training_sessions;
create policy "Owner access" on public.training_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===========================================================================
-- journal_entries
-- ===========================================================================
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  date        date not null,
  entry_text  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

-- ===========================================================================
-- PROTOTYPE MODE (run until auth is added)
-- ---------------------------------------------------------------------------
-- The app currently has no auth and attributes all rows to the text user
-- "placeholder-user". To let it read/write directly with the anon key, the
-- two tables it touches use a text user_id and have RLS disabled.
--
-- ⚠️  SECURITY: with RLS off these two tables are world-readable/writable via
-- the anon key. Fine for a personal single-user prototype. When you add auth,
-- switch user_id back to uuid (referencing auth.users) and re-enable the
-- "Owner access" RLS policy — and remove this block.
-- ===========================================================================

-- training_sessions → text user_id, RLS off
alter table public.training_sessions drop constraint if exists training_sessions_user_id_fkey;
drop policy if exists "Owner access" on public.training_sessions;
alter table public.training_sessions disable row level security;
alter table public.training_sessions
  alter column user_id type text using user_id::text;

-- journal_entries → RLS off (user_id is already text)
alter table public.journal_entries disable row level security;

-- garmin_data → text user_id, RLS off (so the Python sync writes and the app
-- reads it with the anon key, same as the other prototype tables).
alter table public.garmin_data drop constraint if exists garmin_data_user_id_fkey;
drop policy if exists "Owner access" on public.garmin_data;
alter table public.garmin_data disable row level security;
alter table public.garmin_data
  alter column user_id type text using user_id::text;

-- nutrition_logs → text user_id, RLS off (food logging writes/reads via anon).
alter table public.nutrition_logs drop constraint if exists nutrition_logs_user_id_fkey;
drop policy if exists "Owner access" on public.nutrition_logs;
alter table public.nutrition_logs disable row level security;
alter table public.nutrition_logs
  alter column user_id type text using user_id::text;

-- saved_meals → text user_id, RLS off (quick-add favorites via anon).
alter table public.saved_meals drop constraint if exists saved_meals_user_id_fkey;
drop policy if exists "Owner access" on public.saved_meals;
alter table public.saved_meals disable row level security;
alter table public.saved_meals
  alter column user_id type text using user_id::text;
