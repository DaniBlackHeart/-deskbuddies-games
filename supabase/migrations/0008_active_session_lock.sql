-- DeskBuddies Games — global active-session lock
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Enforces "only one live session across the whole catalogue at a time,"
-- not just per-game. Every game's host Edge Function tries to insert a row
-- here before creating its session; the insert is atomic (guarded by the
-- singleton check below), so two mods racing to start two different games
-- at the same instant can't both win.
--
-- This table is never read or written by clients directly — only by
-- Edge Functions using the service role key, same as trivia_sessions'
-- write boundary. RLS is enabled with zero policies as defense in depth
-- (if it were ever queried with the anon/authenticated role, it returns
-- nothing rather than leaking who's hosting what).

create table public.active_session_lock (
  lock_key boolean primary key default true,
  constraint singleton check (lock_key), -- true is the only legal value, so at most one row can ever exist
  game text not null,
  session_id uuid not null,
  host_id uuid not null references public.profiles (id),
  started_at timestamptz not null default now()
);

alter table public.active_session_lock enable row level security;
-- No policies on purpose — not client-facing.
