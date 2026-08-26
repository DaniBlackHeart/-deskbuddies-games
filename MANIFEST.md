# Wheel of Fortune — fix "stuck until reload" (Solo join, Team create, MOD start)

## Root causes found

1. **`wheel_teams` was never added to the Realtime publication.** `0019_wheel_team_mode.sql`
   created the table with RLS enabled and a read policy, but — unlike every other live-state
   table in this project — skipped `alter publication supabase_realtime add table ...`. No
   client (including the team's own creator) ever got a live update when a team was created;
   only a manual reload, which re-queries directly, showed it. This is the exact bug pattern
   already logged in `PROJECT_CONTEXT.md` §7.

2. **Solo join and MOD "Start game" (plus advance/force-reveal/remove-player) relied *only*
   on the realtime broadcast reaching the acting client's own screen.** Nothing directly
   refetched state after the action succeeded — they waited on the same postgres_changes
   event other spectators rely on. `handleEndSession` in the host page already worked around
   this (it explicitly calls a refetch right after the action), but that pattern wasn't
   applied to `start_game`/`advance_round`/`force_end_round`/`remove_player`, or to any of
   the lobby actions (join/leave/create team/join team) — which is exactly the set of actions
   you reported as stuck.

## Fix

- New migration `0020_wheel_teams_realtime.sql` — adds `wheel_teams` to the realtime publication.
- `WheelLobbyPage.tsx` — every lobby action (`join_game`, `leave_lobby`, `create_team`,
  `join_team`) now goes through a shared `callPlay()` helper that refetches roster/teams
  directly right after a successful call, instead of waiting on the broadcast to round-trip
  back to the same client that triggered it.
- `HostWheelSessionPage.tsx` — `callHost()` now refetches session/roster/teams directly after
  every successful host action (start game, advance round, force-reveal, remove player, end
  session), matching the pattern `handleEndSession` already used — just applied consistently
  instead of only in one place.

The realtime subscriptions are left in place — they're still what updates everyone else
watching the lobby/host screen live. This just stops the *acting* client from depending on
that same round-trip to see the result of their own action.

## Validation

- `npx tsc -b` — 0 errors (clean before and after).
- `npx oxlint` — 6 warnings, same as baseline before these changes (no new warnings).
- No Edge Functions were touched, so no `deno check` needed for this delivery.

## Deploy steps

```bash
cd deskbuddies-games       # your actual project root
npx supabase db push
git add .
git commit -m "fix: refetch wheel lobby/host state directly after actions instead of relying solely on realtime, and register wheel_teams for realtime"
git push
```

No Edge Function redeploy needed this time — only a migration and two frontend files changed.

## Files in this delivery

```
supabase/migrations/0020_wheel_teams_realtime.sql   (new)
frontend/src/pages/wheel/WheelLobbyPage.tsx          (modified)
frontend/src/pages/mod/HostWheelSessionPage.tsx      (modified)
```

Merge into your repo root with the usual `cp -r` convention.
