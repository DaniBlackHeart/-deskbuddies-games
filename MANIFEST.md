# Impostor WHO? — percentage-vote reveal delivery manifest

Adds what you asked for: every member can see how many people voted them
(or anyone else) as the Impostor, as a percentage — a sorted list with a
bar per player, right after a vote resolves, and again permanently on the
final results screen.

Additive on top of the previous two Impostor deliveries — paths are
relative to your repo root, same as before.

## New files
- supabase/migrations/0014_impostor_vote_tally.sql — adds
  `impostor_sessions.final_vote_tally` (nullable jsonb), so the vote
  breakdown survives a page refresh after the game ends
- frontend/src/components/ImpostorVoteResults.tsx — the percentage-bar list

## Modified files
- supabase/functions/impostor-play/index.ts — `resolveVote` now includes
  `total_votes` in every `vote_resolved` broadcast, and persists the final
  tally onto the session row for a terminal (crew_win/impostor_win)
  resolution specifically
- supabase/functions/get-impostor-state/index.ts — returns
  `session.final_vote_tally`
- frontend/src/types/index.ts — new `ImpostorFinalVoteTally` type,
  `ImpostorSessionPublic` gained `final_vote_tally`, `vote_resolved`'s
  broadcast type gained `total_votes`
- frontend/src/styles/global.css — `.impostor-vote-results*` bar styles
- frontend/src/pages/impostor/ImpostorPlayPage.tsx — shows the reveal live
  when a vote resolves, and permanently on the ended screen
- frontend/src/pages/mod/ImpostorSpectatorPage.tsx — same, for spectators
- frontend/src/pages/mod/HostImpostorSessionPage.tsx — the ended screen
  shows it too (persisted version only — the host page doesn't listen to
  live broadcasts, just `postgres_changes`)

## Deploy order

```bash
npx supabase db push
npx supabase functions deploy impostor-play
npx supabase functions deploy get-impostor-state
git add .
git commit -m "Add percentage-vote reveal to Impostor WHO?"
git push
```

`impostor-host` is untouched this round — no need to redeploy it.

## How it behaves

- Everyone with 0 votes still shows up at 0% — the whole point is you can
  see "nobody suspected me at all," not just the people who got votes.
- On an inconclusive vote (round-set 2 incoming), the reveal shows for about
  6 seconds before the next round's clue-giving screen takes over — long
  enough to read it, not so long it drags. Worth adjusting
  `RESULTS_REVEAL_MS` in `ImpostorPlayPage.tsx`/`ImpostorSpectatorPage.tsx`
  if 6s feels off in practice.
- On a game-ending vote, the reveal doesn't disappear — it's a permanent
  part of the final results screen, survives a refresh.

## One real bug this caught (worth knowing about)

The server fires `vote_resolved` immediately followed by either
`next_round_set_started` or `game_ended`. The original broadcast-handling
pattern (hydrate on every event) meant the percentage reveal would render
for a single frame and then get instantly overwritten by whatever came
next — functionally invisible. Fixed by not hydrating on
`next_round_set_started` at all, and delaying the hydrate that follows an
inconclusive `vote_resolved` by the 6-second window mentioned above.
Documented in `PROJECT_CONTEXT.md` §6a-ii in case a similar
"broadcast-arrives-then-immediately-gets-overwritten" issue shows up in a
future game — the fix pattern (skip the redundant hydrate, delay the
meaningful one) is the reusable part.

## Verified

`npx tsc -b` and `npx oxlint` both pass clean — 0 errors, same 5
pre-existing warnings as before (none new). Same caveat as every Impostor
delivery so far: no Deno runtime available to actually run
`impostor-play`/`get-impostor-state`, reviewed by hand instead. Worth a
real playtest to confirm the 6-second reveal timing feels right and that
the persisted `final_vote_tally` renders correctly on a fresh page load
after a game has already ended.
