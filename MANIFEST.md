# Type What You See — lobby now matches Wheel of Fortune's joined-players list

**Date:** 2026-08-29

## What changed

Dani pointed at Wheel of Fortune's hosting lobby (a numbered list of joined
players with an ✕ to remove each one, right in the main card) and asked for
the rebus lobby to look the same way, instead of its current "N joined"
count plus a separate "Standings" card underneath showing everyone at 0 pts
before the game has even started.

`HostRebusSessionPage.tsx`'s lobby card (`session.status === "lobby"`) now
renders the actual joined-players list — `1. Bliss`, `2. kai ✶.✿°`, etc. —
with an ✕ button per row, directly above the Start Session / Cancel session
buttons. This mirrors `HostWheelSessionPage.tsx`'s lobby exactly (same
`row-between` per-row layout, same ✕ ghost button).

The "Standings" card (leaderboard) now only renders once the session has
left the lobby (`session.status !== "lobby"`) — it was previously always
shown, which is what produced the redundant/confusing second card in the
screenshot (a leaderboard showing "0 pts" for people who haven't played
anything yet). Once the session starts, Standings reappears exactly as
before.

The header's "N joined" line above the badges is unchanged — it's still
useful at a glance even once you've scrolled past the list.

### New backend action: `remove_player`

The ✕ button needed something to call — rebus-host had no way to boot
someone from the lobby before this (Wheel already has this via
`wheel-host`'s `remove_player`). Added the same action to `rebus-host`:

- Confirms the session is still in `lobby` (can't remove someone once the
  session has started — same rule Wheel enforces).
- Deletes the participant's `rebus_participants` row.
- No re-indexing needed afterward — unlike Wheel, rebus participants don't
  have a `seat_order`/`line_position` to keep contiguous.

The removal shows up on the host's own screen via the same realtime +
4-second lobby poll from the previous delivery (`deskbuddies-rebus-roster-fix.zip`)
that already handles picking up a new join — no separate plumbing needed
for "someone left."

## Files changed

- `frontend/src/pages/mod/HostRebusSessionPage.tsx`
- `supabase/functions/rebus-host/index.ts`

## Validation run

From `frontend/`:
- `npx tsc -b` — clean
- `npx oxlint` — clean (same pre-existing baseline warnings in unrelated files)
- `npx vite build` — clean

Backend reviewed by hand against `wheel-host`'s existing `remove_player` action as the reference pattern (no Deno runtime available here to type-check directly, same limitation as every prior delivery in this project).

## Deploy steps

```bash
git add frontend/src/pages/mod/HostRebusSessionPage.tsx supabase/functions/rebus-host/index.ts
git commit -m "Match rebus lobby UI to Wheel of Fortune's joined-players list, add a remove_player action to boot someone from the lobby"
git push

cd frontend
npx tsc -b
npx oxlint
npx vite build

cd ..
npx supabase functions deploy rebus-host
```

No migration needed — this only adds a new dispatch action inside the existing Edge Function and deletes rows from the existing `rebus_participants` table; no schema change.

## Playtest checklist

- [ ] Start a lobby, have 1-2 members join — confirm the lobby card now lists them by name with an ✕ next to each, matching Wheel's layout
- [ ] Click ✕ next to a joined player — confirm they're removed from the list (and, if you have their screen open, that leaving the lobby is reflected there too — RebusLobbyPage.tsx wasn't touched here, so double-check that side still behaves sensibly if this comes up)
- [ ] Confirm the "Standings" card no longer shows during the lobby, but reappears normally once you hit Start Session
- [ ] Confirm you can no longer remove a player once the session has started (the button simply won't be there, since it only renders in the lobby state)
