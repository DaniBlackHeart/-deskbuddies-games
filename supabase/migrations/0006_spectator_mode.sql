-- DeskBuddies Games — spectator mode
-- Run via: supabase db push  (or paste into the Supabase SQL editor)

alter table public.trivia_sessions
  add column spectator_id uuid references public.profiles(id);

comment on column public.trivia_sessions.spectator_id is
  'The one MOD currently watching this session as a read-only spectator '
  '(for streaming to members who just want to watch). Only one at a time '
  'per session; null = seat is free.';
