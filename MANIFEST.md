# Sprint Pool bulk delete + bulk edit (replace-all) — 2026-09-06

Adds bulk actions to the Sprint Pool tab in `RebusSetEditorPage.tsx`. Since
this is shared code used by every rebus set, this covers "every category" —
no per-category duplication.

## What's new

- **Bulk delete**: a "🗑 Delete all Sprint (N)" button that deletes every
  Sprint puzzle in the current set at once, matching the "Delete all
  {difficulty}" pattern already on the main Puzzles tab. Confirms first;
  always a hard delete (Sprint puzzles never need the archive dance — see
  the comment on `deleteAllRebusSprintPuzzles`).
- **Bulk edit (replace-all)**: a "🔁 Replace all Sprint puzzles" button that
  opens the existing `RebusSprintImportModal` in a new `mode="replace"` —
  same JSON/template paste-and-preview flow as the normal import, just
  relabeled with a destructive-action warning banner and a danger-styled
  confirm button ("Delete N & replace with M"). Confirming deletes every
  existing Sprint puzzle in the set, then inserts the pasted list fresh
  (order_index starting at 0 — Sprint order_index isn't gameplay-significant,
  the Sprint round draws a random shuffled sample, so no renumbering concerns).
  Sprint puzzles genuinely have no round/type/points/time fields to bulk-set
  the way the main Puzzles tab's bulk edit does, so "bulk edit" here means
  wipe-and-repaste instead.

## Files changed

- `frontend/src/lib/archiveOrDelete.ts` — new `deleteAllRebusSprintPuzzles(rebusSetId)`.
  Fetches all matching ids first (via `fetchAllRows`, to get an accurate count
  past Supabase's 1000-row cap) then does one unconditional `.delete()` — safe
  because nothing ever references a Sprint puzzle row by id.
- `frontend/src/components/RebusSprintImportModal.tsx` — added `mode?: "append" | "replace"`
  and `existingCount?: number` props. In replace mode: different heading,
  a bold warning banner, different preview/button copy, and `btn-danger`
  styling on confirm. Append mode (used everywhere else this modal is already
  rendered) is unchanged.
- `frontend/src/pages/mod/RebusSetEditorPage.tsx`:
  - imports `deleteAllRebusSprintPuzzles`
  - new state: `bulkSprintDeleting`, `showSprintReplace`
  - new `handleBulkDeleteSprint()` — confirm, call `deleteAllRebusSprintPuzzles`, set `deleteMessage`, reload
  - new `handleSprintReplaceConfirm(parsedPuzzles)` — confirm, delete-all, insert fresh rows, throws on
    failure so the modal surfaces the error (matching the existing import-modal convention)
  - two new buttons in the Sprint tab's button row, and a `deleteMessage` result banner (the Sprint tab
    didn't show this before — it does now, same as the Puzzles tab)
  - conditional render of `<RebusSprintImportModal mode="replace" .../>` alongside the existing append-mode one

## Validation run before packaging

```
npx tsc -b        # clean
npx oxlint <changed files>   # clean
npx vite build    # clean, 1.47s
```

## Ship it

No schema or Edge Function changes — frontend only.

```bash
git add frontend/src/lib/archiveOrDelete.ts frontend/src/components/RebusSprintImportModal.tsx frontend/src/pages/mod/RebusSetEditorPage.tsx
git commit -m "Add bulk delete and replace-all to the Sprint Pool editor tab

Delete-all button matches the existing Puzzles-tab pattern; replace-all
reuses RebusSprintImportModal in a new mode, since Sprint puzzles have
no round/type/points/time fields for a field-level bulk edit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J3kK8m8X51UzCFsUVrJZ4Z"
git push
```
