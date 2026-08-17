# Impostor WHO? — clue fix delivery manifest

Fixes the bug you caught in playtesting: the Impostor's card was showing
"Your only clue — category: Everyday Objects" instead of an actual clue
about the secret word. Now it's a real per-word clue, authored by the MOD,
with the category name only as a fallback if a word has no clue set.

This is additive on top of the original Impostor WHO? delivery — every path
below is relative to your repo root, same as before.

## New file
- supabase/migrations/0013_impostor_word_clues.sql — adds `impostor_words.clue`
  and `impostor_cards.clue`, both nullable so nothing already deployed breaks.

## Modified files
- supabase/functions/impostor-host/index.ts — `start_game` now selects
  `word, clue` and resolves `clue || category_name` once, at deal time
- supabase/functions/get-impostor-state/index.ts — `my_card` select now
  includes `clue`
- frontend/src/types/index.ts — `ImpostorWord`/`ImpostorCard` gained a `clue` field
- frontend/src/components/ImpostorCardView.tsx — the Impostor's card now
  shows the word-specific clue (category name still shown too, as context —
  it's public info anyway)
- frontend/src/utils/impostorParser.ts — reworked to parse per-word clues:
  `Word | Clue text` in plain-text imports, `{word, clue}` objects in JSON
  (both the words-only and bulk-category import paths)
- frontend/src/components/ImpostorImportModal.tsx — preview now shows each
  word's parsed clue (or a note that it'll fall back to the category name)
- frontend/src/pages/mod/ImpostorCategoryEditorPage.tsx — reworked: adding a
  word now has a clue field alongside it, and every existing word gets an
  inline-editable clue input (with a "Save" button that appears once you've
  actually changed it) — so you can go back and add clues to categories you
  already built before this fix
- frontend/src/pages/mod/ImpostorCategoriesPage.tsx — bulk category import
  now writes each word's clue too
- SETUP.md — migration count bumped to 0013, the Impostor setup section
  mentions the clue field and the `Word | Clue` import syntax
- PROJECT_CONTEXT.md — §6a-i documents the correction (what was wrong, what
  changed, and the reasoning for a nullable-column-with-fallback fix rather
  than a backfill), migration table updated

## Deploy order

```bash
npx supabase db push
npx supabase functions deploy impostor-host
npx supabase functions deploy get-impostor-state
git add .
git commit -m "Fix Impostor WHO? clue: per-word clue instead of category name"
git push
```

`impostor-play` and the frontend routing/CSS/sounds files from the original
delivery are untouched — no need to redeploy `impostor-play`, though
`git push` will pick up the frontend changes regardless.

## One thing worth knowing

Any category you already built before this fix has words with no clue yet
— they'll keep working (the Impostor just sees the category name, same as
before), but it's worth a pass through `ImpostorCategoryEditorPage` to add
real clues where you want them. There's no bulk "generate clues" tool —
each one's a manual/inline edit.

## Verified
`npx tsc -b` and `npx oxlint` both pass clean — 0 errors, same 5
pre-existing warnings as before (none new). Same caveat as the original
delivery: no Deno runtime available to actually run the two changed Edge
Functions, reviewed by hand instead.
