# Trivia Night — random "outside of sets" session (corrected v2)

**This supersedes the earlier zip.** The first delivery accidentally
*replaced* the existing "start a session from within a specific set" flow
instead of adding a new option alongside it. This version restores that
flow untouched and adds the new one next to it, as originally asked for.

## What this adds

A second way to start a Trivia Night session, alongside the one that
already existed:

- **Start a session from a specific set** (`QuestionSetEditorPage`, same
  place as always — "▶ Start a session with this set") — unchanged
  behavior: plays that whole set's questions, in authored order, with its
  own Chill/Hard toggle.
- **NEW — Start a session outside of sets** (`QuestionSetsPage`, the
  Question Sets list page — "▶ Start a session") — randomly mixes up to
  30 questions pulled from every set at once, with its own Chill/Hard
  toggle. Nothing to pick up front; disabled if there are no questions
  anywhere yet.

Both flows coexist. Which one a session used shows up everywhere a
session is referenced: the mod's host screen title, the "session in
progress" card on the mod dashboard, and the member-facing lobby message
— either the specific set's name, or a "random mix" message.

## Why every session snapshots its questions now

Both flows feed into a new table, `trivia_session_questions`: a copy of
each question actually used in that session, made once at
`create_session` time. This is the same pattern already used for "Type
What You See" (`rebus_session_puzzles`, see 0023). It means:

- One code path for `next_question` / `end_question` /
  `get-current-question` / `trivia-answer`, regardless of which flow
  started the session — none of them had to branch on "does this session
  have a `question_set_id` or not."
- A live session's content can't shift under players if a MOD edits or
  archives a question mid-game.
- Past sessions' history stays intact even if the original authored
  question is later deleted.

`trivia_sessions.question_set_id` is now **nullable** rather than
removed: null = a mixed session, non-null = started from that one
specific set. The column, and its original foreign key (which still
blocks deleting a `question_sets` row a session was started from), are
otherwise unchanged.

## Files

**Migration**
- `supabase/migrations/0025_trivia_mixed_sessions.sql` — makes
  `question_set_id` nullable, adds `trivia_session_questions` (RLS:
  MOD-read-only), retargets `answers.question_id` at the new table using
  a `NOT VALID` foreign key (see note below), adds a supporting index.

**Edge Functions**
- `supabase/functions/_shared/utils.ts` — adds
  `pickTriviaSessionQuestionsForSet` (whole set, authored order) alongside
  the existing `pickTriviaSessionQuestions` (random pick, capped at 30
  across every set), both built on a shared row-mapping helper.
- `supabase/functions/trivia-host/index.ts` — `create_session` now
  branches: a `question_set_id` in the request uses the per-set picker,
  its absence uses the random-mix picker. `next_question`/`end_question`/
  `end_session` needed no changes — they already read `trivia_session_questions`
  by `session_id` alone.
- `supabase/functions/get-current-question/index.ts`,
  `supabase/functions/trivia-answer/index.ts` — included for completeness/
  redeploy; unchanged from what's already running (both already query
  `trivia_session_questions`).

**Frontend**
- `frontend/src/types/index.ts` — `TriviaSession.question_set_id` is
  `string | null`.
- `frontend/src/pages/mod/QuestionSetEditorPage.tsx` — restored: Chill/Hard
  toggle + "▶ Start a session with this set", calling `create_session`
  with `question_set_id`.
- `frontend/src/pages/mod/QuestionSetsPage.tsx` — the new outside-of-sets
  flow: Chill/Hard toggle + "▶ Start a session", calling `create_session`
  with `mode` only (no `question_set_id`).
- `frontend/src/pages/mod/HostSessionPage.tsx` — title shows the specific
  set's name when there is one, else "🧠 Trivia Night — Random Mix".
- `frontend/src/pages/mod/ModDashboardPage.tsx` — "Session in progress"
  card shows the set's name or "Random mix —" before the status/mode
  badges.
- `frontend/src/pages/trivia/TriviaLobbyPage.tsx` — the "a session is
  about to start / in progress" message names the set, or says questions
  are mixed fresh every time.
- `frontend/src/lib/archiveOrDelete.ts` — unchanged from what's already
  running; included for completeness. Delete-protection for a `questions`/
  `question_sets` row now works by checking whether it was ever copied
  into `trivia_session_questions` (`wasQuestionUsed`/`wasQuestionSetUsed`),
  since a real Postgres FK violation no longer fires reliably once
  sessions reference the snapshot table instead of `questions` directly.

## A note on the migration and real production data

Trivia Night already has real history — 57 sessions, 4,320 answers, 787
questions as of today. A plain `ADD CONSTRAINT` retargeting
`answers.question_id` at the brand-new (empty) `trivia_session_questions`
table would fail immediately trying to validate every existing answer
against it. The migration adds that constraint `NOT VALID` instead: new
rows are checked, existing rows are left exactly as they are, and
PostgREST still detects the relationship for the embedded-join queries
that depend on it (`HostSessionPage`'s pending-answers query,
`question_sets(name)` embeds).

This migration was validated against the live project in a rolled-back
transaction before this delivery: it applies cleanly against the real
57/4,320/787 dataset (confirmed `question_set_id` becomes nullable, the
new table appears empty, the new FK is present and not-yet-validated,
and no existing rows are touched), and a full rollback restores the
exact prior state (column back to `NOT NULL`, table gone, all counts
unchanged).

## Deploy steps

```bash
# 1. Apply the migration
npx supabase db push

# 2. Redeploy the three touched edge functions
npx supabase functions deploy trivia-host
npx supabase functions deploy get-current-question
npx supabase functions deploy trivia-answer

# 3. Commit and push the frontend changes
git add supabase/migrations/0025_trivia_mixed_sessions.sql \
        supabase/functions/_shared/utils.ts \
        supabase/functions/trivia-host/index.ts \
        supabase/functions/get-current-question/index.ts \
        supabase/functions/trivia-answer/index.ts \
        frontend/src/types/index.ts \
        frontend/src/lib/archiveOrDelete.ts \
        frontend/src/pages/mod/QuestionSetEditorPage.tsx \
        frontend/src/pages/mod/QuestionSetsPage.tsx \
        frontend/src/pages/mod/HostSessionPage.tsx \
        frontend/src/pages/mod/ModDashboardPage.tsx \
        frontend/src/pages/trivia/TriviaLobbyPage.tsx
git commit -m "Add random mixed-session option to Trivia Night, alongside per-set sessions"
git push
```

Vercel will redeploy the frontend automatically on push.

## Playtest checklist

- [ ] From a question set's editor page, start a session ("▶ Start a
      session with this set") — confirm it still plays only that set's
      questions, in order, and the host screen title shows the set's name.
- [ ] From the Question Sets list page, start a session ("▶ Start a
      session") — confirm it pulls a random mix of up to 30 questions
      from across every set, and the host screen title reads "🧠 Trivia
      Night — Random Mix".
- [ ] Confirm both flows respect their own Chill/Hard toggle.
- [ ] Confirm the mod dashboard's "Session in progress" card and the
      member-facing Trivia Night lobby both correctly show the set name
      for a per-set session, and a "random mix" message for a mixed one.
- [ ] Try deleting a question that's been used in a past session of
      either type — confirm it archives instead of hard-deleting.
- [ ] With fewer than 30 total questions across all sets, confirm a mixed
      session just uses however many exist rather than erroring.
