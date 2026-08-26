# Wheel of Fortune — fix buzzer getting stuck (no consonant prompt after buzzing)

## Root cause

Same class of bug as the last delivery, one screen over. `wheel-play`'s `buzz` action
correctly sets `turn_phase` to `awaiting_consonant` server-side, but `WheelPlayPage.tsx`'s
`callPlay()` only called `hydrate()` on **error** — on success it just returned and waited
for the `buzz_won` realtime broadcast to round-trip back to the same client before showing
the consonant keypad. If that broadcast was slow or missed, the buzzer looked stuck even
though the buzz itself had succeeded.

This wasn't just `buzz` — every player action on this page (`call_consonant`, `buy_vowel`,
`start_solve_attempt`, `submit_solve`, `mystery_choice`, the bonus-round actions, the
timeout actions) had the same gap, since they all go through the same `callPlay()` helper.

## Fix

`callPlay()` now refetches state directly after any successful action, the same pattern
already applied to the lobby/host pages. **`spin` is the deliberate exception** — its
outcome has to stay hidden until the wheel's ~2.3s spin animation actually finishes, which
is already handled by the `spin_result` broadcast + `SPIN_ANIMATION_MS` timeout further down
in this file. Hydrating immediately after `spin`'s own response would reveal the wedge
before the wheel visually stops — so that one action still relies purely on the broadcast,
exactly as before. Everything else now updates the acting player's own screen immediately.

The direct refetch is routed through the same `runOrQueue()` helper the broadcast handlers
already use, so if a spin animation somehow is mid-flight when another action resolves, it's
deferred rather than cutting the animation short — no new race introduced.

## Validation

- `npx tsc -b` — 0 errors.
- `npx oxlint` — same 6 baseline warnings, nothing new.
- Checked `WheelSpectatorPage.tsx` for the same gap — it already calls `hydrate()` directly
  after its own `claim_spectator` action, so it wasn't affected.
- No Edge Functions or migrations touched — frontend-only change, no `supabase db push` or
  function redeploy needed.

## Deploy steps

```bash
cd deskbuddies-games       # your actual project root
git add .
git commit -m "fix: refetch Wheel of Fortune play-screen state directly after every action except spin, instead of relying solely on the broadcast reaching the acting client"
git push
```

## Files in this delivery

```
frontend/src/pages/wheel/WheelPlayPage.tsx   (modified)
```

Merge into your repo root with the usual `cp -r` convention.
