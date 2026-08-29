# Fix: MOD Dashboard's Trivia tile didn't match Trivia Night's branding

**Date:** 2026-08-29

## What Dani reported

Two screenshots side by side: the MOD Dashboard's tile for Trivia (📋 "Question Sets") and the
member "Game Night" dashboard's Trivia tile (🧠 "Trivia Night") — pointing out the MOD tile doesn't
reflect Trivia Night outside the MOD dashboard.

## Root cause

Every other MOD Dashboard tile mirrors its game's member-facing emoji and name:

| Game | Member tile | MOD tile |
|---|---|---|
| UNO | 🎴 UNO | 🎴 UNO |
| Impostor WHO? | 🕵️ Impostor WHO? | 🕵️ Impostor WHO? |
| Wheel of Fortune | 🎡 Wheel of Fortune | 🎡 Wheel of Fortune |
| Type What You See | 🔤 Type What You See | 🔤 Type What You See |
| Trivia Night | 🧠 Trivia Night | 📋 **Question Sets** |

Trivia's MOD tile was the only one using a different emoji (clipboard instead of brain) and a
completely different name ("Question Sets" instead of "Trivia Night") — so it read as an unrelated
feature rather than the management tile for the same game shown on the member dashboard.

## The fix

`ModDashboardPage.tsx`'s Trivia tile now matches the rest:

```tsx
<GameCard
  to="/mod/sets"
  emoji="🧠"
  title="Trivia Night"
  description="Create, edit, or import questions for Trivia Night."
/>
```

Same link (`/mod/sets`) and description as before — only the emoji and title changed, to line up
with how every other game's MOD tile already echoes its member-facing identity.

## Files changed

- `frontend/src/pages/mod/ModDashboardPage.tsx`

## Validation

- `npx tsc -b` — clean
- `npx oxlint` — clean
- `npx vite build` — clean, chunk sizes unchanged

## Deploy steps

```bash
git add frontend/src/pages/mod/ModDashboardPage.tsx
git commit -m "fix: MOD dashboard's Trivia tile uses Trivia Night's own name and emoji"
git push
```

Frontend-only — no Supabase deploy needed.

## Worth a look later (not changed, flagging only)

Family Feud's MOD tile is titled "Feud Sets" rather than "Family Feud" — a smaller version of the
same drift, though its 🎙️ emoji does still match. Left as-is since Dani only flagged Trivia; worth
revisiting if the same "MOD tile should mirror the game's own name" rule should apply there too.
