# Type What You See — bulk edit per difficulty

Frontend-only, no migration, no edge function change. 1 file.

## What changed

Each difficulty tab (Easy/Medium/Hard/Final Round) on the set editor now
has an "✏️ Bulk edit {difficulty} (N)" button, next to the "🗑 Delete all"
button. Clicking it opens a form with four fields:

- Points
- Time limit (seconds)
- Puzzle type
- Move to a different difficulty (the current tab's difficulty is excluded
  from this list, since moving to itself would be a no-op)

Every field starts blank/"Leave as-is" — only the fields you actually fill
in or pick get changed. It applies unconditionally to every active puzzle
in the current difficulty tab, no per-puzzle filtering (e.g. picking
"Points" alone updates every puzzle's points, regardless of what they were
set to before).

Before applying, it confirms with an exact summary of what's about to
change and how many puzzles it affects, e.g.:

> Apply this to all 357 Easy puzzles in this set?
>
> Points → 150
> Difficulty → Medium

After it runs, a message reports how many puzzles were updated, and the
tabs' counts update immediately (a puzzle moved to a different difficulty
disappears from the current tab and shows up under its new one).

Archived puzzles are never touched — the update is scoped to active
(non-archived) puzzles in that set + difficulty only, same as every other
puzzle list on this page.

Switching difficulty tabs while the bulk-edit form is open closes it and
clears whatever was typed, so a half-filled form for Easy can never
accidentally get applied to Medium.

This is a single UPDATE query (not one round-trip per puzzle), so it's
fast even for a difficulty with hundreds of puzzles.

## Why no production-data validation this time

Unlike the bulk-delete feature, this is a plain field UPDATE with no
archive/delete branching or renumbering to get wrong — the query is exactly
`update rebus_puzzles set ... where rebus_set_id = ? and round = ? and
archived_at is null`, which is about as low-risk as a bulk operation gets.
`tsc -b`, `oxlint`, and `vite build` all ran clean.

## Files

- `frontend/src/pages/mod/RebusSetEditorPage.tsx` — new bulk-edit state,
  `handleBulkEdit`, the button, and the inline form. Also resets/closes the
  bulk-edit form on `handleSwitchDifficulty` so it can't carry stale values
  across tabs.

## Deploy

```bash
git add frontend/src/pages/mod/RebusSetEditorPage.tsx
git commit -m "Add bulk edit per difficulty to the rebus set editor"
git push
```

No migration or function deploy needed — Vercel picks it up on push.
