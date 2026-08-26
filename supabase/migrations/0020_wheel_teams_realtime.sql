-- DeskBuddies Games — fix missing Realtime registration on wheel_teams
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- 0019_wheel_team_mode.sql created wheel_teams with RLS enabled and a
-- "members read" policy, but — unlike every other live-state table added
-- in this project (trivia_sessions/session_participants in 0002,
-- feud_sessions/feud_participants/feud_rounds in 0007, uno_* in 0011,
-- impostor_* in 0012, wheel_sessions/wheel_participants/wheel_rounds in
-- 0017) — it was never added to the supabase_realtime publication.
--
-- This is the same class of bug already logged in PROJECT_CONTEXT.md §7
-- ("Realtime never enabled on the live-state tables in the original
-- migration"): writes to wheel_teams (create_team/join_team) succeeded
-- fine, but no client — including the team's own creator — ever received
-- a live postgres_changes event for it. Only a manual reload, which
-- re-queries the table directly instead of waiting on a broadcast, showed
-- the real state. This was the confirmed root cause of "stuck at creating
-- team name until reload" in Team mode.

alter publication supabase_realtime add table public.wheel_teams;
