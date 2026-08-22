# MANIFEST — fix: remove the timer for deciding whether to spin

One backend function change. Merge into your repo root with `cp -r`.

## What changed

The "Spin the wheel / Buy a vowel / Solve the puzzle" decision no longer
has a countdown. Every place that transitions a round into
`awaiting_action` now sets `turn_deadline: null` instead of a
`now + 10s` deadline:

- The initial transition after a correct opening guess or a correct
  post-spin consonant call.
- Free Play saving a miss (also lands back in `awaiting_action`).
- The next player picking up control after a seat-rotation hand-off.
- Refreshing state after buying a vowel (previously reset the deadline
  for another 10s; now just clears it).

**No frontend change was needed** — the `Timer` component on that screen
was already gated on `round.turn_deadline_ms` being non-null, so once the
backend stopped sending a deadline, it stopped rendering automatically.

Calling a consonant (after spinning), the Mystery wedge's take-vs-risk
choice, and solving the puzzle all keep their normal 10s/15s timers —
this change is scoped specifically to the "what do you want to do next"
moment, not anything with a clock-driven answer already in motion.

## Deploy

```bash
cd deskbuddies-games

npx supabase functions deploy wheel-play

git add .
git commit -m "fix: remove the countdown timer for choosing to spin, buy a vowel, or solve"
git push
```

No migration needed.

Validated: `npx tsc -b` → 0 errors, `npx oxlint` → 0 new warnings,
`wheel-play` type-checked clean with `deno check` (same pre-existing
`Deno.serve` quirk as every other function, nothing new).
