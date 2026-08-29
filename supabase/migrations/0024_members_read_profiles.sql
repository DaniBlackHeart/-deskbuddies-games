-- DeskBuddies Games — verified members can read any profile's public info
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- What broke: WheelLobbyPage, FeudLobbyPage, UnoLobbyPage, ImpostorLobbyPage,
-- and RebusLobbyPage all fetch their participant roster with a client-side
-- embedded join, e.g.
--   supabase.from("wheel_participants")
--     .select("user_id, ..., profiles(username, avatar_url)")
-- That query runs as the signed-in user (not the service role), so it's
-- subject to profiles' RLS. Since 0001 only granted "read own row" (plus
-- 0003's "mods read all"), a regular member's embedded `profiles` comes back
-- null for every OTHER participant — PostgREST silently drops the row
-- rather than erroring, so those players' names/avatars just don't render.
-- A MOD sees everyone fine, since 0003 already covers them; only regular
-- members were affected. This is why the two Discord accounts in the
-- screenshots saw two different lobbies: kai (a MOD) saw both avatars,
-- Bliss (a regular member) only saw their own.
--
-- The fix: extend read access to any verified member, using the same
-- public.is_verified_member() helper every participant/round table in this
-- app already gates its own "any logged-in member can read this" policies
-- with (see 0007, 0011, 0012, 0017, 0019, 0021, and 0001 itself for
-- question_sets/questions). Username, avatar_url, and is_mod/is_member
-- status aren't sensitive here — they're the same info already visible to
-- everyone in the Discord server itself — and mods already get full-row
-- access today, so this isn't a new category of exposure, just extending
-- the same trust boundary the rest of the schema already uses to the one
-- table that was missing it.
--
-- Purely additive: the existing "read own row" and "mods read all" policies
-- are untouched. Multiple permissive SELECT policies combine with OR, so
-- this just adds a third way in — same pattern 0003 used.

create policy "profiles: verified members read all"
  on public.profiles for select
  using (public.is_verified_member());
