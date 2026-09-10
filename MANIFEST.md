# Dashboard "Now Playing" status bar

## What this adds

A status bar at the top of the member dashboard ("Game Night"), above the game tiles, that shows
whether any game is currently live across the whole catalogue, and a **Join** button that takes a
member straight into that game's lobby.

- Checking / idle / live states, matching each Lobby page's own tone ("No game happening right
  now — keep an eye on Discord…").
- Live state shows the game's emoji + name, a 🔴 Live badge (same `badge-live` style already used
  on the play screens and MOD Dashboard), a short detail line (question set / Feud set name /
  category / solo-or-team, where that game has one), and whether it's still in the lobby ("join
  before it starts") or already in progress.
- Updates live via Supabase Realtime — no refresh needed when a MOD starts or ends a session while
  a member has the dashboard open.

## Why it's built this way

There's no shared `games`/`sessions` table (see `PROJECT_CONTEXT.md` §5 — deliberately not built,
duplication pain didn't justify it yet), and `active_session_lock` (the table that actually
enforces "only one live session across the whole catalogue") is intentionally **not**
client-facing — its own migration comment says it's "never read or written by clients directly,"
specifically to avoid leaking who's hosting a session.

So instead of opening that table up, this checks each game's own session table the exact same way
that game's own Lobby page already does — same status filters (`trivia_sessions` in
`lobby/live/grading`, the rest `!= ended`), same members-read RLS policies those pages already rely
on. It just does all six at once and shows whichever one comes back (only one ever will, since the
lock still guarantees exclusivity server-side — this only ever *reads* what's already true).

## Files changed

- `frontend/src/components/ActiveGameStatus.tsx` (new) — the status bar component.
- `frontend/src/pages/DashboardPage.tsx` — renders `<ActiveGameStatus />` between the intro text
  and the game tile grid.

No `supabase/` changes — frontend-only.

## Validation

- `npx tsc -b` — clean
- `npx oxlint` — clean (same pre-existing baseline warnings as before, none in the touched files)
- `npx vite build` — clean; `ActiveGameStatus` folds into the main bundle (it's used by the
  statically-imported `DashboardPage`, not any lazy-loaded game bundle), so no game's chunk size
  changed.

## Deploy

Frontend-only change — skip the `npx supabase` block entirely:

```bash
git add frontend/src/components/ActiveGameStatus.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add a live-game status bar with a Join button to the member dashboard"
git push
```

Vercel auto-deploys from the push.
