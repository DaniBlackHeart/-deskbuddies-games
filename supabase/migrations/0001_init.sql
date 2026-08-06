-- DeskBuddies Games — initial schema
-- Run via: supabase db push  (or paste into the Supabase SQL editor)

-- =========================================================
-- profiles
-- One row per Discord-authenticated user. Populated/updated
-- exclusively by the verify-membership Edge Function using the
-- service role key — never written to directly by clients.
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  username text not null,
  avatar_url text,
  is_member boolean not null default false,
  is_mod boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- No insert/update/delete policies for the authenticated role on purpose:
-- only the service role (Edge Functions) may write to this table.

-- Helper functions (security definer so policies elsewhere can check
-- role without running into recursive RLS on profiles).
create function public.is_mod()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_mod from public.profiles where id = auth.uid()), false);
$$;

create function public.is_verified_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_member from public.profiles where id = auth.uid()), false);
$$;

-- =========================================================
-- question_sets / questions
-- Authored by MODs. Contains answer keys, so only MODs may
-- ever read or write these tables directly.
-- =========================================================
create table public.question_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.question_sets enable row level security;

create policy "question_sets: mods manage"
  on public.question_sets for all
  using (public.is_mod())
  with check (public.is_mod());

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets (id) on delete cascade,
  order_index int not null,
  type text not null check (type in ('multiple_choice', 'typed')),
  prompt text not null,
  choices jsonb, -- string[] for multiple_choice
  correct_choice int, -- index into choices, multiple_choice only
  accepted_answers jsonb, -- string[] for typed
  points int not null default 100,
  time_limit_seconds int not null default 20,
  unique (question_set_id, order_index)
);

alter table public.questions enable row level security;

create policy "questions: mods manage"
  on public.questions for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- trivia_sessions
-- Readable by any verified member (no secrets in this table).
-- Writable ONLY via the trivia-host Edge Function (service role) —
-- deliberately no insert/update policy for authenticated users.
-- =========================================================
create table public.trivia_sessions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets (id),
  host_id uuid not null references public.profiles (id),
  status text not null default 'draft'
    check (status in ('draft', 'lobby', 'live', 'grading', 'ended')),
  current_question_index int not null default -1,
  current_question_started_at timestamptz,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.trivia_sessions enable row level security;

create policy "trivia_sessions: members read"
  on public.trivia_sessions for select
  using (public.is_verified_member());

-- =========================================================
-- session_participants
-- Lightweight "I'm here" presence row. Members can insert their
-- own row only; no update needed (score is derived from answers).
-- =========================================================
create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trivia_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  unique (session_id, user_id)
);

alter table public.session_participants enable row level security;

create policy "session_participants: members read"
  on public.session_participants for select
  using (public.is_verified_member());

create policy "session_participants: members join as self"
  on public.session_participants for insert
  with check (public.is_verified_member() and user_id = auth.uid());

-- =========================================================
-- answers
-- Contains grading outcomes. Members may read only their own
-- rows (for reconnect/hydration). ALL writes go through Edge
-- Functions using the service role — this is the anti-cheat
-- boundary, so no insert/update policy exists for authenticated
-- users here on purpose.
-- =========================================================
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trivia_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  user_id uuid not null references public.profiles (id),
  choice_index int,
  answer_text text,
  is_correct boolean, -- null = pending manual grade (unmatched typed answer)
  points_awarded int not null default 0,
  response_ms int not null default 0,
  graded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (session_id, question_id, user_id)
);

alter table public.answers enable row level security;

create policy "answers: read own"
  on public.answers for select
  using (user_id = auth.uid());

create policy "answers: mods read all for their sessions"
  on public.answers for select
  using (public.is_mod());

-- Helpful indexes
create index idx_questions_set on public.questions (question_set_id, order_index);
create index idx_answers_session_question on public.answers (session_id, question_id);
create index idx_sessions_status on public.trivia_sessions (status);
