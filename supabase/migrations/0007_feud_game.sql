-- DeskBuddies Games — Family Feud
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Mirrors the trivia tables' security model exactly:
--   - Content tables (feud_sets / feud_round_questions / feud_fastmoney_questions)
--     hold the answer key, so only MODs may ever read or write them directly —
--     same "mods manage" pattern as question_sets/questions.
--   - Live session tables (feud_sessions / feud_participants / feud_rounds) are
--     readable by any verified member, but ALL writes go through Edge Functions
--     (service role) — no insert/update policy for authenticated users, same
--     reasoning as trivia_sessions/session_participants/answers: business rules
--     (turn order, buzzer race, scoring) must be enforced server-side.
--   - feud_fastmoney_answers is the anti-cheat boundary for Fast Money: a member
--     may only read their OWN submitted rows, so Player 2's browser can never
--     see Player 1's answers even by querying the table directly.

-- =========================================================
-- feud_sets
-- The "question set" equivalent for this game — a MOD authors
-- a set of main-round board questions plus exactly 5 Fast Money
-- questions ahead of time.
-- =========================================================
create table public.feud_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.feud_sets enable row level security;

create policy "feud_sets: mods manage"
  on public.feud_sets for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- feud_round_questions
-- Main-round board questions. `answers` is a ranked list, highest
-- points first: [{ "text": "Sleep", "points": 35, "alt_answers": ["nap"] }, ...]
-- `alt_answers` lets a MOD pre-register accepted phrasings for the
-- same board slot; grading also normalizes (lowercase/punctuation/
-- accents) the same way trivia's typed-answer matching does.
-- =========================================================
create table public.feud_round_questions (
  id uuid primary key default gen_random_uuid(),
  feud_set_id uuid not null references public.feud_sets (id) on delete cascade,
  order_index int not null,
  prompt text not null,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  unique (feud_set_id, order_index)
);

alter table public.feud_round_questions enable row level security;

create policy "feud_round_questions: mods manage"
  on public.feud_round_questions for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- feud_fastmoney_questions
-- Exactly 5 per set (order_index 0-4), same answers shape as above.
-- =========================================================
create table public.feud_fastmoney_questions (
  id uuid primary key default gen_random_uuid(),
  feud_set_id uuid not null references public.feud_sets (id) on delete cascade,
  order_index int not null check (order_index between 0 and 4),
  prompt text not null,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  unique (feud_set_id, order_index)
);

alter table public.feud_fastmoney_questions enable row level security;

create policy "feud_fastmoney_questions: mods manage"
  on public.feud_fastmoney_questions for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- feud_sessions
-- The live game. status drives which phase everyone's in:
--   lobby            -> members join + pick a team
--   live             -> main game rounds in progress (round detail lives in feud_rounds)
--   main_ended       -> main game over, host is about to set up Fast Money
--   fastmoney_setup  -> host picked the two contestants, not started yet
--   fastmoney_p1     -> player 1's 20s run in progress
--   fastmoney_p2     -> player 2's 25s run in progress
--   fastmoney_reveal -> host is revealing answers one by one
--   ended            -> game over
-- =========================================================
create table public.feud_sessions (
  id uuid primary key default gen_random_uuid(),
  feud_set_id uuid not null references public.feud_sets (id),
  host_id uuid not null references public.profiles (id),
  status text not null default 'lobby'
    check (status in ('lobby', 'live', 'main_ended', 'fastmoney_setup', 'fastmoney_p1', 'fastmoney_p2', 'fastmoney_reveal', 'ended')),
  team_a_name text not null default 'Team A',
  team_b_name text not null default 'Team B',
  team_a_score int not null default 0,
  team_b_score int not null default 0,
  current_round_index int not null default -1,
  fastmoney_team text check (fastmoney_team in ('A', 'B')),
  fastmoney_player1_id uuid references public.profiles (id),
  fastmoney_player2_id uuid references public.profiles (id),
  fastmoney_p1_deadline timestamptz,
  fastmoney_p2_deadline timestamptz,
  fastmoney_total_points int not null default 0,
  fastmoney_revealed_indices int[] not null default '{}',
  join_code text not null unique,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.feud_sessions enable row level security;

create policy "feud_sessions: members read"
  on public.feud_sessions for select
  using (public.is_verified_member());

-- =========================================================
-- feud_participants
-- Team roster + turn order. line_position determines the order
-- teammates go down the line during board play (0 = first).
-- =========================================================
create table public.feud_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.feud_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  team text not null check (team in ('A', 'B')),
  line_position int not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, team, line_position)
);

