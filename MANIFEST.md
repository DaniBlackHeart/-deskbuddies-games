# Rules modals for the other 5 games

**Date:** 2026-08-29

## What Dani asked for

> Let's add rules for the other games just like how there's a rule a member can check while
> playing. Add all the mechanics to the rules per game.

UNO already has a "❓ Rules" button on its play screen (`UnoRulesModal.tsx`) that documents that
game's actual house-ruleset. This delivery adds the same feature — a rules modal a member can pop
open mid-game — to all five other games: Trivia Night, Family Feud, Impostor WHO?, Type What You
See, and Wheel of Fortune.

## How the content was built

Rather than writing generic rules from memory, each game's actual play page and Edge Function
(`*-play/index.ts`, `*-host/index.ts`) were read to find this build's real mechanics, including
every place it quietly diverges from the "obvious"/generic/TV-show version of the game. Each modal
calls those divergences out explicitly, the same way UNO's modal flags its own house rules (7/0,
Wild Draw Four challenge):

- **Trivia Night** — flat scoring with **no speed bonus** despite response time being tracked;
  Hard mode's wrong-answer and no-show penalties; typed answers that don't confidently match go to
  a MOD for manual review instead of auto-failing.
- **Family Feud** — the **rebuttal** step (not in the real show); turn passes on *both* a correct
  answer and a strike, not just a strike; a steal only needs **any** remaining answer, not
  specifically the #1 one; no round is ever doubled/tripled, tiebreaker included; Fast Money's
  duplicate-answer rejection for Player 2.
- **Impostor WHO?** — an inconclusive or tied final vote **favors the Impostor**, not the crew;
  there's **no way for the Impostor to save themselves** by guessing the secret word once accused.
- **Type What You See** — the "speed bonus" is actually a **flat** bonus, not speed-based; everyone
  answers independently rather than racing to buzz in; the Sprint Round's shared 3-puzzle pool and
  why "pool cleared" before time's up is normal, not a glitch.
- **Wheel of Fortune** — the **blind pre-spin consonant guess** (call a letter before seeing
  anything else, for 0 points, or you're locked out of the round — can end with nobody ever
  spinning); team mode's turn **rotates on every action, hit or miss** (unlike solo play, where a
  hit keeps your turn); Wild Card and Mystery wedge behavior. The hidden 40-second safety-net
  timer on the spin/buy-vowel/solve decision (added earlier this session) is deliberately **not**
  surfaced as a countdown here — it's designed to be invisible to a present player, so the modal
  just says there's no time pressure on that choice, matching the actual experience.

## UI pattern (matches UNO exactly)

Each new modal is a fixed full-screen overlay with a `.card`, a `row-between` title bar with a ✕
close button, a muted one-line subtitle, a `.stack` of `<section>` blocks with prose and badge
rows for anything tabular (scoring tiers, mode differences, wedge effects), and a bottom "Got it"
button. Wired into each play page the same way UNO does it: a `showRules` boolean, a
`❓ Rules` button, and `{showRules && <XRulesModal onClose={...} />}`.

- **Trivia & Type What You See** already had a `row-between` header on their main answering
  screen (question/puzzle counter + 🔴 Live badge) — the Rules button was added into that existing
  row, next to the Live badge.
- **Family Feud, Impostor WHO?, Wheel of Fortune** didn't have a header row on their play screen —
  a new small `flex-end` row with just the Rules button was added right after the page container
  opens, above the existing content (team scoreboard / flash banner / round label).

In every case the button only appears on each game's main play screen, mirroring how UNO's Rules
button only lives on its main table view, not on every lobby/end-of-round sub-state.

## Files changed

New:
- `frontend/src/components/TriviaRulesModal.tsx`
- `frontend/src/components/FeudRulesModal.tsx`
- `frontend/src/components/ImpostorRulesModal.tsx`
- `frontend/src/components/RebusRulesModal.tsx`
- `frontend/src/components/WheelRulesModal.tsx`

Modified (import + `showRules` state + button + modal render only — no other logic touched):
- `frontend/src/pages/trivia/TriviaPlayPage.tsx`
- `frontend/src/pages/rebus/RebusPlayPage.tsx`
- `frontend/src/pages/feud/FeudPlayPage.tsx`
- `frontend/src/pages/impostor/ImpostorPlayPage.tsx`
- `frontend/src/pages/wheel/WheelPlayPage.tsx`

## Validation run

From `frontend/`:
- `npx tsc -b` — clean
- `npx oxlint` on all 10 changed/new files — clean; the same 4 pre-existing
  `react-hooks(exhaustive-deps)` baseline warnings that were already in `FeudPlayPage.tsx`,
  `ImpostorPlayPage.tsx`, and `WheelPlayPage.tsx` before this change are still there, on lines this
  delivery didn't touch — unrelated to this change, same as the baseline warning noted in the last
  Wheel delivery.
- `npx vite build` — clean

Frontend-only change: no Edge Functions, migrations, or backend logic touched, so no Supabase
deploy is needed for this one.

## Deploy steps

```bash
git add frontend/src/components/TriviaRulesModal.tsx frontend/src/components/FeudRulesModal.tsx frontend/src/components/ImpostorRulesModal.tsx frontend/src/components/RebusRulesModal.tsx frontend/src/components/WheelRulesModal.tsx frontend/src/pages/trivia/TriviaPlayPage.tsx frontend/src/pages/rebus/RebusPlayPage.tsx frontend/src/pages/feud/FeudPlayPage.tsx frontend/src/pages/impostor/ImpostorPlayPage.tsx frontend/src/pages/wheel/WheelPlayPage.tsx
git commit -m "feat: add a per-game Rules modal (mirroring UNO's) to Trivia, Feud, Impostor, Type What You See, and Wheel of Fortune"
git push
```

No migration, no Edge Function deploy — this is all client-side.

## What to check on the next playtest

- [ ] On each game's main play screen, tap "❓ Rules" and confirm the modal opens over the board
      without disrupting the round underneath
- [ ] Confirm the ✕ button and the "Got it" button both close it, and tapping the dark backdrop
      closes it too
- [ ] Trivia / Type What You See: confirm the button sits cleanly next to the existing 🔴 Live
      badge instead of wrapping awkwardly on a phone-width screen
- [ ] Feud / Impostor / Wheel: confirm the new button row doesn't push the team scoreboard / flash
      banner / round label down in a way that feels cramped
- [ ] Spot-check one or two of the called-out house-rule quirks against a live round (e.g. Feud's
      rebuttal, Wheel's blind buzz-in guess) to confirm the modal text still matches actual
      behavior
