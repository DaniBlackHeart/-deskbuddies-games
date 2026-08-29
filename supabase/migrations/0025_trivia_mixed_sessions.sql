-- DeskBuddies Games — Trivia Night: add a random "mixed" session option
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Confirmed with Dani (2026-08-29): this ADDS a second way to start a
-- Trivia Night session — it does not replace the existing one.
--   - Starting from a specific set (QuestionSetEditorPage, unchanged
--     location) still plays exactly that set's questions, in their
--     authored order, same as always.
--   - NEW: starting from the Question Sets list page (QuestionSetsPage),
--     outside of any one set, randomly mixes up to 30 questions pulled
--     from EVERY set at once — same "nothing to pick up front" spirit as
--     Wheel of Fortune's category randomizer and "Type What You See"'s
--     mixed sessions (0023_rebus_mixed_sessions.sql), but offered
--     ALONGSIDE the original single-set flow rather than replacing it,
--     since Dani still wants the option to run one specific set.
--
-- Why every session (single-set or mixed) now snapshots its question list
-- into a new table (trivia_session_questions) instead of the mixed case
-- alone: keeping ONE code path for next_question/end_question/
-- get-current-question/trivia-answer, regardless of how the session was
-- started, is simpler and more robust than branching all of them on
-- "does this session have a question_set_id or not." It also gets the
-- single-set flow the same protection mixed sessions need: a live
-- session's content stays stable even if a MOD edits, archives, or
-- deletes questions in the set it's using while the game is in progress,
-- and past sessions' history stays intact even if the original authored
-- question is later deleted. Same reasoning as rebus_session_puzzles.

-- =========================================================
-- trivia_sessions.question_set_id becomes OPTIONAL: null means "mixed
-- session, pulled from every set," non-null means "started from this one
-- specific set" (unchanged meaning, just no longer required). The
-- existing foreign key is untouched — still blocks deleting a
-- question_sets row that a session was started from, exactly as before.
-- =========================================================
alter table public.trivia_sessions alter column question_set_id drop not null;

-- =========================================================
-- trivia_session_questions
-- One immutable snapshot row per question in THIS session's list —
-- built once by trivia-host's create_session (see
-- pickTriviaSessionQuestions / pickTriviaSessionQuestionsForSet in
-- _shared/utils.ts) and never touched again. For a mixed session this is
-- a random pick across every set (capped at 30); for a single-set session
-- it's that set's own active questions in their authored order. Either
-- way, order_index replaces questions.order_index for everything
-- session-scoped — next_question/end_question/get-current-question/
-- trivia-answer all keep working the same way, just querying this table
-- by session_id instead of `questions` by question_set_id.
--
-- source_question_id is kept for MOD traceability only ("which authored
-- question became this one") — never read at play time, and set null (not
-- cascaded) if the original question is later deleted, since the content
-- this session actually needs already lives on this row.
--
-- Zero insert/update policies — only trivia-host's service-role client
-- ever writes here. Read access is MOD-only (matches "questions: mods
-- manage"'s read side) since these rows carry correct_choice/
-- accepted_answers before reveal — the exact anti-cheat boundary the
-- original `questions` table already drew.
-- =========================================================
create table public.trivia_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trivia_sessions (id) on delete cascade,
  order_index int not null,
  source_question_id uuid references public.questions (id) on delete set null,
  type text not null check (type in ('multiple_choice', 'typed')),
  prompt text not null,
  choices jsonb,
  correct_choice int,
  accepted_answers jsonb,
  points int not null,
  penalty_points int,
  time_limit_seconds int not null,
  created_at timestamptz not null default now(),
  unique (session_id, order_index)
);

alter table public.trivia_session_questions enable row level security;

create policy "trivia_session_questions: mods read"
  on public.trivia_session_questions for select
  using (public.is_mod());

-- =========================================================
-- Retarget answers.question_id: going forward it points at the
-- session-scoped snapshot row a player actually answered (for BOTH
-- single-set and mixed sessions now), not the original authored
-- `questions` row. Same move 0023 made for rebus_answers.puzzle_id — but
-- unlike Rebus, Trivia Night already has real production history at the
-- time of this migration (57 sessions, 4,320 answers as of 2026-08-29),
-- and every one of those existing answers.question_id values points at
-- `questions`, not the brand new (and currently empty)
-- trivia_session_questions table. A plain `add constraint` would try to
-- validate ALL of those old rows against the new table and fail
-- immediately on the very first one.
--
-- NOT VALID adds the constraint — so PostgREST still detects the
-- relationship and HostSessionPage's `questions:trivia_session_questions(...)`
-- embed keeps working for live/future sessions — without validating
-- existing rows against it. Historical answers keep their old
-- `questions`-table ids exactly as recorded (nothing about past games'
-- results changes); only new inserts after this migration are checked
-- against trivia_session_questions. This is the standard zero-downtime
-- pattern for retargeting a FK on a table with real existing data.
-- =========================================================
alter table public.answers
  drop constraint if exists answers_question_id_fkey,
  add constraint answers_question_id_fkey
    foreign key (question_id) references public.trivia_session_questions (id)
    not valid;

-- No realtime publication needed — written once at create_session and
-- never updated again, same as rebus_session_puzzles.
create index idx_trivia_session_questions_session on public.trivia_session_questions (session_id, order_index);
