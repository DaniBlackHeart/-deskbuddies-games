# MANIFEST — Wheel of Fortune: persistent consonant/vowel tracker

Frontend-only, four files. Merge into your repo root with `cp -r`.

## What's new

A row of all 21 consonants and a row of all 5 vowels, shown right under
the puzzle board — greyed out and struck through once a letter's been
called (hit or miss). Visible to everyone, all the time, regardless of
whose turn it is — no more needing to mentally track what's already been
tried. Uses `round.guessed_letters`, which was already part of the public
round data, so no backend or type changes were needed.

Added to:
- **The player screen** (`WheelPlayPage`) — right under the phrase board.
- **The spectator screen** (`WheelSpectatorPage`) — same placement, so a
  MOD watching sees exactly what players see.

Not added to the host control screen — that page deliberately doesn't
render the puzzle board at all (the host doesn't need the letters spelled
out to run the game), so a letter tracker wouldn't fit there either. Say
the word if you'd like it there too.

## New file

- `frontend/src/components/WheelLetterTracker.tsx`

## Replaced files (full contents)

- `frontend/src/styles/global.css` (appended a new section, everything
  else untouched)
- `frontend/src/pages/wheel/WheelPlayPage.tsx`
- `frontend/src/pages/mod/WheelSpectatorPage.tsx`

## Commit

```bash
cd deskbuddies-games
git add .
git commit -m "feat: show a persistent consonant/vowel tracker during Wheel of Fortune rounds"
git push
```

Frontend-only — no `supabase db push`, no function redeploy.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery).
