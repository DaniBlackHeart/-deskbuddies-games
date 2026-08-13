-- DeskBuddies Games — archive (soft delete) support for trivia question sets/questions
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Why: neither answers.question_id nor trivia_sessions.question_set_id
-- cascades or nulls out on delete (both default to RESTRICT), so a hard
-- DELETE is rejected by Postgres once a question/set has real play history
-- attached — which is the point, we don't want to silently blow away past
-- answers or leaderboards. This migration adds archived_at so a MOD can
-- remove a question/set from active use without touching that history.
--
-- Frontend pattern (src/lib/archiveOrDelete.ts):
--   1. Try a real DELETE.
--   2. If Postgres rejects it with foreign_key_violation (23503), set
--      archived_at instead.
--   3. Renumber the set's remaining ACTIVE questions so order_index stays
--      contiguous (0..N-1) — trivia-host / get-current-question /
--      trivia-answer all rely on that invariant to line up
--      session.current_question_index with the right question.

alter table public.question_sets
  add column archived_at timestamptz;

alter table public.questions
  add column archived_at timestamptz;

-- The old table-level `unique (question_set_id, order_index)` constraint
-- applies to every row regardless of archived_at, which would block step 3
-- above whenever renumbering needs to reuse a slot an archived question
-- still occupies. Replace it with a partial unique index that only
-- enforces uniqueness among ACTIVE questions — archived rows keep their
-- old order_index purely as inert history, never read by app code.
alter table public.questions
  drop constraint if exists questions_question_set_id_order_index_key;

create unique index questions_active_order_idx
  on public.questions (question_set_id, order_index)
  where archived_at is null;

-- Speeds up "active sets/questions" listing queries.
create index idx_question_sets_archived on public.question_sets (archived_at);
create index idx_questions_archived on public.questions (question_set_id, archived_at);

-- No RLS changes needed: the existing "mods manage" policies on both tables
-- use `for all`, which already covers the UPDATE used to set archived_at.
