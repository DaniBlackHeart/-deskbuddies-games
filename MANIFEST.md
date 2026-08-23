# MANIFEST — fix: Wheel of Fortune wasn't releasing the session lock on natural game-end

One backend function change. Merge into your repo root with `cp -r`.

## What was actually wrong

This wasn't a missing button — it was a real bug. Every other game's
`-play` function releases `active_session_lock` when the game ends on its
own (not via a MOD's manual cancel): `impostor-play` does it on both
`vote_resolved` branches, `uno-play` does it on the winning play.
`wheel-play` never did this at all — the lock was only ever released from
`wheel-host`'s `end_session` (the MOD's manual "End game" button).

Since resolving the Bonus Round is the *only* way a Wheel session ends
naturally, every completed game left `active_session_lock` stranded — the
game looked finished (results screen, "🎉 so-and-so won!", all of it), but
the lock table still pointed at it, silently blocking any new session
(Wheel or otherwise — the lock is cross-game) from starting until a MOD
happened to use "Force-clear stuck session lock" in Troubleshooting, with
no indication on the Wheel host screen that anything needed doing.

## What changed

- **`supabase/functions/wheel-play/index.ts`** — added `releaseSessionLock`
  (imported from `_shared/utils.ts`, same helper every other game uses),
  called right after `bonus_solve`/`bonus_solve_timeout` sets
  `status: 'ended'` — the exact same placement pattern as `uno-play` and
  `impostor-play`.

No new UI was added on purpose: like every other game, ending naturally
releases the lock automatically and silently. There was never meant to be
a visible "end session" button for a game that's already over — the fix
is that the game now actually *finishes* releasing everything it holds
when it ends, same as the rest of the catalogue.

## Deploy

```bash
cd deskbuddies-games

npx supabase functions deploy wheel-play

git add .
git commit -m "fix: release the session lock when a Wheel of Fortune game ends naturally"
git push
```

No migration needed.

**If you have a game that already finished before this fix** (lock
possibly still stranded from earlier testing): MOD Dashboard →
Troubleshooting → "Force-clear stuck session lock" will clear it — this
existing escape hatch doesn't need any changes, it already works for any
game's stranded lock.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings,
`wheel-play` type-checked clean with `deno check` (same pre-existing
`Deno.serve` quirk as every other function, nothing new).
