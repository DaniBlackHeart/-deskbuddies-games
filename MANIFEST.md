# MANIFEST — fix: Wheel of Fortune's two dashboard tiles → one

Frontend-only, no Supabase changes. Merge into your repo root with `cp -r`,
same as any other delivery.

## What was wrong

I gave Wheel of Fortune two separate MOD Dashboard tiles ("Wheel
Categories" that opened the category list, and "Wheel of Fortune" that
started a session directly). Every other game with MOD-authored content
(Impostor WHO?) has exactly **one** tile that opens its content page, with
the "start a game" action living on that page itself. Wheel should've
followed the same pattern from the start — this brings it in line.

## What changed

- **`frontend/src/pages/mod/ModDashboardPage.tsx`** — removed the second
  "Wheel of Fortune" direct-start tile (and its now-unused `startingWheel`
  state/`handleStartWheel` handler). The remaining tile is renamed "Wheel
  of Fortune" (was "Wheel Categories") with copy matching Impostor WHO?'s
  exactly: "Manage categories and phrases, then start a session from
  inside one."
- **`frontend/src/pages/mod/WheelCategoriesPage.tsx`** — added a "▶ Start
  new game" card at the top, mirroring Impostor Categories' "🎲 Start with
  random category" card exactly (same placement, same disabled-when-empty
  behavior). This is where starting a game now actually happens.

## Deploy

```bash
cd deskbuddies-games
git add .
git commit -m "Fix: consolidate Wheel of Fortune's dashboard tiles into one"
git push
```

Frontend-only change — no `supabase db push`, no function redeploy needed.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as before).
