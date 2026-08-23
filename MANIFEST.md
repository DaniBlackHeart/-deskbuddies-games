# MANIFEST — Wheel of Fortune: add the wheel graphic to the spectator view

Frontend-only, one file. Merge into your repo root with `cp -r`.

## What's new

Spectators now see the actual spinning wheel graphic when a player spins,
not just a text status line. Wired to the same `spin_result` timing the
player screen uses — the wheel animates for the full ~2.3s before the
result (and the board update it causes) shows up, so spectators don't see
the outcome leak in before the wheel visually finishes.

The letter tracker added last time was already live on this screen — this
just adds the missing wheel visual alongside it.

## What changed

- **`frontend/src/pages/mod/WheelSpectatorPage.tsx`** — replaced the
  single "hydrate on any broadcast" wildcard with a dedicated
  `spin_result` handler (delayed hydrate, same pattern as
  `WheelPlayPage`) plus a wildcard for everything else that explicitly
  skips re-handling `spin_result`. Added `WheelSpinner` to the round
  status card, shown whenever someone holds the floor. Clears the
  displayed wedge result on a new round or whenever the turn changes
  hands, so a stale result from the previous player never lingers.

## Commit

```bash
cd deskbuddies-games
git add .
git commit -m "feat: show the spinning wheel graphic in the Wheel of Fortune spectator view"
git push
```

Frontend-only — no `supabase db push`, no function redeploy.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery).
