# Impostor WHO? — file delivery manifest

Every path below is relative to your repo root — drop these in at the same
paths, overwriting the modified ones.

## New files
- supabase/migrations/0012_impostor.sql
- supabase/functions/impostor-host/index.ts
- supabase/functions/impostor-play/index.ts
- supabase/functions/get-impostor-state/index.ts
- frontend/src/utils/impostorParser.ts
- frontend/src/components/ImpostorImportModal.tsx
- frontend/src/components/ImpostorCardView.tsx
- frontend/src/components/ImpostorClueBoard.tsx
- frontend/src/pages/mod/ImpostorCategoriesPage.tsx
- frontend/src/pages/mod/ImpostorCategoryEditorPage.tsx
- frontend/src/pages/mod/HostImpostorSessionPage.tsx
- frontend/src/pages/mod/ImpostorSpectatorPage.tsx
- frontend/src/pages/impostor/ImpostorLobbyPage.tsx
- frontend/src/pages/impostor/ImpostorPlayPage.tsx

## Modified files (additive — nothing existing was removed)
- frontend/src/types/index.ts — added the Impostor types at the end
- frontend/src/lib/sounds.ts — added `clueChime()`, `voteLock()`, `suspenseReveal()`
- frontend/src/lib/archiveOrDelete.ts — added `deleteImpostorCategory()`/`restoreImpostorCategory()`
- frontend/src/styles/global.css — added `.impostor-*` classes at the end
- frontend/src/pages/DashboardPage.tsx — added the Impostor WHO? GameCard, removed the "Coming soon" placeholder
- frontend/src/App.tsx — added the 6 new routes
- frontend/src/pages/mod/ModDashboardPage.tsx — added the Impostor WHO? tile + active-session block, subtitle now mentions all 4 games
- SETUP.md — added impostor-host/impostor-play/get-impostor-state to the deploy list, plus a "Running your first Impostor WHO? game" section. Also brought the rest of the file up to date with the real repo (two-Discord-app split, Family Feud steps, PROJECT_CONTEXT.md pointer) — it had genuinely fallen behind the actual codebase before this change, unrelated to Impostor but caught while I was in there.
- README.md — added Impostor WHO? to the game list and the anti-cheat/architecture sections
- PROJECT_CONTEXT.md — full update: new game entry, migration table row, repo structure, a dedicated §6a documenting every game-design interpretive call (see below), and a real bug caught during self-review (§6b)

## Deploy order

Same rule as always: Supabase side before frontend push.

```bash
npx supabase db push
npx supabase functions deploy impostor-host
npx supabase functions deploy impostor-play
npx supabase functions deploy get-impostor-state
git add .
git commit -m "Add Impostor WHO?"
git push
```

## A separate file: PROJECT_CONTEXT.md

Also included: an updated PROJECT_CONTEXT.md, ready to re-upload to Project
Knowledge (it's not part of the git repo, so it isn't in the paths above).

## Read this before playtesting — the interpretive calls I made

Your spec nailed the overall shape but left a few mechanics genuinely
ambiguous. Rather than block on questions, I made a call on each, documented
why in PROJECT_CONTEXT.md §6a, and centralized all of them in one function
(`resolveVote` in `impostor-play/index.ts`) so they're cheap to change if
they're not what you actually pictured:

1. **Vote resolution is plurality (most votes), not majority (>50%).** A tie
   at the top = no accusation reached.
2. **A wrong plurality accusation after the first vote does NOT end the
   game.** It's treated the same as "couldn't determine it" — round-set 2
   starts. The Impostor only wins by running out the clock (an
   inconclusive-or-wrong *second* vote), matching your literal wording. If
   you actually wanted "a confident wrong guess costs the game immediately,"
   that's a small change, not a rebuild.
3. **No self-voting**, enforced server-side.
4. **Turn order**: seats shuffle once at game start. Each round-SET (not
   each round) gets one fresh random non-Impostor starter; round 2 of a set
   repeats that same starter rather than continuing the rotation, so
   everyone gives exactly 2 clues before each vote. Round-set 2 (if it
   happens) gets an independently new random starter.
5. **The Impostor's only clue is the category name** — I didn't add a
   separate MOD-authored "hint" field to words. Category = clue; that's
   also why the MOD picks the category but the word is randomized within it.
6. **Cards start face-down, click to reveal** — not asked for, added because
   "every member gets a card" reads like a physical-card hand-out, and
   starting hidden avoids an accidental shoulder-surf before everyone's
   ready. Same shape as UNO's card back.

## A real bug I caught before shipping (worth knowing about)

`create_session`'s "random category" option originally used an inner join
(`impostor_words!inner(id)`) to find categories with at least one word —
which is wrong, since an inner join returns one row *per matching word*,
silently skewing "random" toward whichever category has the most words.
Fixed with a per-category count check instead (a few extra round trips on a
rarely-called MOD action, not worth optimizing away). Caught during my own
review, not something that shipped and got reported — flagging in case the
same `!inner`-as-existence-check mistake is tempting in a future game.

## What I couldn't verify

I don't have a Deno runtime in this environment, so the three new Edge
Functions are reviewed by hand against `_shared/utils.ts`'s actual exported
signatures (`requireMod`/`requireMember`/`shuffle`/`nextUnoSeat`/
`claimSessionLock`/`releaseSessionLock`/`forceReleaseSessionLock`/
`claimSpectatorSeat`/`releaseSpectatorSeat`), not run. The frontend does
type-check clean (`npx tsc -b`) and lint clean (`npx oxlint` — zero new
warnings beyond the pre-existing exhaustive-deps ones already present in
UnoPlayPage/FeudPlayPage). Worth a real playtest with 3+ accounts before
trusting the vote-resolution edge cases (ties, everyone voting for the same
wrong person, a timeout mid-vote) blind.
