# MANIFEST — fix: remove Wheel Categories page subtitle

Frontend-only, one-file change. Merge into your repo root with `cp -r`.

## What changed

- **`frontend/src/pages/mod/WheelCategoriesPage.tsx`** — removed the hint
  line under the "Wheel of Fortune" heading ("Each round reveals a random
  category and a random phrase from within it — same idea as Impostor
  WHO?'s categories."). Everything else on the page is unchanged.

## Commit

```bash
cd deskbuddies-games
git add .
git commit -m "fix: remove Wheel Categories page subtitle"
git push
```

Frontend-only — no `supabase db push`, no function redeploy.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery).
