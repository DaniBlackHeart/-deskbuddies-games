-- DeskBuddies Games — spectator mode for Family Feud
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Same model as 0006_spectator_mode.sql's trivia_sessions.spectator_id —
-- one MOD at a time can claim the read-only watch seat for a session.

alter table public.feud_sessions
  add column spectator_id uuid references public.profiles(id);

comment on column public.feud_sessions.spectator_id is
  'The one MOD currently watching this session as a read-only spectator '
  '(for streaming to members who just want to watch). Only one at a time '
  'per session; null = seat is free.';
