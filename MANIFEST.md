# Reward ledger (migration 0028) + check-in payout

## What this adds

The foundation for Debbie's earning system: one append-only reward ledger, a cached balance row per
member, and a single database function (`grant_reward`) that is the only way anything gets paid out.
The daily check-in is the first thing wired to it.

**Nothing pays yet.** A master switch (`earning_settings.earning_enabled`) ships **off**. With it off,
check-in works exactly as before and the response just carries `reward.status = "disabled"`.

Design and decisions: `claude/Debbie_Earning_System_Draft_v0.md` in the project (sections 3, 4, 12).
Values are Rika's approved initial config (21 Nov 2026) and live in `reward_rules`, not in code.

## Files changed

- `supabase/migrations/0028_reward_ledger.sql` (new) — `earning_settings`, `reward_rules`,
  `reward_ledger`, `member_progress`, `community_today()`, `grant_reward()`, RLS, seeded rules.
- `supabase/functions/daily-checkin/index.ts` (replaces the existing file) — the day now comes from
  the database (`community_today()`), and every `claim` asks `grant_reward` to pay the
  `daily_checkin` rule with source key `checkin:<date>`.
- `MANIFEST.md` (this file; replaces the previous delivery's).

No frontend changes. `useDailyCheckIn.ts` casts the response to `CheckInStatus`, so the extra
`reward` field is simply ignored.

## How it behaves

- One real action, one payout: `unique (user_id, source_key)` plus a per-member row lock means a retry,
  refresh, double tap or two devices can only ever pay once.
- Caps limit payout, not participation: past a per-type daily cap or the overall daily XP ceiling
  (200, in `earning_settings`) the event is still recorded, but pays 0.
- A payout failure never fails the check-in. The next claim the same day repairs it (grant is idempotent).
- Members can read only their own ledger and balance rows. Nobody can write from the browser; the
  service role (through the function) is the only writer. `grant_reward` is not callable by members.
- Only the `daily_checkin` rule is active. The other rules (Focus Block, puzzle, games, ...) are
  seeded but inactive until their features ship.
- Left out on purpose: levels (curve not settled), spending, corrections/reversals, milestones,
  streak freezes, VC time.

## Validation

- Migration run in a local Postgres (PGlite) with stand-ins for Supabase's roles and `auth.uid()`:
  39 checks passed. They cover: switch off by default, grant amounts, duplicate/retry, per-type cap,
  inactive and unknown rules, non-member refused, XP ceiling clip then zero, Manila community day,
  constraints (negative deskbits needs zero XP, meta size/shape), rule version bump, members reading
  only their own rows, members unable to write or call the functions, expired membership seeing
  nothing, and cached totals equal to ledger sums.
- `deno check` on `daily-checkin/index.ts` against the repo's real `_shared/utils.ts`: 3 errors, the
  **same 3 as the original file** (two inside `_shared/utils.ts` and one on the `Deno.serve` line,
  from the strict types in the newest supabase-js). No new errors from this change. Not blocking:
  the function already deploys fine with them.
- `deno lint` clean on the function.
- **Not run:** parallel requests (the local database is single-connection, so the row-lock behavior
  is untested under real concurrency), and the migration against the live project.
- No frontend files touched, so `tsc`, `oxlint` and the build are not needed for this delivery.

## Deploy

The function now calls the new database functions, so **the migration must go first**.
Run everything from the project root (the cloned repo), not your home folder.

```bash
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
npx supabase functions deploy daily-checkin

git add MANIFEST.md supabase/migrations/0028_reward_ledger.sql supabase/functions/daily-checkin/index.ts
git commit -m "feat: add reward ledger (0028) and pay daily check-in through grant_reward"
git push
```

Backend-only change; the push still triggers a Vercel build, which is harmless.

## After deploying (switch still off)

1. Claim a check-in in the app. It should work as before; the function response has
   `reward.status = "disabled"`.
2. When you are ready to pay members, run in the Supabase SQL editor:
   ```sql
   update public.earning_settings set earning_enabled = true;
   ```
3. Claim as a test member: expect 10 Buddy XP and 5 deskbits. A second tap returns `duplicate`.
4. Look at the ledger:
   ```sql
   select user_id, event_type, source_key, xp_delta, deskbits_delta, payout, community_day
     from public.reward_ledger order by created_at desc limit 10;
   ```

## Turning it off / undoing

- Stop all earning instantly (nothing is deleted):
  ```sql
  update public.earning_settings set earning_enabled = false;
  ```
- To go back to the old check-in code: `git revert` the commit and run
  `npx supabase functions deploy daily-checkin`. The new tables can stay; the old function does not
  use them.