alter table public.feud_participants enable row level security;

create policy "feud_participants: members read"
  on public.feud_participants for select
  using (public.is_verified_member());

-- =========================================================
-- feud_rounds
-- One row per board question played in a session — all the live
-- face-off/board/steal state. Created when the host starts a round,
-- updated throughout by the feud-play/feud-host Edge Functions.
-- =========================================================
create table public.feud_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.feud_sessions (id) on delete cascade,
  round_index int not null,
  status text not null default 'faceoff'
    check (status in ('faceoff', 'faceoff_decision', 'board', 'steal', 'lost_reveal', 'complete')),

  -- Face-off: which two reps are currently up, who buzzed in first,
  -- and (if the buzz-winner misses) who gets the fallback attempt.
  pair_index int not null default 0,
  face_off_active_a_user_id uuid references public.profiles (id),
  face_off_active_b_user_id uuid references public.profiles (id),
  face_off_buzz_user_id uuid references public.profiles (id),
  face_off_buzz_at timestamptz,
  face_off_singleton_user_id uuid references public.profiles (id),
  face_off_deadline timestamptz,
  face_off_decision_user_id uuid references public.profiles (id),

  -- Board play
  controlling_team text check (controlling_team in ('A', 'B')),
  opposing_team text check (opposing_team in ('A', 'B')),
  current_turn_user_id uuid references public.profiles (id),
  current_turn_deadline timestamptz,
  strikes int not null default 0,
  revealed_indices int[] not null default '{}',
  points_pot int not null default 0,

  -- Lost-without-control reveal (least to most valuable, one at a time)
  reveal_count int not null default 0,

  -- Outcome
  outcome text check (outcome in ('cleared', 'stolen', 'defended', 'lost_no_control')),
  awarded_to_team text check (awarded_to_team in ('A', 'B')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, round_index)
);

alter table public.feud_rounds enable row level security;

create policy "feud_rounds: members read"
  on public.feud_rounds for select
  using (public.is_verified_member());

-- =========================================================
-- feud_fastmoney_answers
-- Anti-cheat boundary for Fast Money: a player may only read their
-- OWN rows. Player 2's client genuinely cannot query Player 1's
-- answers, even before the host reveals anything.
-- =========================================================
create table public.feud_fastmoney_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.feud_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  player_slot int not null check (player_slot in (1, 2)),
  question_index int not null check (question_index between 0 and 4),
  answer_text text not null,
  matched_answer_index int,
  points_awarded int not null default 0,
  is_duplicate boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, player_slot, question_index)
);

alter table public.feud_fastmoney_answers enable row level security;

create policy "feud_fastmoney_answers: read own"
  on public.feud_fastmoney_answers for select
  using (user_id = auth.uid());

create policy "feud_fastmoney_answers: mods read all"
  on public.feud_fastmoney_answers for select
  using (public.is_mod());

-- =========================================================
-- Realtime — same three-table pattern as trivia (0002_enable_realtime.sql).
-- fastmoney_answers is deliberately excluded: it must never broadcast to
-- everyone, only surface via the private function-call response and the
-- host's explicit reveal broadcast.
-- =========================================================
alter publication supabase_realtime add table public.feud_sessions;
alter publication supabase_realtime add table public.feud_participants;
alter publication supabase_realtime add table public.feud_rounds;

-- Helpful indexes
create index idx_feud_round_questions_set on public.feud_round_questions (feud_set_id, order_index);
create index idx_feud_fastmoney_questions_set on public.feud_fastmoney_questions (feud_set_id, order_index);
create index idx_feud_participants_session on public.feud_participants (session_id, team, line_position);
create index idx_feud_rounds_session on public.feud_rounds (session_id, round_index);
create index idx_feud_fastmoney_answers_session on public.feud_fastmoney_answers (session_id, player_slot);
create index idx_feud_sessions_status on public.feud_sessions (status);
