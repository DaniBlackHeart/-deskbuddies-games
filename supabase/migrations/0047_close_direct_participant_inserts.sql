-- DeskBuddies Games — close the browser-side back door around the
-- one-game-per-member rule.
--
-- 0001 and 0021 let any verified member INSERT their own row into
-- session_participants / rebus_participants straight from the browser (and
-- rebus_participants also allowed UPDATE of their own row). That skipped
-- claimMemberSlot, so a member could be "in" several live sessions at once by
-- calling the Supabase client directly. Every legitimate join already goes
-- through an Edge Function using the service role (get-current-question,
-- rebus-play, rebus-host), which bypasses RLS, so these policies are unused.
-- SELECT policies are untouched.

drop policy if exists "session_participants: members join as self" on public.session_participants;
drop policy if exists "rebus_participants: members join as self" on public.rebus_participants;
drop policy if exists "rebus_participants: members update own team" on public.rebus_participants;
