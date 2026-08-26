# MANIFEST — fix: spin animation was getting cut short, and the wheel landed nowhere real

Frontend-only, three files. Merge into your repo root with `cp -r`.

## Bug 1 — Bankrupt/Lose a Turn revealed the next turn before the wheel stopped spinning

Those two wedges resolve server-side the instant the spin lands — no
consonant call, no player choice, nothing in between. The very next
broadcast (whose turn it is now) could arrive within milliseconds of the
spin result, well before the ~2.3s spin animation actually finished. Every
other wedge (points, Wild Card, Free Play, Mystery) is naturally immune to
this because they all require a distinct follow-up action from a real
person first.

**Fixed**: a small deferred-action queue in both `WheelPlayPage` and
`WheelSpectatorPage`. While a spin's reveal is still pending, the
"turn ended/passed/timed out/round ended" events queue their work instead
of running it immediately, and the queue drains the moment the spin's own
timeout completes.

## Bug 2 — the wheel didn't land on its own announced outcome

The wheel was explicitly built to spin to a decorative random angle,
trusting the text result below it to carry the real information. Your
screenshot showed why that's not good enough — the arrow stopped between
wedges, unrelated to what the game was announcing.

**Fixed**: `WheelSpinner` now takes the real wedge as a `targetWedge` prop
and computes the exact rotation needed to land a matching wedge (same
type, same value where relevant — picked at random among ties, e.g. one
of the four 500-point wedges) precisely under the pointer. Always spins
forward from wherever it currently sits, plus a few extra full turns for
flourish, so it never looks like it snapped backward.

## What changed

- `frontend/src/components/WheelSpinner.tsx` — real wedge-landing math
- `frontend/src/pages/wheel/WheelPlayPage.tsx` — deferred-action queue,
  passes the real wedge into the spinner
- `frontend/src/pages/mod/WheelSpectatorPage.tsx` — same two fixes,
  mirrored for the spectator view
- `PROJECT_CONTEXT.md` — correction log (§6c-iv) with the full writeup

## Commit

```bash
cd deskbuddies-games
git add .
git commit -m "fix: hold spin outcomes until the wheel actually stops, and land it on the real wedge"
git push
```

Frontend-only — no `supabase db push`, no function redeploy.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery).

The general "lag" you mentioned may well have been a symptom of Bug 1 —
the board jumping to a new state mid-animation reads as jank/lag even
though nothing was actually slow. Worth checking if it's gone once this
is in; let me know if something separate is still there.
