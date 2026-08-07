-- DeskBuddies Games — mods can read all profiles
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Without this, the "profiles: read own row" policy from 0001 means each
-- person can only see their OWN username/avatar. That's fine for members,
-- but it breaks the MOD host panel: when it looks up another player's
-- name for the live Standings list or the pending-grade review list, RLS
-- silently blocks it, showing "Unknown" instead of their actual name.
--
-- This adds a second policy (combined with OR, per Postgres RLS rules)
-- letting MODs read any profile row. Regular members are unaffected —
-- they still only see their own row, since is_mod() is false for them.

create policy "profiles: mods read all"
  on public.profiles for select
  using (public.is_mod());
