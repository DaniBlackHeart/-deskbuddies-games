-- DeskBuddies Games — "Type What You See" (rebus): mixed random sessions
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Confirmed with Dani (2026-08-29), same discipline as every prior schema
-- decision in this project — see PROJECT_CONTEXT.md:
--   - Rounds become automatic: starting a session no longer means picking
--     one specific rebus_set and playing its hand-curated Round 1/2/3/
--     Final list top to bottom. Instead the system randomly assembles the
--     session's puzzles by pulling from EVERY active set's puzzles at once
--     — same spirit as Wheel of Fortune randomizing its own category +
--     phrase each round ("nothing to pick up front").
--   - Chill/Hard and Solo/Team move off the individual set page and onto
--     one shared "Type What You See" landing screen (mirrors
--     WheelCategoriesPage) — sets go back to being pure puzzle-authoring
--     containers, no longer something you "start a session from."
--   - Puzzle counts stay the original fixed defaults: up to 10 puzzles
--     each for Warm-Up/Round 2/Round 3, 1 Final Round puzzle if any exist
--     anywhere, and the whole combined Sprint pool for Round 4.
--
-- Why a SNAPSHOT table (rebus_session_puzzles / rebus_session_sprint_
-- puzzles) instead of just recording which rebus_puzzles rows got picked:
-- a live session's content has to stay stable even if a MOD edits,
-- archives, or deletes puzzles in ANY set (including ones that fed this
-- session's pool) while the game is in progress. Copying the puzzle text
-- into a session-scoped row at creation time decouples a live game
-- entirely from the authoring tables after that point — the same
-- defensive instinct as rebus_sprint_answers keying off pool POSITION
-- instead of a row id (see 0021_rebus_game.sql). A useful side effect:
-- past sessions' history/leaderboards stay intact even if the original
-- authored puzzle is later deleted outright.

-- =========================================================
-- rebus_sessions no longer belongs to one specific set — every session
-- mixes puzzles from all of them, so the FK stops meaning anything
-- useful. rebus_sets / rebus_puzzles / rebus_sprint_puzzles are untouched
-- by this migration; they're still exactly how MODs author content.
-- =========================================================
alter table public.rebus_sessions drop column rebus_set_id;

-- =========================================================
-- rebus_session_puzzles
-- One immutable snapshot row per puzzle selected into THIS session's
-- rounds 1-3 + Final Round, built once by rebus-host's create_session
-- (see pickRebusSessionPuzzles in _shared/utils.ts) and never touched
-- again. order_index is ONE FLAT counter across warmup -> round2 ->
-- round3 -> final, mirroring the single contiguous sequence
-- rebus_puzzles.order_index used per set — next_puzzle/end_puzzle/
-- get-rebus-state all keep working the same way, just querying this
-- table by session_id instead of rebus_puzzles by rebus_set_id.
--
-- source_puzzle_id is kept for MOD traceability only (e.g. "which
-- authored puzzle became this one") — never read at play time, and set
-- null (not cascaded) if the original puzzle is later deleted, since the
-- text this session actually needs already lives on this row.
--
-- Zero insert/update policies — only rebus-host's service-role client
-- ever writes here. Read access is MOD-only (matches "rebus_puzzles:
-- mods manage"'s read side) since these rows carry answer_text/
-- accepted_answers before reveal — a blanket member-read policy here
-- would be the exact "RLS is row-level, not column-level" anti-cheat
-- hole PROJECT_CONTEXT.md §7 already flags from the UNO build. Regular
-- players only ever see this content through get-rebus-state's curated,
-- reveal-gated payload.
-- =========================================================
create table public.rebus_session_puzzles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rebus_sessions (id) on delete cascade,
  round text not null check (round in ('warmup', 'round2', 'round3', 'final')),
  order_index int not null,
  source_puzzle_id uuid references public.rebus_puzzles (id) on delete set null,
  puzzle_type text not null,
  display_text text not null,
  answer_text text not null,
  accepted_answers jsonb not null default '[]',
  points int not null,
  time_limit_seconds int not null,
  created_at timestamptz not null default now(),
  unique (session_id, order_index)
);

alter table public.rebus_session_puzzles enable row level security;

create policy "rebus_session_puzzles: mods read"
  on public.rebus_session_puzzles for select
  using (public.is_mod());

-- =========================================================
-- rebus_session_sprint_puzzles
-- Same snapshot idea for Round 4's pool — every rebus_sprint_puzzles row
-- from every set, shuffled together once at session creation. No round
-- concept, no per-round cap (matches the original single-set pool's "no
-- fixed count, just race through as much of it as you can").
--
-- source_sprint_puzzle_id: traceability only, same reasoning as above.
--
-- ZERO select policies at all, deliberately — not even MOD-read. This
-- mirrors rebus_sprint_answers'/uno_deck_state's "defense in depth"
-- shape (PROJECT_CONTEXT.md §4/§7): the Sprint pool's content is a
-- genuine secret that stays hidden from EVERYONE, including a spectating
-- MOD, until a specific player is actively racing through it — the host
-- page never showed sprint puzzle text before this change either, only
-- points. Only rebus-play's/rebus-host's service-role client ever reads
-- or writes this table.
-- =========================================================
create table public.rebus_session_sprint_puzzles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rebus_sessions (id) on delete cascade,
  order_index int not null,
  source_sprint_puzzle_id uuid references public.rebus_sprint_puzzles (id) on delete set null,
  display_text text not null,
  answer_text text not null,
  accepted_answers jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (session_id, order_index)
);

alter table public.rebus_session_sprint_puzzles enable row level security;
-- No policies — see comment above. RLS enabled with zero policies denies
-- all client-side access by default, same as active_session_lock.

-- =========================================================
-- Retarget rebus_answers.puzzle_id and rebus_sessions.final_puzzle_id:
-- both now point at the session-scoped snapshot row a player actually
-- answered, not the original authored rebus_puzzles row (which may live
-- on in other sessions' history, get edited, or be deleted independently).
-- =========================================================
alter table public.rebus_answers
  drop constraint if exists rebus_answers_puzzle_id_fkey,
  add constraint rebus_answers_puzzle_id_fkey
    foreign key (puzzle_id) references public.rebus_session_puzzles (id);

alter table public.rebus_sessions
  drop constraint if exists rebus_sessions_final_puzzle_id_fkey,
  add constraint rebus_sessions_final_puzzle_id_fkey
    foreign key (final_puzzle_id) references public.rebus_session_puzzles (id);

-- Helpful indexes — no realtime publication needed for either new table:
-- both are written once at create_session and never updated again, so
-- there's nothing for a live client to subscribe to.
create index idx_rebus_session_puzzles_session on public.rebus_session_puzzles (session_id, order_index);
create index idx_rebus_session_puzzles_round on public.rebus_session_puzzles (session_id, round);
create index idx_rebus_session_sprint_puzzles_session on public.rebus_session_sprint_puzzles (session_id, order_index);
