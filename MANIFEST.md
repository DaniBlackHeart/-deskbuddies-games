# Delivery manifest — Type What You See: mixed random sessions

**Date:** 2026-08-29
**What changed:** Sessions no longer belong to one specific `rebus_set`.
Starting a session now automatically pulls a random mix of puzzles from
**every** set at once (up to 10 each for Warm-Up/Round 2/Round 3, 1 Final
Round puzzle if any exist, the whole combined Sprint pool) — the same
"nothing to pick up front" spirit as Wheel of Fortune's category
randomizer. Chill/Hard and Solo/Team moved off each individual set's page
onto one shared "Type What You See" landing screen. Sets go back to being
pure puzzle-authoring containers.

Confirmed with Dani before writing any schema (see the addendum below) —
same discipline as every other design decision in this project.

## Files in this delivery

All changes are **additive to the existing files** — nothing was removed
from any other game.

```
supabase/migrations/0023_rebus_mixed_sessions.sql   [NEW]
supabase/functions/_shared/utils.ts                 [MODIFIED]
supabase/functions/rebus-host/index.ts               [MODIFIED]
supabase/functions/rebus-play/index.ts                [MODIFIED]
supabase/functions/get-rebus-state/index.ts            [MODIFIED]
frontend/src/types/index.ts                          [MODIFIED]
frontend/src/lib/archiveOrDelete.ts                    [MODIFIED]
frontend/src/pages/mod/RebusSetsPage.tsx                [MODIFIED]
frontend/src/pages/mod/RebusSetEditorPage.tsx            [MODIFIED]
frontend/src/pages/mod/HostRebusSessionPage.tsx           [MODIFIED]
frontend/src/pages/mod/ModDashboardPage.tsx                [MODIFIED]
frontend/src/pages/rebus/RebusLobbyPage.tsx                  [MODIFIED]
```

## Deploy order

Same rule as always — Supabase steps before the frontend push, so a live
frontend never calls a function or expects a column that isn't deployed
yet:

```bash
cd supabase   # or wherever your project root is
npx supabase db push
npx supabase functions deploy rebus-host
npx supabase functions deploy rebus-play
npx supabase functions deploy get-rebus-state
```

Then merge the frontend files into `frontend/src/...` (they replace the
existing rebus-related files 1:1 — same paths) and:

```bash
cd frontend
npx tsc -b        # 0 errors, confirmed
npx oxlint        # 6 warnings, same project baseline, confirmed
npx vite build    # succeeds, confirmed (only the pre-existing bundle-size advisory)
git add .
git commit -m "feat: mix Type What You See puzzles across all sets, move mode/start out of sets"
git push
```

## Why a migration file, not an edit to 0021

`0021_rebus_game.sql` already shipped and (per PROJECT_CONTEXT.md) has
been played — editing an applied migration in place doesn't work with
`supabase db push`'s tracking. `0023` is additive: it drops
`rebus_sessions.rebus_set_id` (meaningless now that a session mixes every
set), adds two new snapshot tables, and retargets two foreign keys. See
the migration file's own header comment for the full reasoning, especially
**why a snapshot table instead of just recording which puzzles got
picked** — it's what keeps a live session immune to a MOD editing/
archiving/deleting puzzles in any set while a game is in progress, and as
a side effect keeps past sessions' history intact even if the original
authored puzzle is later deleted outright.

## Suggested first playtest

This is a behavior change to an already-shipped, already-playtested game,
not a brand new one — but the puzzle-selection and delete/archive paths
are genuinely new code, worth specifically exercising:

1. From the "Type What You See" landing page (no sets clicked into),
   confirm Chill/Hard + Solo/Team + Start all work with puzzles spread
   across **two or more different sets** — confirm the actual session
   shows a mix, not just one set's content.
2. Run a full game through to the Final Round and confirm it plays even
   though the Final Round puzzle came from a different set than most of
   the Round 1-3 puzzles.
3. Mid-session (while it's live), go edit/archive/delete an unrelated
   puzzle in some other set and confirm the live session is completely
   unaffected.
4. Delete a puzzle that HAS been used in a past session — confirm it
   archives (friendly message) instead of vanishing; delete one that's
   NEVER been used — confirm it just deletes cleanly.
5. Same two checks, one level up, for deleting a whole set.
6. Start a session with zero Sprint puzzles authored anywhere — confirm
   "Set up the Sprint Round" surfaces the right error instead of a crash.
7. Start a session with zero Final Round puzzles authored anywhere —
   confirm the Sprint-done screen's existing "no Final Round puzzle"
   messaging still shows correctly (now describing the whole pool, not
   one set).
