# Fix: members couldn't see other players' avatars/names in the lobby

**Date:** 2026-08-29

## What Dani reported

Screenshots of the same Wheel of Fortune and Family Feud lobby, open side by side as two different
accounts (kai, a MOD, and Bliss, a regular member). In kai's window both players' avatars and names
show correctly. In Bliss's window, only Bliss's own avatar/name shows — the other player appears as
a blank slot with no name at all ("1." with nothing after it in Wheel; missing from the Team A
roster entirely in Feud).

## Root cause

`WheelLobbyPage.tsx`, `FeudLobbyPage.tsx`, `UnoLobbyPage.tsx`, `ImpostorLobbyPage.tsx`, and
`RebusLobbyPage.tsx` all fetch their participant roster with a client-side embedded join, e.g.:

```ts
supabase.from("wheel_participants")
  .select("user_id, seat_order, ..., profiles(username, avatar_url)")
```

That query runs as the signed-in player (not the service role), so it's subject to `profiles`'
row-level security. Migration `0001_init.sql` only ever granted `select` on `profiles` to the row's
own owner (`auth.uid() = id`); `0003_mods_read_profiles.sql` later added a second policy so MODs
could read every row (needed for the host panel's Standings/grading lists). Nothing ever extended
that same access to regular members reading each other's rows — so when a non-MOD's query embeds
another player's `profiles`, RLS silently blocks it and PostgREST just returns `null` for that
piece rather than erroring. The join itself, the component code, everything else is completely
correct — this was purely a database access-control gap. Confirmed directly against the live
project (`DeskBuddies-Games`, `fixlkzjyfpcgnieorlaw`): the only two `select` policies present on
`profiles` today are exactly `read own row` and `mods read all` — nothing covering "a member reads
another member."

This is why kai and Bliss saw different lobbies: kai is a MOD, covered by the 0003 policy. Bliss is
a regular member, covered by neither.

## The fix

One additive migration, `0024_members_read_profiles.sql`, adding a third `select` policy:

```sql
create policy "profiles: verified members read all"
  on public.profiles for select
  using (public.is_verified_member());
```

`is_verified_member()` already exists (added in `0001_init.sql`) and is already the standard gate
this codebase uses everywhere else for "any logged-in verified member can read this" — it's what
every participant/round table's own RLS policies already check (`0007`, `0011`, `0012`, `0017`,
`0019`, `0021`, and `0001` itself for `question_sets`/`questions`). `profiles` was the one table
that never got this same treatment. Username, avatar, and mod/member status aren't sensitive here —
they're the same info already visible to everyone in the Discord server itself, and MODs already
have full-row access to everyone today — so this isn't a new category of exposure, just closing a
gap that was almost certainly an oversight rather than a deliberate restriction.

Purely additive: the existing `read own row` and `mods read all` policies are untouched. Multiple
permissive `select` policies on the same table combine with `OR` in Postgres, so this just adds a
third way in, the same pattern `0003` used.

No frontend changes needed — the lobby pages' queries were already correct; they were only ever
blocked by the missing policy.

## Validation

Tested directly against the live `DeskBuddies-Games` Supabase project via `begin; ... rollback;` —
confirmed the policy creates cleanly with no syntax errors or conflicts, appears correctly in
`pg_policies` alongside the other two, and the rollback left production untouched (re-queried
`pg_policies` afterward to confirm only the original two policies remain until this migration is
actually pushed).

## Files changed

- `supabase/migrations/0024_members_read_profiles.sql` (new)

## Deploy steps

```bash
git add supabase/migrations/0024_members_read_profiles.sql
git commit -m "fix: let verified members read each other's username/avatar, so lobby rosters show every player's name and picture instead of just your own"
git push

npx supabase db push
```

No Edge Function redeploy needed — this is a pure RLS policy addition, nothing server-side changed.

## What to check on the next playtest

- [ ] Open a lobby (any game) as a regular, non-MOD member while someone else is already in it —
      confirm you can now see their avatar and username, not just your own
- [ ] Confirm this holds across all five affected games: Wheel of Fortune, Family Feud, UNO,
      Impostor WHO?, and Type What You See
- [ ] Confirm a MOD's view is unchanged (they already worked correctly)
- [ ] Confirm nothing else regressed — a member still can't see another member's `is_mod` badge
      status anywhere it wasn't already shown, since no frontend UI reads or displays that field
      for other users today
