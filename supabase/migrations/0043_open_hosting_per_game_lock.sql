-- DeskBuddies Games — open hosting to every member, one live session PER GAME
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- What this does (all four changes agreed on 2026-11-26):
--   1. active_session_lock goes from "one live session across ALL games" to
--      "one live session PER GAME" (primary key = game). Up to six sessions
--      can now run at once, one for each game.
--   2. member_game_slots: a member can be in ONE game at a time (as host or
--      player) and spectating ONE game at a time. Edge Functions only.
--   3. Any member can host, so the places that were MOD-only purely so a MOD
--      host could see in-progress data now also allow that session's HOST.
--      Authoring content (sets, categories, puzzles) stays MOD-only.
--   4. live_games(): ONE query that returns every live game, for the
--      Reality Break / Home "what's live" card (replaces six table checks and
--      six realtime postgres_changes listeners).

-- =========================================================
-- 1. Per-game lock
-- =========================================================
alter table public.active_session_lock drop constraint if exists singleton;
alter table public.active_session_lock drop constraint if exists active_session_lock_pkey;
alter table public.active_session_lock drop column if exists lock_key;
-- If a stray duplicate game row ever existed, keep the newest one.
delete from public.active_session_lock a
  using public.active_session_lock b
  where a.game = b.game and a.started_at < b.started_at;
alter table public.active_session_lock add primary key (game);

comment on table public.active_session_lock is
  'One row per game that currently has a live session (PK = game). Edge Functions only; RLS on, no policies.';

-- =========================================================
-- 2. One game at a time per member
-- =========================================================
create table if not exists public.member_game_slots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_kind text not null check (slot_kind in ('active', 'spectate')),
  game text not null,
  session_id uuid not null,
  role text not null check (role in ('host', 'player', 'spectator')),
  created_at timestamptz not null default now(),
  primary key (user_id, slot_kind)
);

create index if not exists idx_member_game_slots_session on public.member_game_slots (session_id);

alter table public.member_game_slots enable row level security;
-- No policies on purpose — only Edge Functions (service role) touch this.

-- =========================================================
-- 3. Host-read access
-- =========================================================
-- True when the caller is a verified member AND is the host of that session.
create or replace function public.is_session_host(p_game text, p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_verified_member() and coalesce(
    case p_game
      when 'trivia'   then (select host_id = auth.uid() from public.trivia_sessions   where id = p_session_id)
      when 'feud'     then (select host_id = auth.uid() from public.feud_sessions     where id = p_session_id)
      when 'uno'      then (select host_id = auth.uid() from public.uno_sessions      where id = p_session_id)
      when 'impostor' then (select host_id = auth.uid() from public.impostor_sessions where id = p_session_id)
      when 'wheel'    then (select host_id = auth.uid() from public.wheel_sessions    where id = p_session_id)
      when 'rebus'    then (select host_id = auth.uid() from public.rebus_sessions    where id = p_session_id)
    end,
    false
  );
$$;

-- The host page needs these live; before this migration only MODs (the only
-- possible hosts) could read them. Same data, now also for that session's host.
create policy "trivia_session_questions: host reads"
  on public.trivia_session_questions for select
  using (public.is_session_host('trivia', session_id));

create policy "rebus_session_puzzles: host reads"
  on public.rebus_session_puzzles for select
  using (public.is_session_host('rebus', session_id));

create policy "rebus_session_sprint_puzzles: host reads"
  on public.rebus_session_sprint_puzzles for select
  using (public.is_session_host('rebus', session_id));

create policy "rebus_answers: host reads"
  on public.rebus_answers for select
  using (public.is_session_host('rebus', session_id));

create policy "rebus_sprint_answers: host reads"
  on public.rebus_sprint_answers for select
  using (public.is_session_host('rebus', session_id));

create policy "feud_fastmoney_answers: host reads"
  on public.feud_fastmoney_answers for select
  using (public.is_session_host('feud', session_id));

create policy "impostor_votes: host reads"
  on public.impostor_votes for select
  using (public.is_session_host('impostor', session_id));

-- Authored content the host page shows, only for the set the host's own live
-- session is using.
create policy "feud_round_questions: host of a live session reads"
  on public.feud_round_questions for select
  using (exists (
    select 1 from public.feud_sessions s
    where s.feud_set_id = feud_round_questions.feud_set_id
      and s.host_id = auth.uid() and s.status <> 'ended'
      and public.is_verified_member()
  ));

create policy "feud_fastmoney_questions: host of a live session reads"
  on public.feud_fastmoney_questions for select
  using (exists (
    select 1 from public.feud_sessions s
    where s.feud_set_id = feud_fastmoney_questions.feud_set_id
      and s.host_id = auth.uid() and s.status <> 'ended'
      and public.is_verified_member()
  ));

create policy "question_sets: host of a live session reads"
  on public.question_sets for select
  using (exists (
    select 1 from public.trivia_sessions s
    where s.question_set_id = question_sets.id
      and s.host_id = auth.uid() and s.status <> 'ended'
      and public.is_verified_member()
  ));

-- =========================================================
-- 4. One query for "what's live right now"
-- =========================================================
create or replace function public.live_games()
returns table (
  game text,
  session_id uuid,
  status text,
  host_username text,
  player_count int,
  created_at timestamptz,
  my_role text,          -- 'host' | 'player' if the caller is in this game, else null
  i_am_spectating boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select live.*,
         (select m.role from public.member_game_slots m
           where m.user_id = auth.uid() and m.slot_kind = 'active' and m.session_id = live.session_id) as my_role,
         exists (select 1 from public.member_game_slots m
           where m.user_id = auth.uid() and m.slot_kind = 'spectate' and m.session_id = live.session_id) as i_am_spectating
  from (
    select 'trivia'::text as game, s.id as session_id, s.status::text, p.username as host_username,
           (select count(*)::int from public.session_participants x where x.session_id = s.id) as player_count,
           s.created_at
      from public.trivia_sessions s left join public.profiles p on p.id = s.host_id
     where s.status <> 'ended'
    union all
    select 'feud', s.id, s.status::text, p.username,
           (select count(*)::int from public.feud_participants x where x.session_id = s.id), s.created_at
      from public.feud_sessions s left join public.profiles p on p.id = s.host_id
     where s.status <> 'ended'
    union all
    select 'uno', s.id, s.status::text, p.username,
           (select count(*)::int from public.uno_participants x where x.session_id = s.id), s.created_at
      from public.uno_sessions s left join public.profiles p on p.id = s.host_id
     where s.status <> 'ended'
    union all
    select 'impostor', s.id, s.status::text, p.username,
           (select count(*)::int from public.impostor_participants x where x.session_id = s.id), s.created_at
      from public.impostor_sessions s left join public.profiles p on p.id = s.host_id
     where s.status <> 'ended'
    union all
    select 'wheel', s.id, s.status::text, p.username,
           (select count(*)::int from public.wheel_participants x where x.session_id = s.id), s.created_at
      from public.wheel_sessions s left join public.profiles p on p.id = s.host_id
     where s.status <> 'ended'
    union all
    select 'rebus', s.id, s.status::text, p.username,
           (select count(*)::int from public.rebus_participants x where x.session_id = s.id), s.created_at
      from public.rebus_sessions s left join public.profiles p on p.id = s.host_id
     where s.status <> 'ended'
  ) live
  where public.is_verified_member()
  order by live.created_at desc;
$$;

revoke all on function public.live_games() from public, anon;
grant execute on function public.live_games() to authenticated;
