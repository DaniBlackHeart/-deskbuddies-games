# MANIFEST — fix: bring back a plain buzzer, guess the consonant as a separate step

One backend function change + a few frontend files. Merge into your repo
root with `cp -r`.

## What was wrong

My previous fix (the "buzzing is guessing" delivery) went too far — it
made pressing a specific consonant key both the buzz *and* the guess in
one atomic action, so you had to commit to a letter blind, in the same
instant as racing for the floor. That's not what was wanted.

## What's fixed now (per your last message)

Two genuinely separate steps:

1. **Buzz** — a plain generic buzzer (back to the big "BUZZ IN" button),
   no letter attached. First to press wins the floor.
2. **Guess** — winning the buzz drops you into a required "call a
   consonant" step (the consonant keypad), separate from buzzing. This
   call scores no points yet (nothing's been spun) — it just reveals the
   letter if it's right.
   - Wrong → locked out, turn moves to the next member, same as before.
   - Right → "the guessing phase" ends and the normal action menu opens up
     (spin / buy a vowel / solve) — spinning is now *available*, not
     forced, matching "at any point during their turn a member can attempt
     to solve."

Everything from the second letter of a held turn onward — spin, then call
a consonant, wedges included — was already correct and is untouched.

## What changed

- **`supabase/functions/wheel-play/index.ts`** — `buzz` reverted to taking
  no letter, just claiming the floor and dropping the winner into
  `awaiting_consonant` with `pending_wedge` left `null`. `call_consonant`
  now accepts that null-wedge case as an unscored call (occurrences still
  checked, but 0 points awarded) instead of rejecting it — this is what
  lets the very same handler serve both "the mandatory first guess" and
  "every scored guess after a spin" without a new turn-phase value.
- **`frontend/src/pages/wheel/WheelPlayPage.tsx`** — buzz phase is back to
  the plain `Buzzer` button (keypad removed from that screen). The
  post-buzz consonant-call screen now says "You buzzed in! Call a
  consonant:" and hides the wheel graphic until a real spin has actually
  happened, so it doesn't look like a spin already occurred.
- **`frontend/src/types/index.ts`** — `buzz_won` broadcast event restored
  (no letter/hit info at buzz time anymore, since nothing's graded until
  the follow-up guess).
- **`frontend/src/styles/global.css`** — removed the now-unused buzz-keypad
  button style from the previous attempt.
- **`PROJECT_CONTEXT.md`** — updated the correction log to describe both
  attempts honestly (what was tried, why it wasn't right, what's actually
  live now) so a future session doesn't get confused reading old notes.

## Deploy order (Supabase before frontend)

```bash
cd deskbuddies-games

npx supabase functions deploy wheel-play

git add .
git commit -m "fix: buzzing in is a plain floor-claim again, guessing a consonant is a separate step"
git push
```

No migration needed.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings,
`wheel-play` type-checked clean with `deno check` (same pre-existing
`Deno.serve` quirk as every other function, nothing new).
