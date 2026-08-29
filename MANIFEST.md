# Add a back button to the MOD management pages

**Date:** 2026-08-29

## What Dani asked for

A back button on the 6 pages reached from the MOD Dashboard's tiles: Question Sets, Family Feud
Sets, Hosting UNO, Impostor Categories, Wheel of Fortune, and Type What You See. The only way back
before this was the generic "🛠️ MOD Dashboard" link in the top-right of `AppHeader` — it works, but
it's a standing nav item, not something that reads as "go back from here."

## The fix

New shared component, `src/components/BackToModDashboardLink.tsx`:

```tsx
<Link to="/mod" className="btn btn-ghost btn-sm" style={{ padding: 0, marginBottom: "12px", display: "inline-block" }}>
  ← Back to MOD Dashboard
</Link>
```

Styled like the app's other low-emphasis ghost buttons (e.g. ModDashboardPage's own
"Troubleshooting" toggle) — a plain text link with an arrow, not a heavy button, since it's a
secondary affordance sitting right above the page's real title.

Added it as the first thing inside `.container`, right above the `<h1>`, on all 6 pages:

- `QuestionSetsPage.tsx`
- `FeudSetsPage.tsx`
- `HostUnoSessionPage.tsx`
- `ImpostorCategoriesPage.tsx`
- `WheelCategoriesPage.tsx`
- `RebusSetsPage.tsx`

One shared component reused 6 times rather than 6 copies of the same `<Link>` markup, per the
project's "shared UI goes in `src/components/`" convention.

## Validation

- `npx tsc -b` — clean
- `npx oxlint` on the changed files — clean
- `npx vite build` — clean. Since each of these 6 pages already lives inside its game's
  `.bundle.ts` (per the code-splitting setup), the shared link component correctly split into its
  own tiny standalone chunk (`BackToModDashboardLink-*.js`, 0.24kB) rather than getting duplicated
  into every game bundle — same deduping behavior as `Buzzer`/`Timer`/etc. Per-game chunk sizes
  otherwise unchanged.

## Files changed

- `frontend/src/components/BackToModDashboardLink.tsx` (new)
- `frontend/src/pages/mod/QuestionSetsPage.tsx`
- `frontend/src/pages/mod/FeudSetsPage.tsx`
- `frontend/src/pages/mod/HostUnoSessionPage.tsx`
- `frontend/src/pages/mod/ImpostorCategoriesPage.tsx`
- `frontend/src/pages/mod/WheelCategoriesPage.tsx`
- `frontend/src/pages/mod/RebusSetsPage.tsx`

## Deploy steps

```bash
git add frontend/src/components/BackToModDashboardLink.tsx \
  frontend/src/pages/mod/QuestionSetsPage.tsx \
  frontend/src/pages/mod/FeudSetsPage.tsx \
  frontend/src/pages/mod/HostUnoSessionPage.tsx \
  frontend/src/pages/mod/ImpostorCategoriesPage.tsx \
  frontend/src/pages/mod/WheelCategoriesPage.tsx \
  frontend/src/pages/mod/RebusSetsPage.tsx
git commit -m "feat: add a back-to-MOD-Dashboard link on each MOD management page"
git push
```

Frontend-only — no Supabase migration or Edge Function changes needed.

## What to check on the next look

- [ ] Open each of the 6 pages from the MOD Dashboard tiles and confirm "← Back to MOD Dashboard"
      appears above the title and returns to `/mod`
- [ ] Confirm it doesn't crowd the existing header row (e.g. Impostor Categories'/Wheel of
      Fortune's wrapping "Import categories"/"New category" buttons)
