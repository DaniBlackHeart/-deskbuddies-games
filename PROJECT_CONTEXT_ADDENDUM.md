## Addendum — Type What You See: mixed random sessions (2026-08-29)

Sections to merge into `PROJECT_CONTEXT.md` (in the Project Knowledge
copy, §6d already covers rebus's original shipped design — this addendum
supersedes the "how a session gets its puzzles" and "Chill/Hard, Solo/Team"
parts of it without contradicting the rest).

### What changed and why

Dani asked for three things, confirmed as one cohesive redesign before any
schema was written (same discipline as every other game):

1. **"Rounds automatic"** — starting a session no longer means a MOD
   picking one specific `rebus_set` and playing its hand-curated Round
   1/2/3/Final list top to bottom. The system now randomly assembles each
   round's puzzles itself.
2. **Chill/Hard and Solo/Team move outside the sets** — off each
   individual set's page (where they lived alongside a per-set "Start a
   session" button) and onto one shared landing screen, explicitly
   modeled on `WheelCategoriesPage`'s "nothing to pick up front" pattern.
3. **Sessions mix questions from all sets, not one** — confirmed as
   "always combine every active set," no MOD multi-select step.

Four design forks were asked and confirmed with Dani before writing any
code (not guessed at, matching the standing discipline for every prior
game in this project):

- Automatic = auto-select puzzles per round (not round-advance pacing).
- Sets keep their existing Round 1/2/3/Final/Sprint tabs for
  **authoring** puzzles — only the mode toggles and Start button moved.
  Puzzle content shape didn't change at all.
- A session always combines every active set (no per-session set
  picker).
- Puzzle counts per round stay the original fixed defaults: up to 10 each
  for Warm-Up/Round 2/Round 3, 1 Final Round puzzle if any exist
  anywhere, and the whole combined Sprint pool for Round 4.

### The schema decision: snapshot, not just a random pick

Migration `0023_rebus_mixed_sessions.sql`. The tempting minimal version —
just record which existing `rebus_puzzles` rows got randomly picked for a
session — was rejected in favor of copying the full puzzle content into
two new session-scoped tables, `rebus_session_puzzles` and
`rebus_session_sprint_puzzles`, at `create_session` time:

- A live session's content now has to survive a MOD editing, archiving,
  or deleting puzzles in **any** set (including ones the session is
  actively drawing from) while the game is in progress — snapshotting
  decouples a live game from the authoring tables the instant it starts.
  Same defensive instinct as `rebus_sprint_answers` keying off pool
  POSITION instead of a row id (§4's anti-cheat section, unchanged).
- Real side benefit: past sessions' history/leaderboards stay intact even
  if the original authored puzzle is later deleted outright, since the
  session's own copy of the text never depended on that row still
  existing.
- `rebus_answers.puzzle_id` and `rebus_sessions.final_puzzle_id` were
  retargeted from `rebus_puzzles(id)` to `rebus_session_puzzles(id)` —
  what a player "answered" is now literally the session's own snapshot
  row, not the original authored one.
- `rebus_session_puzzles` is MOD-read-only (same anti-cheat posture as
  `rebus_puzzles` — it carries `answer_text`/`accepted_answers` before
  reveal). `rebus_session_sprint_puzzles` has **zero** client policies at
  all — same "defense in depth" shape as `uno_deck_state`/
  `active_session_lock` (§4/§7) — since Sprint content was never shown to
  anyone, including a spectating MOD, before this change either.
- `rebus_sessions.rebus_set_id` was dropped outright — a session no
  longer belongs to one set, so the column stopped meaning anything.

### A real behavior change this unlocked, worth knowing about

Before this migration, deleting a puzzle or set that had ever been played
relied on Postgres rejecting the hard `DELETE` with a foreign-key
violation (`rebus_answers.puzzle_id` RESTRICTing on `rebus_puzzles`),
caught in `archiveOrDelete.ts` and silently converted to an archive. Once
`rebus_answers.puzzle_id` pointed at the snapshot table instead, that FK
violation stops ever firing — hard-deleting a previously-played puzzle
would have started succeeding immediately, silently dropping the
"protect content with real history" UX Dani never asked to lose.

Fixed by reimplementing the same protection explicitly rather than
leaning on an incidental DB error: `wasRebusPuzzleUsed`/`wasRebusSetUsed`
in `archiveOrDelete.ts` check whether a puzzle/set was ever copied into
any session's `rebus_session_puzzles` (`source_puzzle_id`), live or long
since ended, and archive instead of delete when it was. Worth remembering
as a pattern: **switching a table's FK target can silently disable an
archive-vs-delete safety net that was leaning on that specific
constraint** — this is the second time in this project a delete-fallback
turned out to be implicit rather than explicit (see §7's other lessons);
worth grepping for `FOREIGN_KEY_VIOLATION`/`23503` catches before
retargeting any other FK in the future.

### Migration history — add to §6's table

| # | Contents | Confidence |
|---|---|---|
| 0023 | Rebus mixed random sessions (drops `rebus_sessions.rebus_set_id`; adds `rebus_session_puzzles`/`rebus_session_sprint_puzzles` snapshot tables; retargets `rebus_answers.puzzle_id` and `rebus_sessions.final_puzzle_id` to the new snapshot table) — see this addendum | confirmed — full file delivered |

### Validation performed

`npx tsc -b` — 0 errors. `npx oxlint` — 6 warnings, same existing project
baseline, no new warnings introduced. `npx vite build` — succeeds (only
the pre-existing bundle-size advisory). Edge Functions reviewed by hand
against `_shared/utils.ts`'s actual exported signatures (no Deno runtime
available in the delivery environment, same limitation as the original
rebus build). **Not yet playtested end-to-end against a live Supabase
project** — see MANIFEST.md's suggested first-playtest sequence,
specifically the "edit an unrelated set mid-session" and "delete a
used-vs-unused puzzle" checks, since those exercise genuinely new code
paths rather than just a rearranged UI.
