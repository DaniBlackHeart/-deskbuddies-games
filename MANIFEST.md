# Wheel of Fortune — traced the actual stuck-round bug and closed it

**Date:** 2026-08-29

## What Dani reported

> We were playing Wheel of Fortune and some members got skipped and never got the chance to
> turn the wheel, and some members had a problem calling a consonant, like they pressed the
> letter but it didn't register despite having more time on the clock.

## First pass (wrong) and the correction

My first theory was the buzzer's blind pre-spin consonant guess (win the buzz, but you have to
call one letter blind before you're allowed to spin — miss it and you're locked out). Live data
showed that mechanic really does zero out entire rounds sometimes (3 of 5 rounds in one earlier
session had nobody ever spin), so I shipped a fix around that theory first. Dani corrected it: the
skip Dani saw happened *after* the guessing phase, with people already actively spinning — not
during that opening blind guess. That sent me back to the data for the specific real scenario.

Two smaller, real findings from that first pass held up and are still in this delivery — see
"Fixes shipped" below.

## What actually happened (confirmed against a real 5-player game)

Found the exact round. `wheel_participants` for that session, in seat order: kai, Ciel, Jiji,
**Jetung**, klookari. Reconstructed the turn-by-turn sequence from the `wheel-play` request logs
(request sizes reliably identify which action each request was) and cross-checked it against the
final `wheel_rounds` row:

1. kai wins the buzz and goes on a hot streak — repeated spin/call_consonant hits, keeping
   control the whole time (correct: a hit keeps your turn).
2. kai finally misses. Control correctly rotates to Ciel (next seat) — confirmed via a real
   `spin` request from Ciel's account right after.
3. Ciel spins, but never calls a consonant — their own `turn_timeout` fires and succeeds, ending
   their turn. Control correctly rotates to Jiji (next seat).
4. Jiji attempts to solve immediately, submits a 1-character guess (looks like a stray keystroke,
   not a real attempt) — wrong, turn ends. Control correctly rotates to **Jetung** (next seat).
5. **Then nothing.** Zero requests from Jetung's account, or anyone else's, for the next 2.5
   minutes. The round eventually ends (`status: "revealed"`) with `active_user_id` still pointing
   at Jetung — which only happens when a MOD manually force-ends the round (the normal
   miss/timeout flow always clears `active_user_id` itself). A MOD had to intervene, and the
   whole round — everyone else's points banked in it included — was sacrificed to do it.

The rotation logic itself is correct at every step above — nobody was skipped by a "who's next"
bug. What happened is that Jetung's device dropped out from under the game (backgrounded tab,
dead connection, locked phone — no way to tell which from here) exactly when control reached
them, landing them in the **`awaiting_action`** phase (the "spin / buy a vowel / solve" decision)
— which had **no deadline at all**, by deliberate design from an earlier session ("no time
pressure on that choice"). With no deadline to watch, nothing could ever notice and move the
game on automatically — every other player was just stuck watching "Jetung's turn…" until a
human stepped in. This is also very likely what "pressed the letter, it didn't register" was,
from Jetung's own side, if their tab's knowledge of the round had gone stale while backgrounded.

## Fixes shipped in this delivery

**1. Every client now watches every deadline, not just the active player's own device.**
`WheelPlayPage.tsx`: the phases that already had a deadline (`awaiting_consonant`,
`awaiting_mystery_choice`, `awaiting_solve_guess`) now get a fallback timeout-reporter on *every*
client watching the round, not just the active player's — mirroring how the buzz-open timer has
always worked for everyone. Whichever client's report lands first wins (harmless, silent race).

**2. The "no time pressure" decision phase now has a generous safety-net deadline.** This is the
part that actually closes the specific stall traced above. `_shared/utils.ts` adds
`WHEEL_DECISION_SAFETY_NET_MS = 40_000`; `wheel-play/index.ts` now sets that deadline (instead of
`null`) at every point a player enters the spin/buy-vowel/solve decision. Deliberately **not**
shown as a visible countdown or tick sound — `Timer.tsx` gained a `hidden` prop so the timing/
recovery logic runs identically, it just doesn't look like a clock a present player needs to race.
40 seconds of genuine inactivity (not just thinking time) is what it takes to auto-pass the turn;
anyone actually there will basically never notice it exists.

**3. Spurious error flashes from the buzz-timeout race, silenced.** (From the first pass —
still real, still fixed.) The buzz-open countdown fires on every watching client, not just the
active player; when it expires, several clients race to report it and the losers were getting a
scary error flash for something they didn't do. Auto-fired timeout calls now pass `silent: true`
through `callPlay()` so a lost race is logged to the console instead of flashed at someone who
pressed nothing. Manual-action errors (an actual late click, wrong turn) still flash normally.

**4. A miss now says so on-screen.** (Also from the first pass.) A wrong consonant call now
flashes `"<name> called <letter> — not in the puzzle."` alongside the existing "wrong" sound,
for the caller and everyone watching, instead of the screen just silently moving on.

## What's still open

The blind-pre-spin-guess mechanic from the first pass (a separate, real finding — 3 of 5 rounds
in the *other* session ended with nobody ever spinning) hasn't been touched. Still worth a
decision whenever you want to revisit it: match the real show (buzz → spin directly), keep the
guess but drop the lockout, or leave it as-is.

## Files changed

- `frontend/src/pages/wheel/WheelPlayPage.tsx`
- `frontend/src/components/Timer.tsx`
- `supabase/functions/wheel-play/index.ts`
- `supabase/functions/_shared/utils.ts`

## Validation run

From `frontend/`:
- `npx tsc -b` — clean
- `npx oxlint src/pages/wheel/WheelPlayPage.tsx src/components/Timer.tsx` — clean (one
  pre-existing baseline warning at `WheelPlayPage.tsx:115`, unrelated to this change)
- `npx vite build` — clean

Backend (`wheel-play`, `_shared/utils.ts`) reviewed by hand against the existing action handlers
and constants — no Deno runtime available here to type-check directly, same limitation as every
prior delivery in this project.

## Deploy steps

```bash
git add frontend/src/pages/wheel/WheelPlayPage.tsx frontend/src/components/Timer.tsx supabase/functions/wheel-play/index.ts supabase/functions/_shared/utils.ts
git commit -m "fix: give every client a fallback deadline watchdog for Wheel of Fortune turns, and add a hidden safety-net timeout to the previously-untimed action decision, so a dropped device can't hang a round for everyone else"
git push

npx supabase functions deploy wheel-play
```

No migration needed — no schema change, only Edge Function logic and a shared constant.
`wheel-play` is the only function that imports the changed part of `_shared/utils.ts`, so it's the
only one that needs redeploying.

## What to check on the next playtest

- [ ] During someone else's turn (after they've spun and are calling a consonant), confirm you
      now see a live countdown even though it's not your turn
- [ ] During the "spin / buy a vowel / solve" decision, confirm there's still **no** visible
      countdown or tick sound — it should feel exactly as untimed as before
- [ ] If you can arrange it: have someone background their tab / lock their phone mid-turn —
      confirm the round moves on for everyone else after the deadline passes (up to ~40s for the
      decision phase, faster for the others) instead of hanging until a MOD force-ends it
- [ ] Call a consonant that's wrong — confirm you see the `"<name> called <letter> — not in the
      puzzle."` flash
- [ ] During a normal buzz-open window with 3+ people watching, confirm nobody sees a random
      error flash pop up when they didn't press anything
