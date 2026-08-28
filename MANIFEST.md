# Delivery manifest — simplify Type What You See puzzle import

**Date:** 2026-08-29
**What changed:** The bulk-import template (JSON or plain-text) for the
main puzzle rounds no longer asks for `Round:`/`Type:` per puzzle. The
import modal already opens from inside one specific round tab, so every
puzzle in a paste now gets that round automatically; puzzle type defaults
to Phonetic (add a puzzle manually instead if you need a different type
for it). The Sprint pool's import format (`DISPLAY :: ANSWER`) was already
this simple and is untouched.

Frontend-only — no migration, no Edge Function change.

## Files in this delivery

```
frontend/src/utils/rebusPuzzleParser.ts       [MODIFIED]
frontend/src/components/RebusImportModal.tsx  [MODIFIED]
frontend/src/pages/mod/RebusSetEditorPage.tsx [MODIFIED]
```

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
git commit -m "simplify Type What You See puzzle import: drop Round/Type from the template, infer from the active round tab"
git push
```

Vercel auto-deploys from the push.

## What to check on the next playtest

1. Open a set, switch to Round 2's tab, paste two puzzles with no
   `Round:`/`Type:` lines — confirm the preview shows "Importing into:
   Round 2" and both land there after import.
2. Paste a block that overrides `Points:`/`Time:` on one puzzle but not
   the other — confirm only the un-overridden one gets Round 2's defaults
   (400 pts / 15s).
3. Confirm the Sprint Pool tab's import is unaffected (still
   `DISPLAY :: ANSWER`, no round/type ever existed there).
