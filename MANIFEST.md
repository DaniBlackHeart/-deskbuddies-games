# Type What You See — fixed the Hard import that "did nothing"

Frontend + one Edge Function. 5 files (1 new, 4 changed).

## Root cause

Confirmed against your project's live Postgres logs (`duplicate key value
violates unique constraint "rebus_puzzles_active_order_idx"`, logged
several times matching your retries): Supabase caps every `.select()` at
1000 rows per request, silently — it doesn't error, it just hands back the
first 1000 and nothing after. Your Visual Arrangement set has 1018 active
puzzles (357 Easy + 661 Medium), so the set editor's `loadData()` was only
ever seeing puzzles 0–999, not the real last 18. That made it think the
set's next free order slot was 1000, when the true next slot was 1018 —
so the moment you tried to import 343 Hard puzzles starting at "1000," 18
of them collided with puzzles that already existed there. Postgres
rejected the whole batch as one transaction, so 0 puzzles got saved, and
the code only `console.error`'d it instead of showing you anything — which
is exactly why it looked like the button just did nothing, on the first
try and every retry after.

Nothing was left half-imported — confirmed your Hard round is still at 0
puzzles, so this is a clean retry once this ships, not a cleanup job.

## The bigger thing this surfaced

The same "bare `.select()` past 1000 rows" pattern existed in three other
spots, and one of them affects actual live games, not just this screen:

- **`pickRebusSessionPuzzles` (the Edge Function that builds every Rebus
  session's puzzle pool)** was fetching *every* active puzzle
  system-wide with no pagination — and you now have 4,645 active puzzles
  across all your sets, over four and a half times the cap. That means
  every warmup/round2/round3/final draw for every session has been
  sampling from only ~1000 of those 4,645 puzzles (whichever page
  Postgres happened to return), not the full pool. Most of your authored
  puzzles have likely never had a chance to show up in an actual session.
  This is fixed now and will take full effect once `rebus-host` is
  redeployed (command below).
- `wasRebusSetUsed` and `renumberActiveRebusPuzzles` (the internals behind
  every single delete, restore, and the bulk delete from last time) had
  the same gap — for a set over 1000 active puzzles specifically, a delete
  today could renumber only the first 1000 and leave the rest with stale
  order_index, or wrongly hard-delete a puzzle that had actually been
  played. Visual Arrangement is the only set at risk of this right now,
  but it's fixed for any set that grows past 1000 going forward.

All four are fixed with one small shared helper (`fetchAllRows.ts` on the
frontend, an equivalent in the Edge Function's `_shared/utils.ts`) that
pages through 1000 rows at a time until there's nothing left, instead of
trusting a single `.select()` to return everything.

## Also fixed: imports fail loudly now

Separately from the root cause — if a puzzle import ever fails for any
reason (this one included), the import modal now shows the actual error
on screen instead of silently closing or sitting there. No more
"nothing happens."

## Validated against your real production data

- Confirmed via your project's Postgres logs that the actual failure was
  the duplicate-key error above, not a frontend crash or a parsing issue.
- Confirmed Visual Arrangement currently has exactly 1018 active puzzles
  (357 Easy, 661 Medium), contiguous order_index 0–1017, 0 archived — so
  the fix will start your next Hard import cleanly at order_index 1018.
- Confirmed 0 Hard puzzles exist on that set right now — none of your
  failed attempts left partial data behind.
- Confirmed system-wide active puzzle counts: 4,645 in `rebus_puzzles`,
  1,130 in `impostor_words` (Impostor WHO? has crossed 1000 too — flagging
  that one for a separate look since it's a different game's table, not
  touched in this fix).

`tsc -b`, `oxlint`, and `vite build` all ran clean on the frontend changes.

## Files

- `frontend/src/lib/fetchAllRows.ts` — new. Pages through a Supabase
  select 1000 rows at a time until it has everything.
- `frontend/src/lib/archiveOrDelete.ts` — `wasRebusSetUsed` and
  `renumberActiveRebusPuzzles` now use it; so does `deleteRebusPuzzlesByRound`
  for the same reason, even though no single difficulty has hit 1000 yet.
- `frontend/src/pages/mod/RebusSetEditorPage.tsx` — `loadData()` now
  fetches the full puzzle and sprint lists via the helper; `handleImportConfirm`
  now throws a real error message instead of swallowing it.
- `frontend/src/components/RebusImportModal.tsx` — shows that error on
  screen if an import fails.
- `supabase/functions/_shared/utils.ts` — `pickRebusSessionPuzzles` and
  `pickRebusSessionSprintPuzzles` now page through the full active pool
  instead of only the first 1000 rows.

## Deploy

```bash
git add frontend/src/lib/fetchAllRows.ts frontend/src/lib/archiveOrDelete.ts frontend/src/pages/mod/RebusSetEditorPage.tsx frontend/src/components/RebusImportModal.tsx supabase/functions/_shared/utils.ts
git commit -m "Fix Rebus import failing silently past 1000 puzzles, and the same row-cap bug in session puzzle picking"
git push
npx supabase functions deploy rebus-host
```

Vercel redeploys the frontend automatically on push. The last command is
the important one this time — the session-puzzle-picking fix lives in
`_shared/utils.ts`, and Edge Functions only pick up a shared-file change
when the function that uses it gets redeployed; `rebus-host` is the only
function that calls `pickRebusSessionPuzzles`/`pickRebusSessionSprintPuzzles`,
so that's the one to deploy. No migration needed — no schema changed.
