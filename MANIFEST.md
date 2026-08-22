# MANIFEST — fix: buzzer should only open a round once, then rotate seats

New migration + one backend function change + a couple frontend files.
Merge into your repo root with `cp -r`.

## What was wrong

The buzzer was reopening on *every single miss* for a round's entire
duration — post-spin consonant misses, Bankrupt, Lose a Turn, wrong
solves, timeouts, all of it — for as long as the round lasted. That's not
how the real show (or your description) works: the buzzer is a one-time
face-off to decide who opens the round. After that, a miss should just
pass control to the next seat directly (they spin immediately, no
buzzing) — same as real Wheel of Fortune's seat rotation.

## What's fixed

Added `wheel_rounds.is_opened` (`false` on every new round). It flips to
`true` — permanently, for that round — the first time any consonant guess
lands correctly. From then on:

- **No more buzzer.** `turn_phase` never returns to `buzz_open` once a
  round is opened, so the `Buzzer` component (which only renders when
  `turn_phase === 'buzz_open'`) naturally stops appearing — no frontend
  change was even needed for this part, it falls out of the backend fix.
- **A miss passes control to the next seat directly.** Ordered by
  `wheel_participants.seat_order`, wrapping around (and for a Do-or-Die
  tiebreaker, filtered to only the tied players — same restriction the
  buzz phase already had). They land straight in the "spin the wheel" menu
  — no buzzing, no guess-first step.
- The "round ends automatically if everyone guesses wrong" rule now
  correctly applies only to the *opening* face-off. Once a round is open,
  it just keeps rotating through seats until someone actually solves it.

## What changed

- **`supabase/migrations/0018_wheel_round_rotation.sql`** (new) — adds
  `wheel_rounds.is_opened`.
- **`supabase/functions/wheel-play/index.ts`** — `resolveTurnEnd` now
  branches on `is_opened`: reopen-the-buzzer behavior when it's `false`
  (unchanged from before), seat-rotation hand-off when it's `true` (new).
  `call_consonant` sets `is_opened = true` the moment any guess lands.
  New `getNextEligibleUserId` helper picks the next seat.
- **`frontend/src/pages/wheel/WheelPlayPage.tsx`** — added a handler for
  the new `turn_passed` broadcast (shows "so-and-so's turn to spin!"
  instead of implying the buzzer reopened).
- **`frontend/src/types/index.ts`** — added the `turn_passed` event type.
- **`PROJECT_CONTEXT.md`, `SETUP.md`** — migration count bumped to 0018,
  correction log entry added (§6c-ii) with the full reasoning.

## Deploy order (Supabase before frontend)

```bash
cd deskbuddies-games

npx supabase db push
npx supabase functions deploy wheel-play

git add .
git commit -m "fix: buzzer only opens a Wheel of Fortune round once, then play rotates through seats"
git push
```

This one *does* need a migration — `is_opened` is a new column.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings,
`wheel-play` and `wheel-host` both type-checked clean with `deno check`
(same pre-existing `Deno.serve` quirk as every other function, nothing
new).
