# Fix: uneven MOD Dashboard tile heights

**Date:** 2026-08-29

## What Dani reported

Two screenshots: the MOD Dashboard's 6 game-management tiles, and the regular member "Game Night"
dashboard's 6 game tiles. On the MOD Dashboard the tile bottoms don't line up — one row looks
ragged where the member dashboard's stays perfectly even.

## Root cause

The member `DashboardPage.tsx` builds its 6 tiles from the shared `GameCard` component, which sets
`height: "100%"` on its `.card` div (and `display: "block"` on the wrapping `Link`). In a CSS grid,
items stretch to match the tallest item in their row by default (`align-items: stretch`) — `GameCard`
opts into that, so every tile in a row grows to match its tallest neighbor regardless of how much
text it holds.

`ModDashboardPage.tsx` never used `GameCard` for its own 6 tiles — it hand-duplicated the same
markup inline instead (a project convention violation: "Shared UI goes in `src/components/`, reused
rather than duplicated"). Its copy was missing `height: "100%"`, so each card only grew to fit its
own content. "Type What You See" has the longest description ("Author rebus puzzles across all four
rounds — every session automatically mixes them from all your sets."), so it wraps to more lines
than its row-mates — and since nothing was stretching to match, only that tile grew taller while the
others stayed short, producing the ragged row Dani saw.

## The fix

Extended `GameCard` to support a second usage mode alongside its existing `to`-based Link mode:

- `to` is now optional; a new `onClick?: () => void` prop renders the card as a clickable,
  keyboard-accessible `div` (`role="button"`, `tabIndex`, Enter/Space handling) instead of a `Link`.
- A new `busy?: boolean` prop shows a "working on it" state (wait cursor, dimmed, clicks ignored) —
  distinct from the existing `disabled` (permanently off) state.
- Existing `to`-based usages (all 6 cards in `DashboardPage.tsx`) are unaffected — nothing about
  their props or rendered output changed.

Then rewrote `ModDashboardPage.tsx`'s tile grid to use `<GameCard>` for all 6 tiles instead of
hand-rolled markup:

- Question Sets, Feud Sets, Impostor WHO?, Wheel of Fortune, Type What You See — plain `to`-based
  cards, same links/emojis/copy as before.
- UNO — the one tile that starts a session on click rather than linking anywhere — now uses
  `onClick={handleStartUno}` with `busy={startingUno}`, preserving its exact existing behavior
  (guards against double-clicks while a session is being created, shows "Starting a new game…" in
  place of the normal description while in flight).

Every tile now goes through the same component, so they'll always stay visually consistent with
each other and with the member dashboard going forward — this can't drift out of sync again the way
the hand-duplicated markup did.

## Files changed

- `frontend/src/components/GameCard.tsx` — extended props (`to` optional, new `onClick`/`busy`)
- `frontend/src/pages/mod/ModDashboardPage.tsx` — tile grid now built from `<GameCard>`

`frontend/src/pages/DashboardPage.tsx` was read to confirm its 6 existing usages stay fully
backward-compatible, but was not changed.

## Validation

- `npx tsc -b` — clean
- `npx oxlint` on the changed files — clean
- `npx vite build` — clean; per-game chunk sizes unchanged from the code-splitting work
  (`uno.bundle` 28.71kB, `impostor.bundle` 47.63kB, `trivia.bundle` 48.56kB, `feud.bundle` 63.50kB,
  `wheel.bundle` 67.35kB, `rebus.bundle` 77.63kB, `ModDashboardPage` 9.91kB) — this change doesn't
  touch the barrel-file/lazy-loading setup at all

## Deploy steps

```bash
git add frontend/src/components/GameCard.tsx frontend/src/pages/mod/ModDashboardPage.tsx
git commit -m "fix: MOD dashboard tiles reuse GameCard so row heights stay even, matching the member dashboard"
git push
```

Frontend-only — no Supabase migration or Edge Function changes, no `supabase db push` needed. Vercel
will pick it up on push as usual.

## What to check on the next look

- [ ] Open the MOD Dashboard — confirm all 6 tiles in the bottom row have matching heights,
      even though "Type What You See"'s description is the longest
- [ ] Click the UNO tile — confirm it still starts a session and shows "Starting a new game…" while
      in flight, and that clicking again mid-flight does nothing
- [ ] Tab to the UNO tile with the keyboard and press Enter/Space — confirm it starts a session the
      same way a click does
- [ ] Confirm the member "Game Night" dashboard is visually unchanged (it already worked correctly)
