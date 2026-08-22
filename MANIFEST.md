# MANIFEST — fix: wheel text orientation + evenly-spaced special wedges

Two real bugs in the wheel graphic, not cosmetic nitpicks. Merge into your
repo root with `cp -r`.

## What was wrong

1. **Text rotation was inverted.** The label rotation math aligned each
   wedge's text with its *tangent* instead of its *radius* — so labels at
   the top/bottom of the wheel rendered near-horizontal (should be
   vertical, reading outward along the spoke) and labels at the sides
   rendered vertical (should be horizontal). Backwards from how a real
   prize wheel reads.
2. **Special wedges were genuinely clustered.** Bankrupt/Lose a Turn/Free
   Play/Wild Card/Mystery weren't evenly spread — 4 of the 6 sat within an
   8-slot span while most of the rest of the wheel had none at all.

## What's fixed

1. **`frontend/src/components/WheelSpinner.tsx`** — rotation now uses
   `midAngle - 90` (the correction needed to redirect SVG's default
   horizontal text along this wedge's own radius) instead of `midAngle`
   directly, with the same upside-down-avoidance flip as before. Top/
   bottom wedges now render vertically, side wedges horizontally, like a
   real wheel.
2. **`supabase/functions/_shared/utils.ts`** (`WHEEL_WEDGES`) and
   **`frontend/src/lib/wheelConstants.ts`** (`WHEEL_WEDGE_LAYOUT`) —
   reordered so all 6 specials sit exactly every 4th slot (60° apart),
   each with a mirror-opposite special directly across the wheel
   (Bankrupt ↔ Wild Card, and so on). **Order doesn't affect actual
   odds** — `spinWheel()` picks uniformly at random regardless of
   arrangement — this is purely a layout fix. Point-value frequencies
   (18 wedges, 300-900) were preserved as closely as reasonable; both
   arrays are still byte-identical to each other, same as before.

## Deploy order (Supabase before frontend)

```bash
cd deskbuddies-games

npx supabase functions deploy wheel-play

git add .
git commit -m "fix: correct wheel label rotation and evenly space the special wedges"
git push
```

Only `wheel-play` actually references the wedge table (`wheel-host`
doesn't spin the wheel), so that's the only function that needs
redeploying even though `_shared/utils.ts` changed. No migration needed.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings,
`wheel-play` and `wheel-host` both type-checked clean with `deno check`
(same pre-existing `Deno.serve` quirk as every other function). Also
confirmed programmatically: both wedge arrays are still exactly 24 items,
byte-identical to each other, and the 6 specials land at indices
0/4/8/12/16/20 — evenly spaced with no gaps.
