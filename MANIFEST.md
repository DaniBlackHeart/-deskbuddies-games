# MANIFEST — fix: buzzing was spinning the wheel before ever guessing a letter

One backend function change + a few frontend files. Merge into your repo
root with `cp -r`.

## What was wrong (your playtest catch)

The brief says: "Every member will press the buzzer to guess a consonant
for the phrase. If the members guessed the correct consonant, they can
spin the wheel to continue solving the puzzle." First delivery had this
backwards — winning the buzz went straight to offering Spin/Buy Vowel/
Solve with no consonant ever named, for every single letter of every turn.

Also caught in the same round of testing: the buzz-phase timer did nothing
when it hit zero, and the wheel graphic was small with no text on it.

## What changed

- **`supabase/functions/wheel-play/index.ts`** — `buzz` now takes a
  `letter` and grades it immediately, atomically with the floor-claim.
  Buzzing in *is* calling a consonant now, not a separate step before one.
  A hit reveals the letter for free (no points — nothing's been spun yet)
  and hands the guesser the normal action menu; a miss ends the turn like
  any other wrong guess. **Everything from the second letter of a turn
  onward is unchanged** — "spin, then call a consonant" was already
  correct for continuing a held turn, wedges included; the bug was scoped
  entirely to how a turn starts.
- **`frontend/src/pages/wheel/WheelPlayPage.tsx`** — the buzz phase is now
  a consonant keypad instead of a single generic "BUZZ IN" button (pressing
  a letter both buzzes and guesses it in one tap). Also fixes the silent
  timeout: the countdown timer now actually calls `buzz_timeout` when it
  hits zero, which it never did before.
- **`frontend/src/components/WheelSpinner.tsx`** — rebuilt as a real
  labeled SVG wheel (24 wedges, actual point values, color-coded specials)
  at nearly double the size, instead of a small blank `conic-gradient`.
- **`frontend/src/lib/wheelConstants.ts`** — added the wedge layout data
  the new wheel graphic renders from (mirrors the server's real wedge
  table, so the labels are honest even though which one it visually lands
  on is still decorative).
- **`frontend/src/styles/global.css`** — resized `.wheel-spinner` for the
  new SVG, added a `.wheel-keypad__key--buzz` style for the new buzz
  keypad.
- **`frontend/src/types/index.ts`** — `buzz_won` broadcast event replaced
  with `buzz_guess_result` (carries the letter and hit/miss now).
- **`PROJECT_CONTEXT.md`** — added a correction-log entry (§6c-i) with the
  full writeup, same pattern as the Impostor WHO? corrections already in
  there.

## Deploy order (Supabase before frontend)

```bash
cd deskbuddies-games

npx supabase functions deploy wheel-play

git add .
git commit -m "fix: buzzing in now guesses a consonant immediately instead of spinning first"
git push
```

No migration needed — this is a function-logic + frontend fix, not a
schema change.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings, and
`wheel-play` type-checked clean with `deno check` (only the same
pre-existing repo-wide `Deno.serve` typing quirk every other function
already has).
