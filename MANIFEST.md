# Type What You See — difficulty tabs on the set editor

Frontend-only, no migration, no edge function change. 2 files.

## What changed

`RebusSetEditorPage.tsx` used to render all four difficulties (Easy,
Medium, Hard, Final Round) stacked in one long scroll under the
"Puzzles" tab — with 357 puzzles in Easy, reaching Hard or Final Round
meant scrolling past all of them first.

Difficulty is now its own row of tabs, the same pattern as the existing
Puzzles/Sprint Pool toggle: click "Easy (357)," "Medium (0)," "Hard (0),"
or "Final Round (0)" and only that difficulty's list renders. Two small
things ride along with it:

- The "+ Add puzzle manually" form's difficulty dropdown now defaults to
  whichever tab you're on (still changeable in the form itself).
- Opening "Import / paste puzzles" from a difficulty tab now defaults the
  import modal's own difficulty dropdown to that same difficulty, instead
  of always starting on Easy.
- The "Show archived" section is now scoped to the active difficulty tab
  too (it already computed this per-difficulty internally, just wasn't
  using it — the archived badge showing which difficulty a puzzle
  belonged to is gone since that's now implied by the tab).

`tsc -b`, `oxlint`, and `vite build` all ran clean on both files.

## Files

- `frontend/src/pages/mod/RebusSetEditorPage.tsx` — the difficulty tab
  row, `activeDifficulty` state, `handleSwitchDifficulty`, and rendering
  only the active group's puzzles/archived instead of all four.
- `frontend/src/components/RebusImportModal.tsx` — new optional
  `initialRound` prop that seeds the batch-difficulty dropdown.

## Deploy

```bash
git add frontend/src/pages/mod/RebusSetEditorPage.tsx frontend/src/components/RebusImportModal.tsx
git commit -m "Add difficulty tabs to the rebus set editor so switching levels doesn't require scrolling past hundreds of puzzles"
git push
```

If GitHub rejects the push again with GH007 (private email), it's the
same fix as last time: use your GitHub noreply email
(`git config user.email "..."` from https://github.com/settings/emails,
then `git commit --amend --reset-author --no-edit` before pushing) —
this commit doesn't need a fresh amend if your git config is already
fixed from last time.

Vercel redeploys the frontend automatically on push — no `supabase db
push` or function deploy needed, nothing else touches the backend.
