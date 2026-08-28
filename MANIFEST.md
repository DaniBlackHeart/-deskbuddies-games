# Delivery manifest — simplify Type What You See puzzle import

**Date:** 2026-08-29
**What changed:** The bulk-import template (JSON or plain-text) for the
main puzzle rounds no longer asks for `Round:` per puzzle — the import
modal already opens from inside one specific round tab, so every puzzle
in a paste now gets that round automatically. The Sprint pool's import
format (`DISPLAY :: ANSWER`) was already this simple and is untouched.

Type went through two iterations in this same delivery:

1. First cut: dropped `Type:` from both formats too, defaulting every
   imported puzzle to Phonetic (add one manually instead if you needed a
   different type). The per-type examples that used to live in the
   paste-import template's help text moved to the manual "Add puzzle"
   form instead, next to the Puzzle type dropdown, since that became the
   only place left where a MOD picks a type — the example shown there
   updates live as the dropdown changes.
2. Follow-up (same day, at Dani's request): imported puzzles are no
   longer all tagged Phonetic. `detectPuzzleType()` in
   `rebusPuzzleParser.ts` now guesses each puzzle's type from its own
   display text — a digit → Numbers & letters, an underscore → Missing
   letters, the same word repeated → Repeated words, a single word →
   Homophone, more than one line → Visual arrangement, otherwise →
   Phonetic. It's a heuristic, not a real classifier, so the import
   preview now shows the guessed type as a badge on every puzzle — there's
   still no way to edit a puzzle's type (or anything else) after import,
   only delete-and-redo, so that preview is the only chance to catch a
   bad guess before confirming.
   - **Known gap, by design:** "Split words" and "Visual arrangement"
     puzzles are both just line breaks in the display text, so there's no
     textual signal that tells them apart — a multi-line puzzle always
     guesses Visual. Add a Split puzzle manually instead if the exact tag
     matters.
   - **Format gap, not new:** the plain-text template has no syntax for a
     multi-line `Display:` value (it reads one line per puzzle), so
     Visual/Split puzzles can only be pasted via the JSON array format,
     with a real `\n` inside `display_text`. The import modal's "Show
     example" now includes a short JSON snippet demonstrating this.

Frontend-only — no migration, no Edge Function change.

## Files in this delivery

```
frontend/src/utils/rebusPuzzleParser.ts       [MODIFIED]
frontend/src/components/RebusImportModal.tsx  [MODIFIED]
frontend/src/pages/mod/RebusSetEditorPage.tsx [MODIFIED]
```

`REBUS_PUZZLE_TYPE_LABELS` and `REBUS_TYPE_EXAMPLES` (the seven
label/example pairs) now live once in `rebusPuzzleParser.ts` and are
imported by both `RebusSetEditorPage.tsx` (manual form's dropdown +
live example, and the type badge on each listed puzzle) and
`RebusImportModal.tsx` (paste reference block, and the guessed-type badge
in the import preview) — previously `RebusSetEditorPage.tsx` had its own
private copy.

## Deploy

Frontend-only change — no `supabase/` folder touched, so skip the
`npx supabase` steps entirely:

```bash
cd frontend
npx tsc -b        # 0 errors, confirmed
npx oxlint        # 6 warnings, same project baseline, confirmed
npx vite build    # succeeds, confirmed (only the pre-existing bundle-size advisory)
```

```bash
git add .
git commit -m "simplify Type What You See puzzle import: drop Round from the template, auto-detect puzzle type from the pasted text instead of always tagging Phonetic"
git push
```

Vercel auto-deploys from the push.

## What to check on the next playtest

1. Open a set, switch to Round 2's tab, paste two puzzles with no
   `Round:` line — confirm the preview shows "Importing into: Round 2"
   and both land there after import.
2. Paste a block that overrides `Points:`/`Time:` on one puzzle but not
   the other — confirm only the un-overridden one gets Round 2's defaults
   (400 pts / 15s).
3. Confirm the Sprint Pool tab's import is unaffected (still
   `DISPLAY :: ANSWER`, no round/type ever existed there).
4. Open "+ Add puzzle manually" and cycle the Puzzle type dropdown through
   all seven options — confirm the example line under it updates each
   time and reads sensibly for that type.
5. Paste the plain-text example block from "Show example" as-is and
   preview it — confirm the badges read Phonetic, Phonetic, Numbers &
   letters, Missing letters, Repeated words, Homophone (in that order),
   matching what each puzzle's text actually looks like.
6. Paste the JSON snippet from "Show example" (the `MIND\nMATTER` one)
   and preview it — confirm it's tagged Visual arrangement and that
   `display_text` renders on two lines once imported and shown in the
   puzzle list.
7. Paste something genuinely ambiguous (e.g. a two-word phrase with no
   digits/underscores/repeats) and confirm it falls back to Phonetic
   rather than erroring or leaving the type blank.
