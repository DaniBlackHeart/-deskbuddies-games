# Remove muted subtitle/hint lines — 2026-09-06

Removes every muted "subtitle" line called out from the 11 screenshots — both
the one-line descriptions under page headings, and the hint text inside the
game mode-selection cards (Chill/Hard, Solo/Team explanations). Functional
warnings that only appear conditionally (e.g. "Add at least one set with some
questions before starting") were left in place — they weren't in the
screenshots and aren't decorative.

## Files changed

- `frontend/src/pages/mod/ModDashboardPage.tsx` — removed the "Manage
  question sets and run Trivia Night, Family Feud, UNO, Impostor WHO?,
  Wheel of Fortune, and Type What You See." line under the H1.
- `frontend/src/pages/mod/QuestionSetsPage.tsx` (Trivia hub) — removed the
  "Every session randomly mixes up to 30 questions..." hint above the mode
  buttons, and the "Chill: wrong or missed answers..." / "Hard: wrong
  answers cost points..." hint below them.
- `frontend/src/pages/mod/RebusSetsPage.tsx` (Type What You See hub) —
  removed the "Every session randomly mixes puzzles..." hint above the mode
  buttons, and the Chill/Hard + Solo/Team explanation line below them.
- `frontend/src/pages/mod/WheelCategoriesPage.tsx` — removed the "Every
  round randomizes its own category and phrase..." hint above the Solo/Teams
  buttons.
- `frontend/src/pages/mod/QuestionSetEditorPage.tsx` (a set's own editor,
  e.g. "Brand and Logos") — removed the "Chill: wrong or missed answers..."
  / "Hard: ..." hint below the Chill/Hard toggle. The "{N} questions" count
  line was left as-is — that's data, not a subtitle.
- `frontend/src/pages/mod/RebusSetEditorPage.tsx` (each rebus category's own
  editor) — removed the "Chill/Hard, Solo/Team, and starting a session now
  live on the Type What You See page..." line under the puzzle-count summary;
  also dropped the now-unused `Link` import this line was the only user of.
  The puzzle-count summary line itself was left as-is (data, not a subtitle).

## Validation run before packaging

```
npx tsc -b        # clean
npx oxlint <changed files>   # clean
npx vite build    # clean, 1.28s
```

## Ship it

No schema or Edge Function changes — frontend only.

```bash
git add frontend/src/pages/mod/ModDashboardPage.tsx frontend/src/pages/mod/QuestionSetsPage.tsx frontend/src/pages/mod/RebusSetsPage.tsx frontend/src/pages/mod/WheelCategoriesPage.tsx frontend/src/pages/mod/QuestionSetEditorPage.tsx frontend/src/pages/mod/RebusSetEditorPage.tsx
git commit -m "Remove muted subtitle/hint lines from Mod Dashboard and game hub pages

Drops the descriptive one-liners under page headings and the mode-selection
card hints (Chill/Hard, Solo/Team explanations) across the Dashboard,
Trivia, Type What You See, Wheel of Fortune, and question-set/rebus-set
editor pages, per screenshot review.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kK8m8X51UzCFsUVrJZ4Z"
git push
```
