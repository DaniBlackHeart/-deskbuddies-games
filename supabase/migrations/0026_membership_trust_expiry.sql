-- DeskBuddies Games — membership trust now expires
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- The problem: profiles.is_member / is_mod were set when someone logged in
-- (verify-membership) and then trusted forever. Someone who left the Discord
-- server — or lost the MOD role — kept full access (RLS reads, Edge Function
-- calls) until the next time their own browser happened to call
-- verify-membership, which a bad actor simply wouldn't do.
--
-- The fix: a stored "yes, still a member" is only trusted for a limited time.
--   - profiles.membership_verified_at records when Discord last confirmed it.
--   - is_verified_member() and is_mod() (the ONLY two things every RLS policy
--     in this app uses — checked across migrations 0001–0025) now also require
--     that confirmation to be recent. Once it ages out, database reads stop,
--     with no code path that needs to remember to check.
--   - The Edge Functions (see _shared/utils.ts) re-ask Discord whenever the
--     confirmation is more than 5 minutes old, so writes/actions are stopped
--     within minutes, not 30. The 30-minute window below only applies to
--     direct database reads, and exists so a Discord API outage doesn't lock
--     out every legitimate member at once.
--   - The app itself re-verifies in the background every 5 minutes while open
--     (AuthContext.tsx), so legitimate members never notice any of this.
--
-- IMPORTANT: the 30 minutes below must match MEMBERSHIP_TRUST_WINDOW_MS in
-- supabase/functions/_shared/utils.ts. membership_trust_window() is the one
-- place on the database side to change it.

alter table public.profiles
  add column membership_verified_at timestamptz;

-- Existing members: treat them as just-verified so nobody is locked out the
-- moment this migration runs. Anyone who has already left the server but
-- still has is_member = true loses access 30 minutes from now (or sooner,
-- the first time they or anyone acting for them touches an Edge Function).
update public.profiles
   set membership_verified_at = now()
 where is_member;

create function public.membership_trust_window()
returns interval
language sql
immutable
as $$
  select interval '30 minutes';
$$;

-- create or replace keeps every existing policy that calls these working.
create or replace function public.is_verified_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select is_member
             and membership_verified_at is not null
             and membership_verified_at > now() - public.membership_trust_window()
        from public.profiles
       where id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_mod()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select is_mod
             and is_member
             and membership_verified_at is not null
             and membership_verified_at > now() - public.membership_trust_window()
        from public.profiles
       where id = auth.uid()
    ),
    false
  );
$$;

-- profiles still has no insert/update policy for the authenticated role, so
-- membership_verified_at can only ever be written by Edge Functions using the
-- service role key — a client can't extend its own trust.
