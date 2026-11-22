-- Debbie — Desk Time: Focus Blocks.
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- The block's clock lives on the SERVER: the row records when it started and how
-- much time was on hold, and everything else (time left, finished or not) is
-- worked out from server time by the focus-block Edge Function. A refresh or a
-- closed laptop loses nothing. The browser never says a block is finished.
--
-- Security model (same pattern as daily_checkins / desk_layouts):
--   - Members can READ only their own rows (the goal is private to its owner).
--   - Nobody writes from the browser: there is no write policy. Only the
--     focus-block function (service role) creates and settles blocks.
--   - One running block per member (partial unique index), so a double click or
--     two tabs cannot start two.
--   - The completion reward goes through grant_reward() with the source key
--     "focus:<block id>", so a block can only ever pay once. Amounts, caps and
--     the on/off switches live in reward_rules / earning_settings (0028). The
--     'focus_block_complete' rule is inactive until you turn it on:
--       update public.reward_rules set is_active = true where event_type = 'focus_block_complete';
--
-- Not here on purpose: Discord nickname icon, "Focusing now", the between-block
-- check-in and earning pause, Desk Breaks, Shared Desk, Desk Sounds. Those are
-- undecided or need a Discord listener.

create table public.focus_blocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  activity      text not null check (activity in ('work', 'study', 'read', 'journal', 'create')),
  minutes       integer not null check (minutes between 1 and 240),
  goal          text check (goal is null or char_length(goal) <= 140),
  status        text not null default 'running' check (status in ('running', 'completed', 'stopped_early')),
  started_at    timestamptz not null default now(),
  held_at       timestamptz,                         -- set while on hold
  held_ms       bigint not null default 0 check (held_ms >= 0),  -- total time spent on hold
  ended_at      timestamptz,
  community_day date,                                -- the community day it finished in
  reward        jsonb,                               -- what grant_reward answered, once settled
  created_at    timestamptz not null default now()
);

create unique index focus_blocks_one_running_idx
  on public.focus_blocks (user_id) where status = 'running';
create index focus_blocks_user_started_idx
  on public.focus_blocks (user_id, started_at desc);
create index focus_blocks_user_day_idx
  on public.focus_blocks (user_id, community_day) where status = 'completed';

alter table public.focus_blocks enable row level security;
revoke all on public.focus_blocks from anon, authenticated;
grant select on public.focus_blocks to authenticated;

create policy "focus_blocks: read own rows"
  on public.focus_blocks for select
  using (user_id = auth.uid() and public.is_verified_member());

-- The community day a given moment falls in (same timezone setting as
-- community_today(), so a block settled the next morning still counts for the
-- day it was finished in).
create function public.community_day_of(p_ts timestamptz) returns date
language sql
stable
set search_path = public
as $$
  select (p_ts at time zone (select community_timezone from public.earning_settings where id))::date;
$$;

revoke all on function public.community_day_of(timestamptz) from public, anon, authenticated;
grant execute on function public.community_day_of(timestamptz) to service_role;
