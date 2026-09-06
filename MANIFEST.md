# Type What You See — bulk delete per difficulty

Frontend-only, no migration, no edge function change. 2 files.

## What changed

Each difficulty tab (Easy/Medium/Hard/Final Round) on the set editor now
has a "🗑 Delete all {difficulty} (N)" button, next to "+ Add puzzle
manually" / "📋 Import / paste puzzles". Confirms with the exact count
before doing anything, then removes every active puzzle in that
difficulty for that set in one action instead of one Delete click at a
time.

Same archive-vs-delete rule as a single delete: a puzzle already played
in a past session gets archived, not lost — the summary message says how
many of each ("Deleted 340 puzzles. 17 had already been played in a
session, so they were archived instead — you can restore them from
'Show archived' below."). Archived puzzles stay visible under that tab's
"Show archived" section afterward.

Implementation-wise this batches instead of doing N round-trips: one
query to list the difficulty's active puzzle ids, one to check which of
them were ever played (`rebus_session_puzzles.source_puzzle_id`), then
one bulk archive + one bulk delete, then a single renumber pass — versus
one full delete-then-renumber cycle per puzzle, which would be very slow
for a set with hundreds of puzzles in one difficulty.

## Validated against your real production data

Ran the exact query sequence (not a reimplementation) against your
"Visual Arrangement" set (`75b4fc6c-026b-4660-a6c8-91751baf1bc1`) inside
a rolled-back transaction on the live database:

- Before: 357 active Easy puzzles on that set, 661 active Medium, 2,661
  active puzzles across every other set.
- After the bulk operation: 0 remaining active Easy puzzles on that set
  (0 archived — none of them had been played in a session yet, so all
  357 went to a clean hard delete), Medium still at 661 untouched, every
  other set's 2,661 puzzles untouched.
- Rolled back cleanly — confirmed the Easy count is back to 357
  afterward.

`tsc -b`, `oxlint`, and `vite build` all ran clean on both files.

## Files

- `frontend/src/lib/archiveOrDelete.ts` — new `deleteRebusPuzzlesByRound(rebusSetId, round)`,
  the batched bulk-delete function.
- `frontend/src/pages/mod/RebusSetEditorPage.tsx` — the new button,
  confirm dialog, and result message; also pulled the repeated
  "find the active difficulty's group" logic into one `activeGroup`
  variable used by the button, the puzzle list, and the archived section
  (no behavior change there, just cleanup while I was in the file).

## Deploy

```bash
git add frontend/src/lib/archiveOrDelete.ts frontend/src/pages/mod/RebusSetEditorPage.tsx
git commit -m "Add bulk delete per difficulty to the rebus set editor"
git push
```

No migration or function deploy needed — Vercel picks it up on push.
