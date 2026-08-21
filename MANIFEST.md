# MANIFEST — Wheel of Fortune: bulk import for categories & phrases

Frontend-only, no Supabase changes. Merge into your repo root with `cp -r`.

## What's new

Same "paste, preview, confirm" import flow Trivia and Impostor WHO? already
have, added to Wheel of Fortune in the two places it's needed:

- **`WheelCategoriesPage`** — new "📋 Import categories" button next to
  "+ New category". Paste a JSON array of `{name, description, phrases}`
  objects, or a plain-text template (`Category: ...` / `Description: ...`
  / one `- phrase` per line, blank-line-separated blocks). Creates whole
  new categories with their phrases in one paste.
- **`WheelCategoryEditorPage`** — new "📋 Import phrases" button next to
  "+ Add phrase", inside an already-open category. Paste a JSON array of
  strings, or one phrase per line. Adds phrases to that category only.

Both show a live preview with any parse errors called out before you
confirm, same as Impostor's import modal.

## New files

- `frontend/src/utils/wheelParser.ts` — the paste parser, mirrors
  `impostorParser.ts`'s JSON-or-text-template split. Simpler than
  Impostor's version since a phrase has no clue/answer-key field riding
  along with it — no pipe-delimited second field to parse.
- `frontend/src/components/WheelImportModal.tsx` — mirrors
  `ImpostorImportModal.tsx` (same modal shell, same `mode` prop pattern),
  with the per-item preview simplified to just the phrase text since
  there's nothing else to show.

## Replaced files (full contents)

- `frontend/src/pages/mod/WheelCategoriesPage.tsx`
- `frontend/src/pages/mod/WheelCategoryEditorPage.tsx`

## Deploy

```bash
cd deskbuddies-games
git add .
git commit -m "Add bulk import for Wheel of Fortune categories and phrases"
git push
```

Frontend-only — no `supabase db push`, no function redeploy.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings (same 6
pre-existing ones as every prior delivery).
