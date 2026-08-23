# MANIFEST — Wheel of Fortune: bigger wheel graphic (1.5x)

Frontend-only, two files. Merge into your repo root with `cp -r`.

## What changed

- **`frontend/src/components/WheelSpinner.tsx`** — `SIZE` bumped from 260
  to 390 (1.5x). Font sizes and stroke widths are now computed as ratios
  of `SIZE` (matching the original design's proportions) instead of fixed
  numbers, so text and borders scale up with the wheel instead of looking
  undersized against the bigger wedges.
- **`frontend/src/styles/global.css`** — `.wheel-spinner` container,
  `.wheel-spinner__hub`, and `.wheel-spinner__pointer` all scaled 1.5x to
  match. Mobile's `max-width`/`max-height` cap nudged from 90vw to 92vw so
  it gets a bit closer to the full size on narrow screens too.

## Commit

```bash
cd deskbuddies-games
git add .
git commit -m "feat: increase Wheel of Fortune's wheel graphic size by 1.5x"
git push
```

Frontend-only — no `supabase db push`, no function redeploy.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery).
