-- DeskBuddies Games — enable Realtime
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- The app subscribes to live changes on these three tables (join
-- notifications, live leaderboard updates, question/status changes).
-- Supabase requires each table to be explicitly added to the
-- `supabase_realtime` publication — this was missed in the initial
-- migration, which is why live updates weren't showing up.

alter publication supabase_realtime add table public.trivia_sessions;
alter publication supabase_realtime add table public.session_participants;
alter publication supabase_realtime add table public.answers;
