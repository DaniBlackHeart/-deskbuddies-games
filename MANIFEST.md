# MANIFEST — Wheel of Fortune (new game)

Merge this into your repo root with `cp -r` (not as a subfolder). Everything
here is either a brand-new file or a full replacement of an existing one —
no partial diffs to hand-apply.

## What's in this zip

**New files:**
- `supabase/migrations/0017_wheel_of_fortune.sql`
- `supabase/functions/wheel-host/index.ts`
- `supabase/functions/wheel-play/index.ts`
- `supabase/functions/get-wheel-state/index.ts`
- `frontend/src/pages/wheel/WheelLobbyPage.tsx`
- `frontend/src/pages/wheel/WheelPlayPage.tsx`
- `frontend/src/pages/mod/WheelCategoriesPage.tsx`
- `frontend/src/pages/mod/WheelCategoryEditorPage.tsx`
- `frontend/src/pages/mod/HostWheelSessionPage.tsx`
- `frontend/src/pages/mod/WheelSpectatorPage.tsx`
- `frontend/src/components/WheelBoard.tsx`
- `frontend/src/components/WheelSpinner.tsx`
- `frontend/src/components/WheelScoreboard.tsx`
- `frontend/src/lib/wheelConstants.ts`

**Replaced files (full contents, not diffs):**
- `supabase/functions/_shared/utils.ts` — added the wedge table, phrase
  masking, and category/phrase randomizer helpers at the end; everything
  else is untouched
- `frontend/src/App.tsx` — added Wheel routes
- `frontend/src/types/index.ts` — added Wheel types at the end
- `frontend/src/lib/sounds.ts` — added Wheel sound effects
- `frontend/src/lib/archiveOrDelete.ts` — added
  `deleteWheelCategory`/`restoreWheelCategory`
- `frontend/src/pages/DashboardPage.tsx` — added the Wheel of Fortune card
- `frontend/src/pages/mod/ModDashboardPage.tsx` — added the "in progress"
  panel, the category-management card, and the direct "start a game" card
- `frontend/src/styles/global.css` — appended the Wheel of Fortune section
  at the end
- `README.md`, `SETUP.md`, `PROJECT_CONTEXT.md` — updated for the 5th game

## Deploy order (Supabase before frontend, per the project's own rule)

```bash
cd deskbuddies-games              # your actual project root

npx supabase db push
npx supabase functions deploy wheel-host
npx supabase functions deploy wheel-play
npx supabase functions deploy get-wheel-state

git add .
git commit -m "Add Wheel of Fortune"
git push
```

No new secrets, no new Discord app config — this reuses everything Trivia/
Feud/UNO/Impostor already set up.

## Validated before packaging

- `npx tsc -b` → 0 errors
- `npx oxlint` → 0 new warnings (the 6 that show up are pre-existing,
  identical warnings already present in UNO/Feud/Impostor/AuthContext)
- All three new Edge Functions type-checked clean with a real `deno check`
  (not just hand-reviewed) — the only thing it flags is a `Deno.serve`
  typing quirk that's present in *every* existing host/play function in
  this repo already, not something new

## Design decisions worth reading before playtesting

Full writeup is in `PROJECT_CONTEXT.md` §6c, but the short version:

1. **No separate "Sets" table.** Phrases live in `wheel_categories` /
   `wheel_phrases` — same shape as Impostor WHO?'s categories/words, not
   Feud's hand-curated Sets. Every round randomly picks a category +
   phrase. Means a MOD can't force a themed game (e.g. "all Disney night")
   — say the word if that's wanted and it's a straightforward add.
2. **Turn model is a buzzer race** (same primitive as Feud's face-off),
   not seat rotation. Whoever buzzes in keeps going while they keep
   guessing right; a miss locks them out until anyone else lands a hit; if
   that would lock out everyone, the round auto-reveals.
3. **Vowel cost (350 pts) comes out of the current round's stake only**,
   not a running cross-round bank.
4. **Wild Card** = 2 consonant calls off one spin. **Free Play** =
   protects the next miss from ending your turn. **Mystery** = take 500
   safe, or risk a 50/50 between 3000 points and an instant Bankrupt.
5. **Bonus Round prize is randomized (5,000–25,000) and hidden** until you
   solve or fail — not a fixed number.
6. **Do-or-Die tiebreaker** replays with only the tied players eligible to
   buzz; caps at 5 automatic retries before picking a random winner among
   them, so it can't loop forever if the category pool runs dry.

None of these were explicitly specified in the request — they're the calls
I made to turn "here's how the game works" into something implementable.
Very open to adjusting any of them once you've actually played it.

## One thing to do before your first game

Add at least a couple of Wheel categories with a few phrases each — MOD
Dashboard → Wheel Categories → New category. A 5-round game needs at
least 5 phrases available somewhere (fewer is fine too — the randomizer
falls back to repeating a category/phrase rather than failing outright,
it just won't be as varied).
