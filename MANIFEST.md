# Type What You See — Sprint Pool now imports the same way as the categories

Frontend-only, no migration, no edge function change. 3 files (1 new).

## What changed

The Sprint Pool tab's "Bulk paste" box is gone — it's now a
"📋 Import / paste puzzles" button that opens a modal, same pattern as the
Puzzles tab:

- Paste a JSON array, or the plain-text template (`Display:` / `Answer:` /
  `Accepted:`).
- A new "Display:" line is the only thing that starts a new puzzle — blank
  lines between puzzles are optional, not required, same as categories.
- A multi-line puzzle works directly in the template (extra line(s) right
  under "Display:"), no JSON needed for that.
- "Preview" shows exactly what will be imported and how many, before
  anything is saved.
- If the import fails for any reason, the modal shows the actual error
  instead of silently doing nothing (same fix as the categories import got
  last time).

The old one-line `DISPLAY :: ANSWER :: alt1, alt2` format is gone — your
Sprint pool is still at 0 puzzles, so there was nothing drafted in that
format to lose. There's no round, puzzle type, points, or time limit in
this modal, because the Sprint pool genuinely has none of those fields
(unchanged) — that part of the mechanics isn't different, just the import
box now matches.

The "Add one" manual single-puzzle form is untouched.

## Why this is safe at the scale you're planning

You mentioned aiming for ~200 Sprint puzzles per category, which could put
the Sprint pool itself in the thousands eventually. Two things from the
last fix already cover that without any further changes needed here:

- `loadData()` on this page already fetches the full Sprint list in pages
  of 1,000 instead of a single capped `.select()`, so `nextSprintOrderIndex()`
  (which decides where a new import starts numbering) stays correct no
  matter how large the pool gets.
- `pickRebusSessionSprintPuzzles` (the Edge Function that draws the 3
  puzzles for an actual Sprint round) got the same pagination fix, so it'll
  keep drawing from your entire Sprint pool once it's real, not a
  truncated slice of it.

`tsc -b`, `oxlint`, and `vite build` all ran clean.

## Files

- `frontend/src/components/RebusSprintImportModal.tsx` — new. The Sprint
  pool's import modal, mirroring `RebusImportModal.tsx` minus the fields
  Sprint doesn't have.
- `frontend/src/utils/rebusPuzzleParser.ts` — `parseRebusSprintInput`
  rewritten to support JSON and the `Display:`/`Answer:`/`Accepted:`
  template (was the old `DISPLAY :: ANSWER` one-liner parser); added
  `REBUS_SPRINT_JSON_EXAMPLE` alongside the updated `REBUS_SPRINT_TEMPLATE_EXAMPLE`.
- `frontend/src/pages/mod/RebusSetEditorPage.tsx` — swapped the inline
  bulk-paste card for the "📋 Import / paste puzzles" button + modal, and
  `handleSprintImportConfirm` now throws a real error message on failure
  instead of just setting `sprintError` silently.

## Deploy

```bash
git add frontend/src/components/RebusSprintImportModal.tsx frontend/src/utils/rebusPuzzleParser.ts frontend/src/pages/mod/RebusSetEditorPage.tsx
git commit -m "Give the Sprint Pool the same import settings as the main puzzle categories"
git push
```

No migration or function deploy needed — Vercel picks it up on push.
