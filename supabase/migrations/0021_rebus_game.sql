-- DeskBuddies Games — "Type What You See" (internal code name: rebus)
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Why "rebus": the puzzle genre this game uses (decoding word/emoji/letter
-- arrangements into a hidden word or phrase — "SIR USE LEE" -> SERIOUSLY)
-- has an actual name, rebus puzzles, so the tables/functions use that as a
-- short internal code the same way Wheel of Fortune uses `wheel` and Family
-- Feud uses `feud`. The player-facing name stays "Type What You See"
-- everywhere in the UI.
--
-- Format, confirmed with Dani before building (see PROJECT_CONTEXT.md for
-- the full writeup):
--   - Answering is PARALLEL, like Trivia: everyone types their own guess
--     independently within the timer; every correct submitter scores. This
--     is a deliberate departure from a literal reading of the original spec
--     ("passed to another player if wrong") — that phrasing described a
--     single-shared-screen party game, which doesn't fit "everyone plays on
--     their own device." Parallel typing is Trivia's proven pattern here.
--   - Supports both solo and team scoring, toggled per-session like Wheel
--     of Fortune (self-selected teams in the lobby, not MOD-assigned).
--     Unlike Wheel, there's no turn rotation to layer on top — answering
--     stays parallel in team mode too; a correct guess just credits that
--     member's points to their team's total instead of (in addition to)
--     their individual total.
--   - Same Chill/Hard scoring mode as Trivia (wrong = -50% of points in
--     Hard, no-answer = -25%, both 0 in Chill) via the same
--     resolveWrongPenalty/resolveTimeoutPenalty helpers.
--   - Hints were explicitly descoped for v1 (see PROJECT_CONTEXT.md) — so
--     the spec's "+300 without a hint / +150 after a hint" speed bonus
--     collapses to a flat +300 on every correct answer (REBUS_SPEED_BONUS
--     in _shared/utils.ts), since a hint can never have been shown.
--   - Round 4 ("two players compete, 30s each") mirrors Family Feud's Fast
--     Money shape (two players, sequential turns, isolated from each
--     other's answers) rather than the board-reveal ceremony Fast Money
--     itself uses — this round grades live, one puzzle at a time, exactly
--     like a firing-quickly version of the main rounds.
--   - The Final Round's single puzzle is NOT anti-cheat-gated from the
--     rest of the session the way the Sprint is: with only one entrant and
--     no rival who could benefit from seeing it, everyone watches the
--     finalist attempt it live — a shared "big moment" screen, closer to
--     the spirit of a party game finale than the Sprint's fairness need.

-- =========================================================
-- rebus_sets / rebus_puzzles
-- Authored by MODs. rebus_puzzles holds every puzzle for rounds 1-3 AND
-- the Final Round puzzle(s) in ONE contiguously-ordered list per set (same
-- convention as trivia's `questions` table) — `round` tags which part of
-- the format a puzzle belongs to; `order_index` is global across all of
-- them. The Sprint Round (Round 4) draws from a separate, simpler pool —
-- see rebus_sprint_puzzles below — since it's attempted sequentially by
-- one player at a time rather than scored per-puzzle-per-everyone.
-- =========================================================
create table public.rebus_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.rebus_sets enable row level security;

create policy "rebus_sets: mods manage"
  on public.rebus_sets for all
  using (public.is_mod())
  with check (public.is_mod());

create table public.rebus_puzzles (
  id uuid primary key default gen_random_uuid(),
  rebus_set_id uuid not null references public.rebus_sets (id) on delete cascade,
  order_index int not null,
  round text not null check (round in ('warmup', 'round2', 'round3', 'final')),
  puzzle_type text not null default 'phonetic'
    check (puzzle_type in ('phonetic', 'split', 'numbers_letters', 'visual', 'missing_letters', 'repeated', 'homophone')),
  -- The puzzle as shown on screen, e.g. "SIR USE LEE" or a multi-line
  -- visual-arrangement puzzle (newlines preserved and rendered as-is).
  display_text text not null,
  answer_text text not null, -- the canonical answer, shown on reveal
  accepted_answers jsonb not null default '[]', -- string[] of accepted variants, matched via normalizeAnswer like Trivia's typed questions
  points int not null,
  time_limit_seconds int not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.rebus_puzzles enable row level security;

create policy "rebus_puzzles: mods manage"
  on public.rebus_puzzles for all
  using (public.is_mod())
  with check (public.is_mod());

-- Partial unique index (not a table-level constraint) so archived puzzles
-- can keep their old order_index as inert history while active ones stay
-- contiguous 0..N-1 — same archive-not-delete pattern as
-- 0010_archive_question_sets_and_questions.sql, just built in from the
-- start since this is a brand new table.
create unique index rebus_puzzles_active_order_idx
  on public.rebus_puzzles (rebus_set_id, order_index)
  where archived_at is null;

-- =========================================================
-- rebus_sprint_puzzles
-- The Round 4 ("Sprint") pool — a flat, ordered list each of the two
-- sprint players races through from the top within their own 30-second
-- window. No FK ever points at a specific row here (rebus_sprint_answers
-- records the pool POSITION a player was on, not a row id — see below), so
-- these always hard-delete cleanly. Same reasoning as
-- impostor_words/wheel_phrases (see lib/archiveOrDelete.ts) — no
-- archived_at column needed.
-- =========================================================
create table public.rebus_sprint_puzzles (
  id uuid primary key default gen_random_uuid(),
  rebus_set_id uuid not null references public.rebus_sets (id) on delete cascade,
  order_index int not null,
  display_text text not null,
  answer_text text not null,
  accepted_answers jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (rebus_set_id, order_index)
);

alter table public.rebus_sprint_puzzles enable row level security;

create policy "rebus_sprint_puzzles: mods manage"
  on public.rebus_sprint_puzzles for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- rebus_sessions
-- No join_code column — confirmed dead weight on every other session
-- table in this project (generated, displayed, never actually read by any
-- join flow — see PROJECT_CONTEXT.md §5), so it isn't being propagated
-- into a brand new table.
--
-- Status flow:
--   lobby -> live (rounds 1-3, current_puzzle_index steps through
--     non-final puzzles) -> reveal (per-puzzle, repeats with live) ->
--     round_ended (rounds 1-3 done) -> sprint_setup (MOD picks the two
--     Round 4 players) -> sprint_p1 -> sprint_p2 -> sprint_done ->
--     final_live -> final_reveal -> ended.
--   end_session is reachable from any non-ended status — it's both the
--   lobby "Cancel" button and the in-progress "End session" button,
--   exactly like every other game's host page.
-- =========================================================
create table public.rebus_sessions (
  id uuid primary key default gen_random_uuid(),
  rebus_set_id uuid not null references public.rebus_sets (id),
  host_id uuid not null references public.profiles (id),
  status text not null default 'lobby' check (status in (
    'lobby', 'live', 'reveal', 'round_ended',
    'sprint_setup', 'sprint_p1', 'sprint_p2', 'sprint_done',
    'final_live', 'final_reveal', 'ended'
  )),
  mode text not null default 'chill' check (mode in ('chill', 'hard')),
  game_mode text not null default 'solo' check (game_mode in ('solo', 'team')),

  -- Rounds 1-3 (parallel typing, mirrors trivia_sessions)
  current_puzzle_index int not null default -1,
  puzzle_started_at timestamptz, -- reused for the Final Round puzzle too (statuses never overlap)

  -- Round 4 — Sprint (mirrors feud_sessions' fastmoney_* shape, but each
  -- player is graded live one puzzle at a time rather than revealed after
  -- the fact)
  sprint_player1_id uuid references public.profiles (id),
  sprint_player2_id uuid references public.profiles (id),
  sprint_p1_deadline timestamptz,
  sprint_p2_deadline timestamptz,
  sprint_p1_index int not null default 0, -- pointer into rebus_sprint_puzzles for player 1
  sprint_p2_index int not null default 0,
  sprint_p1_points int not null default 0,
  sprint_p2_points int not null default 0,

  -- Final Round
  final_player_id uuid references public.profiles (id),
  final_puzzle_id uuid references public.rebus_puzzles (id),

  spectator_id uuid references public.profiles (id),
  -- Set once, in end_session — whether the whole format was actually
  -- played through (reached final_reveal, or reached round_ended/
  -- sprint_done with no Final Round puzzle in the set to play) versus cut
  -- short by a MOD. Persisted rather than re-derived by every reader
  -- (get-rebus-state, the ended-session sound cue, etc.) so there's one
  -- source of truth for "how did this end" — same reasoning trivia_sessions
  -- solves by comparing current_question_index against the question count
  -- on every read, except here two different endings (with/without a
  -- Final Round puzzle) make that comparison awkward to repeat correctly
  -- in more than one place.
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.rebus_sessions enable row level security;

create policy "rebus_sessions: members read"
  on public.rebus_sessions for select
  using (public.is_verified_member());

-- =========================================================
-- rebus_teams
-- Self-selected in the lobby, same UX as wheel_teams — but no seat_order
-- or turn-rotation columns, since Rebus answering stays parallel in team
-- mode too (no per-team turn to track).
-- =========================================================
create table public.rebus_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rebus_sessions (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

alter table public.rebus_teams enable row level security;

create policy "rebus_teams: members read"
  on public.rebus_teams for select
  using (public.is_verified_member());

-- =========================================================
-- rebus_participants
-- =========================================================
create table public.rebus_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rebus_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  team_id uuid references public.rebus_teams (id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id)
);

alter table public.rebus_participants enable row level security;

create policy "rebus_participants: members read"
  on public.rebus_participants for select
  using (public.is_verified_member());

create policy "rebus_participants: members join as self"
  on public.rebus_participants for insert
  with check (public.is_verified_member() and user_id = auth.uid());

-- Members may only update their OWN row, and only implicitly restricted to
-- team_id by the "own row" condition below — matches the defense-in-depth
-- posture of session_participants' analogous insert policy in 0001_init.sql.
-- In practice, create_team/join_team/leave_team in rebus-play write through
-- the service-role admin client (bypassing RLS) same as every other
-- session mutation in this project, so this policy isn't the only thing
-- standing between a member and someone else's team — but it keeps the
-- door closed for any future direct-from-browser write, too.
create policy "rebus_participants: members update own team"
  on public.rebus_participants for update
  using (public.is_verified_member() and user_id = auth.uid())
  with check (public.is_verified_member() and user_id = auth.uid());

-- =========================================================
-- rebus_answers
-- Rounds 1-3 AND the Final Round puzzle (round='final') both land here —
-- same anti-cheat boundary as trivia's `answers` table: grading happens in
-- an Edge Function with the service-role key, and a member can only ever
-- read their OWN row back. is_correct is never nullable here (unlike
-- trivia's typed questions) — Rebus has no manual-grade-pending state,
-- every answer is auto-graded via normalizeAnswer/typedAnswerMatches.
-- =========================================================
create table public.rebus_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rebus_sessions (id) on delete cascade,
  puzzle_id uuid not null references public.rebus_puzzles (id),
  user_id uuid not null references public.profiles (id),
  answer_text text,
  is_correct boolean not null default false,
  points_awarded int not null default 0,
  response_ms int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, puzzle_id, user_id)
);

alter table public.rebus_answers enable row level security;

create policy "rebus_answers: read own"
  on public.rebus_answers for select
  using (user_id = auth.uid());

create policy "rebus_answers: mods read all"
  on public.rebus_answers for select
  using (public.is_mod());

-- =========================================================
-- rebus_sprint_answers
-- Anti-cheat boundary for Round 4: records puzzle_index (the pool
-- POSITION, not a row id) rather than an FK to rebus_sprint_puzzles, so
-- Player 2's client can never join its way to Player 1's actual puzzle
-- text through this table — only "read own row" is granted, same
-- reasoning as feud_fastmoney_answers.
-- =========================================================
create table public.rebus_sprint_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rebus_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  player_slot int not null check (player_slot in (1, 2)),
  puzzle_index int not null,
  answer_text text not null,
  is_correct boolean not null default false,
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, player_slot, puzzle_index)
);

alter table public.rebus_sprint_answers enable row level security;

create policy "rebus_sprint_answers: read own"
  on public.rebus_sprint_answers for select
  using (user_id = auth.uid());

create policy "rebus_sprint_answers: mods read all"
  on public.rebus_sprint_answers for select
  using (public.is_mod());

-- =========================================================
-- Realtime — added in THIS migration, not a follow-up. Every live-state
-- table a player's screen needs to react to goes in the publication now,
-- learned the hard way across three earlier games (see
-- PROJECT_CONTEXT.md §7 / 0020_wheel_teams_realtime.sql). rebus_answers
-- and rebus_sprint_answers are deliberately EXCLUDED — same anti-cheat
-- boundary as trivia's `answers` and feud's fastmoney answers table.
-- =========================================================
alter publication supabase_realtime add table public.rebus_sessions;
alter publication supabase_realtime add table public.rebus_teams;
alter publication supabase_realtime add table public.rebus_participants;

-- Helpful indexes
create index idx_rebus_puzzles_set on public.rebus_puzzles (rebus_set_id, order_index);
create index idx_rebus_puzzles_archived on public.rebus_puzzles (rebus_set_id, archived_at);
create index idx_rebus_sets_archived on public.rebus_sets (archived_at);
create index idx_rebus_sprint_puzzles_set on public.rebus_sprint_puzzles (rebus_set_id, order_index);
create index idx_rebus_sessions_status on public.rebus_sessions (status);
create index idx_rebus_teams_session on public.rebus_teams (session_id);
create index idx_rebus_participants_session on public.rebus_participants (session_id, team_id);
create index idx_rebus_answers_session_puzzle on public.rebus_answers (session_id, puzzle_id);
create index idx_rebus_sprint_answers_session on public.rebus_sprint_answers (session_id, player_slot);
