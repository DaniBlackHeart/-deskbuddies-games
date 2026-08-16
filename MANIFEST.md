# UNO — file delivery manifest

Every path below is relative to your repo root — drop these in at the same
paths, overwriting the modified ones.

## New files
- supabase/migrations/0011_uno.sql
- supabase/functions/uno-host/index.ts
- supabase/functions/uno-play/index.ts
- supabase/functions/get-uno-state/index.ts
- frontend/src/components/UnoCardView.tsx
- frontend/src/lib/unoRules.ts
- frontend/src/pages/uno/UnoLobbyPage.tsx
- frontend/src/pages/uno/UnoPlayPage.tsx
- frontend/src/pages/mod/HostUnoSessionPage.tsx
- frontend/src/pages/mod/UnoSpectatorPage.tsx

## Modified files (additive — nothing existing was removed)
- supabase/functions/_shared/utils.ts — added the UNO deck/legality helpers at the end
- frontend/src/types/index.ts — added the UNO types at the end
- frontend/src/lib/sounds.ts — added `cardDraw()` and `cardReveal()`
- frontend/src/styles/global.css — added `.uno-*` classes at the end
- frontend/src/pages/DashboardPage.tsx — added the UNO GameCard
- frontend/src/App.tsx — added the 4 new routes
- frontend/src/pages/mod/ModDashboardPage.tsx — added the UNO tile + active-session block, fixed the subtitle to mention all 3 games
- SETUP.md — added uno-host/uno-play/get-uno-state to the deploy list (also added the previously-missing feud-host/feud-play/get-feud-state — a real pre-existing gap, unrelated to UNO but caught while I was in there), plus a "Running your first UNO game" section
- README.md — full rewrite to document Feud (previously undocumented in the actual repo) and UNO, and to close out the "worth adding once game #2 shows up" shared-`games`-table note, which was stale — Feud already answered it once and this makes UNO the second confirmation

## Deploy order

Same rule as always: Supabase side before frontend push.

```bash
npx supabase db push
npx supabase functions deploy uno-host
npx supabase functions deploy uno-play
npx supabase functions deploy get-uno-state
git add .
git commit -m "Add UNO"
git push
```

## A separate file: PROJECT_CONTEXT.md

Also included: an updated PROJECT_CONTEXT.md, ready to re-upload to Project
Knowledge (it's not part of the git repo, so it isn't in the paths above).

## Worth knowing before you playtest

- **Wild Draw Four challenge + stacking, combined:** if someone stacks a
  second +4 on top of the first, a challenge only ever checks the *most
  recent* +4 played, not the whole chain. A successful challenge voids the
  entire accumulated stack for the challenger, not just the most recent
  link. This was a deliberate scope cut — fully general N-player stacked-
  challenge resolution is a lot of extra state for a genuinely rare edge
  case. Flagging it so it reads as a decision, not a bug, if it comes up in
  playtesting.
- **Reverse in a 2-player game** acts as a Skip (give the same player
  another turn), per the official rule — not a true direction flip, since
  with only 2 players a flip and a skip look identical from turn 3 onward
  but differ on the very next turn.
- **"Draw once, then play or pass"** is the model — not "draw until you can
  play." A drawn card doesn't have to be played immediately; you can still
  pass after drawing if you'd rather keep it.
