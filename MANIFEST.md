# MANIFEST — "Type What You See" (rebus), game #6

This zip mirrors your repo's directory structure. Everything under
`supabase/` and `frontend/` should be copied/merged into the matching path
in your actual repo (overwriting the modified files listed below — they're
small, additive changes, not rewrites). `PROJECT_CONTEXT_ADDENDUM.md` and
this `MANIFEST.md` are **not** part of the git repo — see the note at the
bottom. (There was a leftover `MANIFEST.md` from the Aug 26 Wheel buzzer
fix sitting in the uploaded zip's root — it wasn't tracked in git, so this
file replaces it; nothing lost.)

## New files

```
supabase/migrations/0021_rebus_game.sql
supabase/functions/rebus-host/index.ts
supabase/functions/rebus-play/index.ts
supabase/functions/get-rebus-state/index.ts
frontend/src/pages/rebus/RebusLobbyPage.tsx
frontend/src/pages/rebus/RebusPlayPage.tsx
frontend/src/pages/mod/RebusSetsPage.tsx
frontend/src/pages/mod/RebusSetEditorPage.tsx
frontend/src/pages/mod/HostRebusSessionPage.tsx
frontend/src/pages/mod/RebusSpectatorPage.tsx
frontend/src/components/RebusImportModal.tsx
frontend/src/components/RebusTeamLeaderboard.tsx
frontend/src/utils/rebusPuzzleParser.ts
```

## Modified files (additive — new blocks appended/inserted, nothing from the existing games removed)

```
supabase/functions/_shared/utils.ts   — computeRebusLeaderboard, computeRebusTeamLeaderboard,
                                         REBUS_SPEED_BONUS, REBUS_SPRINT_POINTS, REBUS_SPRINT_SECONDS
frontend/src/types/index.ts           — Rebus* types block appended at the end
frontend/src/lib/archiveOrDelete.ts   — deleteRebusSet/restoreRebusSet/deleteRebusPuzzle/
                                         restoreRebusPuzzle/deleteRebusSprintPuzzle appended
frontend/src/styles/global.css        — .rebus-roster / .rebus-team-card / .rebus-puzzle-display appended
frontend/src/App.tsx                  — 6 new routes (/rebus/lobby, /rebus/play/:id, and 4 /mod/rebus-* routes)
frontend/src/pages/DashboardPage.tsx  — new GameCard
frontend/src/pages/mod/ModDashboardPage.tsx — active-session card block + content grid link + subtitle
README.md                             — game list, anti-cheat section, architecture bullets
SETUP.md                              — function deploy commands, migration count (0019 → 0021)
```

## Validated before packaging

- `npx tsc -b` → **0 errors**
- `npx oxlint` → **6 warnings** (your existing baseline — unchanged; a 7th
  warning this introduced in `RebusLobbyPage.tsx` was fixed with the same
  `eslint-disable-next-line react-hooks/exhaustive-deps` pattern already
  used elsewhere for the identical lobby-music effect shape)
- `npx vite build` → succeeds (only the pre-existing "chunk size" advisory,
  not something this delivery introduced)
- Edge Functions could **not** be run through `deno check` (no Deno runtime
  available in this environment) — reviewed by hand against
  `_shared/utils.ts`'s actual exported signatures instead. Worth an extra
  careful first playtest for that reason.

## Deploy order

Backend before frontend, same as every other backend+frontend delivery:

```bash
cd deskbuddies-games          # repo root — confirm with `git remote -v` first if on a new machine

# 1. Migration
npx supabase db push

# 2. Edge Functions
npx supabase functions deploy rebus-host
npx supabase functions deploy rebus-play
npx supabase functions deploy get-rebus-state

# 3. Commit + push (Vercel auto-deploys the frontend)
git add .
git commit -m "feat: add Type What You See (rebus) game"
git push
```

## Suggested first playtest

1. Start with **Solo + Chill mode** and a small test set (3-4 warm-up
   puzzles, 1-2 in round 2/3, a couple of Sprint puzzles, one Final puzzle)
   — confirms the full status pipeline end-to-end before a real session.
2. Then try **Team mode** with 2 test teams to confirm the team
   leaderboard math and the lobby's create/join/leave-team flow.
3. Then try **Hard mode** to confirm the wrong-answer/no-answer penalties.
4. Deliberately let a puzzle's timer run out with nobody answering, in
   Hard mode, to confirm the no-show penalty sweep fires correctly.
5. Deliberately create a Sprint tie (or don't add enough Sprint puzzles for
   one player to overtake) to exercise the host's tie-breaker picker.
6. Try ending a session early from every stage (`round_ended`,
   `sprint_setup`, `sprint_done`) to confirm "Cancel"/"End session" always
   does the right thing and the `active_session_lock` actually releases —
   check MOD Dashboard → Troubleshooting if a later session ever refuses to
   start with a lock conflict.

## Housekeeping

- `PROJECT_CONTEXT_ADDENDUM.md` (included in this zip) is **not** part of
  the git repo — it's written for Project Knowledge. The copy of
  `PROJECT_CONTEXT.md` visible in this chat is a stale 2026-08-14 snapshot
  (predates UNO/Impostor/Wheel and migrations 0011-0020), so this was
  written as a standalone addendum rather than a full regenerated file to
  avoid clobbering the real, current version you have in Project
  Knowledge. Merge the sections in (placement notes are inline) and
  re-upload.
- This `MANIFEST.md` itself isn't part of the repo either — it's just this
  delivery's deploy guide.
