# MANIFEST — Wheel of Fortune: Team mode

A big one — this adds a second mode alongside the original free-for-all
("Solo," unchanged and still the default). Merge into your repo root with
`cp -r`.

## What's new

**Team mode**: 3-12 teams of 2-3 members, self-picked at join time (not
MOD-assigned). Built against your three answers before any schema was
written:
- Any number of teams, 3-12 (not Feud's fixed 2)
- Members create or join teams themselves in the lobby
- Strict rotation through teammates one at a time, like Family Feud's line
  order (confirmed by actually reading feud-play's rotation logic — it
  advances after *every* guess, hit or miss, not just misses)

**The turn model gained a second layer, not a replacement.** TEAM-level
control works exactly like Solo's individual control always did — a
buzz-off opens each round, a miss (once opened) passes control to the next
team, wrapping. The new part is entirely *within* a team's held control:
after every fully-resolved action (spin+call, buying a vowel, a solve
attempt), control hands to that team's *next* teammate in line — win or
lose. The team keeps control while it's hot, same as always, but a
different person gets the wheel each time. This never resets between
rounds, so turns even out across a whole game.

Almost none of the existing per-action authorization checks needed to
change for this: `active_user_id` already meant "the one person allowed
to act right now" — in team mode that's just whoever the rotation pointer
currently points to. Only scoring (now keyed by team, not individual) and
the continue/pass-control logic needed team-mode branches.

## How to run a Team mode game

1. **Wheel Categories** page → the "Start new game" row now has a
   **Solo** / **Team** toggle before the Start button.
2. Members go to the Wheel of Fortune lobby same as always — in Team
   mode they'll see a "create a team" form and a list of existing teams
   to join instead of a plain join button.
3. Host screen shows each team's roster and blocks starting until there
   are 3+ teams, each with 2+ members.
4. Everything else — rounds, spinning, the Bonus Round — plays out the
   same way, just with team names/rosters shown throughout instead of a
   flat player list.

## What changed

**New:**
- `supabase/migrations/0019_wheel_team_mode.sql` — `wheel_teams` table,
  `wheel_sessions.game_mode`/`winner_team_id`/`tiebreak_eligible_team_ids`,
  `wheel_participants.team_id`/`line_position`,
  `wheel_rounds.active_team_id`/`locked_out_team_ids`
- `frontend/src/components/WheelTeamScoreboard.tsx`

**Rewritten (full contents):**
- `supabase/functions/wheel-host/index.ts` — mode-aware `start_game`
  validation, team-based standings/tiebreak in `advance_round`
- `supabase/functions/wheel-play/index.ts` — new `create_team`/`join_team`
  actions, team-aware `buzz`/`resolveTurnEnd`/`resolveSolve`, the new
  per-teammate rotation logic
- `supabase/functions/get-wheel-state/index.ts` — now returns `teams` and
  `my_team_id` alongside the existing session/roster/round data
- `frontend/src/pages/wheel/WheelLobbyPage.tsx` — team creation/joining UI
- `frontend/src/pages/mod/HostWheelSessionPage.tsx` — team roster display,
  team-aware start validation and status text
- `frontend/src/pages/mod/WheelSpectatorPage.tsx` — team-aware display

**Modified:**
- `supabase/functions/_shared/utils.ts` — added team size/count constants
- `frontend/src/types/index.ts` — `WheelTeam` type, team fields on the
  session/round/participant types
- `frontend/src/lib/wheelConstants.ts` — frontend copies of the same
  constants
- `frontend/src/pages/mod/WheelCategoriesPage.tsx` — Solo/Team toggle on
  the start-game card
- `frontend/src/pages/wheel/WheelPlayPage.tsx` — team scoreboard, team
  status text, per-representative buzz eligibility messaging
- `frontend/src/styles/global.css` — appended team scoreboard/lobby styles
- `README.md`, `SETUP.md`, `PROJECT_CONTEXT.md` — updated for the new mode
  (full design writeup + every judgment call I made is in
  `PROJECT_CONTEXT.md` §6c-iii)

## Judgment calls worth knowing about (all in §6c-iii, short version here)

- **Buzzing is per-representative, not a free-for-all race within a
  team** — only the current line-position teammate may buzz on their
  team's behalf, even during the opening face-off.
- **Wild Card's second call and Mystery's choice-then-call stay with the
  same person** — those are one combined action-sequence, so rotation
  only happens once the whole thing resolves.
- **The Bonus Round is played by one individual** (the winning team's
  current representative), not the whole team collaboratively — same
  shape as Family Feud's Fast Money.
- **Team names must be unique per session** (a real DB constraint, not
  just a UI nicety).
- **One accepted race condition**: `join_team`'s capacity check has a
  small TOCTOU gap — vanishingly unlikely in practice, flagged rather
  than engineered around given the scope already here.

## Deploy order (Supabase before frontend)

```bash
cd deskbuddies-games

npx supabase db push
npx supabase functions deploy wheel-host
npx supabase functions deploy wheel-play
npx supabase functions deploy get-wheel-state

git add .
git commit -m "feat: add Team mode to Wheel of Fortune"
git push
```

This one needs the migration — `wheel_teams` and several new columns are
new schema.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery), and all three touched Edge
Functions type-checked clean with a real `deno check` (only the same
pre-existing repo-wide `Deno.serve` typing quirk every function already
has, nothing new).

## Suggest playtesting both modes

Solo mode's code paths are untouched by this — I re-verified every branch
still behaves identically when `game_mode = 'solo'` — but given the size
of this change, a full Solo-mode playtest alongside the new Team mode
would be worth doing before trusting either in front of the whole server.
