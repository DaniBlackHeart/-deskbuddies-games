-- 0051_daily_puzzle_milestones.sql
-- Wires the Daily Puzzle into the milestone systems that were waiting for it:
--   1. Stamp "First Brain Break" goes live (finished a first daily puzzle).
--   2. Keepsake card "Brain Break Habit" (days you finished the daily puzzle,
--      steps 10 / 30 / 100) goes live under Brain & Play.
--   3. Paper Pal, the first buddy, can now be earned.
--
-- Same rules as the rest of the milestone systems:
--   * Counted from the member's own stored history (daily.puzzle_attempts), so
--     nothing needs repairing and late joiners can earn everything.
--   * A finished puzzle counts whether it was solved or not. A puzzle left
--     unfinished at midnight never finishes, so it never counts.
--   * Stamps and steps are permanent; nothing here removes or lowers one.
--   * Reward amounts are provisional values from the locked UI spec and stay
--     INACTIVE (is_active = false) until Rika approves them, like every other
--     milestone reward. The stamp / step is still earned and shown without it.
--
-- Paper Pal rule (owner-confirmed 21 Nov, Buddy Collection doc): the member has
-- checked in on at least two different days AND has finished one starter
-- activity (a completed Focus Block or a finished daily puzzle). The days need
-- not be consecutive. No win and no post is needed.

-- ---------------------------------------------------------------------------
-- 1. Stamp: First Brain Break ---------------------------------------------------
-- ---------------------------------------------------------------------------
update public.stamp_defs set is_live = true where key = 'stamp_first_brain_break';

insert into public.reward_rules (event_type, label, xp, deskbits, is_active)
values ('stamp_first_brain_break', 'Stamp: First Brain Break', 5, 0, false)
on conflict (event_type) do nothing;

-- Same function as 0033 plus the new key (every existing key is unchanged).
create or replace function public.buddybook_stamp_facts(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'stamp_first_hello',  (select min(checkin_date) from public.daily_checkins where user_id = p_user),
    'stamp_first_block',  (select min(community_day) from public.focus_blocks
                            where user_id = p_user and status = 'completed'),
    'stamp_first_brain_break', (select min(puzzle_date) from daily.puzzle_attempts
                                 where user_id = p_user and status in ('solved', 'unsolved')),
    'stamp_first_detour', (select min(community_day) from public.detour_claims where user_id = p_user),
    'stamp_first_win',    (select public.community_day_of(min(created_at)) from public.weekly_goal_claims where user_id = p_user),
    'stamp_made_it_mine', (select public.community_day_of(updated_at) from public.desk_layouts where user_id = p_user)
  );
$$;
revoke all on function public.buddybook_stamp_facts(uuid) from public, anon, authenticated;
grant execute on function public.buddybook_stamp_facts(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Keepsake: Brain Break Habit --------------------------------------------------
-- ---------------------------------------------------------------------------
insert into public.keepsake_cards (key, category, name, counts_text, sort, is_live)
values ('keep_brain_break', 'Brain & Play', 'Brain Break Habit', 'Days you finished the daily puzzle', 11, true)
on conflict (key) do update set is_live = true;

insert into public.keepsake_steps (step_key, card_key, tier, threshold) values
  ('keep_brain_break_bronze', 'keep_brain_break', 'bronze', 10),
  ('keep_brain_break_silver', 'keep_brain_break', 'silver', 30),
  ('keep_brain_break_gold',   'keep_brain_break', 'gold',   100)
on conflict (step_key) do nothing;

insert into public.reward_rules (event_type, label, xp, deskbits, is_active) values
  ('keep_brain_break_bronze', 'Keepsake: Brain Break Habit, bronze', 30, 20, false),
  ('keep_brain_break_silver', 'Keepsake: Brain Break Habit, silver', 80, 50, false),
  ('keep_brain_break_gold',   'Keepsake: Brain Break Habit, gold',  120, 80, false)
on conflict (event_type) do nothing;

-- Same function as 0031 plus the new counter (every existing counter is unchanged).
create or replace function public.beyond_counters(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ck as (
    select checkin_date as d from public.daily_checkins where user_id = p_user
  ),
  runs as (
    select d, d - (row_number() over (order by d))::int as grp from ck
  ),
  gaps as (
    select d, lag(d) over (order by d) as prev from ck
  ),
  fb as (
    select community_day as d from public.focus_blocks
     where user_id = p_user and status = 'completed' and community_day is not null
  )
  select jsonb_build_object(
    'keep_streak',       coalesce((select max(c) from (select count(*) as c from runs group by grp) x), 0),
    'keep_seat',         (select count(*) from ck),
    'keep_seasons',      (select count(distinct to_char(d, 'YYYY-MM')) from ck),
    'keep_welcome_back', (select count(*) from gaps where prev is not null and d - prev >= 7),
    'keep_focus',        (select count(*) from fb),
    'keep_long_haul',    (select count(distinct d) from fb),
    'keep_detour',       (select count(*) from public.detour_claims where user_id = p_user),
    'keep_many_detours', (select count(distinct prompt_key) from public.detour_claims where user_id = p_user),
    'keep_wins',         (select count(distinct week_start) from public.weekly_goal_claims where user_id = p_user),
    'keep_full_week',    (select count(*) from (
                            select week_start from public.weekly_goal_claims
                             where user_id = p_user group by week_start
                            having count(*) >= (select full_week_goals from public.beyond_settings where id)
                          ) f),
    'keep_brain_break',  (select count(distinct puzzle_date) from daily.puzzle_attempts
                           where user_id = p_user and status in ('solved', 'unsolved'))
  );
$$;
revoke all on function public.beyond_counters(uuid) from public, anon, authenticated;
grant execute on function public.beyond_counters(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Paper Pal ---------------------------------------------------------------------
-- Safe to call as often as you like: it does nothing once the member has Paper
-- Pal, or while the rule is not met. Returns true only when it just granted it.
-- Granting writes member_items, which already notifies the member (0039).
-- ---------------------------------------------------------------------------
create function public.grant_paper_pal(p_user uuid) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_granted integer;
begin
  if exists (select 1 from public.member_items
              where user_id = p_user and item_key = 'companion:paper') then
    return false;
  end if;

  if (select count(distinct checkin_date) from public.daily_checkins where user_id = p_user) < 2 then
    return false;
  end if;

  if not (
    exists (select 1 from public.focus_blocks where user_id = p_user and status = 'completed')
    or exists (select 1 from daily.puzzle_attempts
                where user_id = p_user and status in ('solved', 'unsolved'))
  ) then
    return false;
  end if;

  insert into public.member_items (user_id, item_key, source)
  values (p_user, 'companion:paper', 'milestone:paper')
  on conflict (user_id, item_key) do nothing;
  get diagnostics v_granted = row_count;
  return v_granted > 0;
end;
$$;
revoke all on function public.grant_paper_pal(uuid) from public, anon, authenticated;
grant execute on function public.grant_paper_pal(uuid) to service_role;
