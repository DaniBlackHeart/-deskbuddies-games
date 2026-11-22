-- 0031_beyond_the_desk.sql
-- Debbie "Beyond the Desk": Daily Detours, Weekly Wins and Keepsakes.
--
-- Design: claude/Debbie_Beyond_the_Desk_UI_Spec_v1_LOCKED.md,
--         claude/Debbie_Milestones_Challenges_Detours_Draft_v0.md (v6),
--         claude/Debbie_Daily_Detours_Pool_v1.md.
--
-- Security model (same as check-ins and Focus Blocks):
--   - Everything here is written only by the beyond-the-desk Edge Function with
--     the service role. There are no write policies. The browser never says
--     what today's detours are, what a counter is, or that a goal is done.
--   - Members can read only their own claim / earned rows (RLS). Config tables
--     (prompts, goals, cards, steps) have no policies: service role only.
--   - Payouts go through grant_reward(), which is idempotent per source key:
--       detour:<community_day>:<prompt_key>   weekly:<week_start>:<goal_key>
--       milestone:<step_key>
--
-- Reward amounts are provisional config in reward_rules, all inactive. Nothing
-- pays until earning is switched on AND the rule is made active. Step amounts
-- are the Rika-pending values from the locked spec.
--
-- Not in this migration on purpose: the 52 Side Quests wheel, the puzzle,
-- games, Well-Rounded, Share and event goals, Collection and Brain & Play
-- Keepsake cards (their features are not built, so they stay out of the pool).

-- ---------------------------------------------------------------------------
-- Settings (single row) ---------------------------------------------------------
-- ---------------------------------------------------------------------------
create table public.beyond_settings (
  id                   boolean primary key default true check (id),
  weekly_goals_shown   integer not null default 5 check (weekly_goals_shown between 1 and 8),
  full_week_goals      integer not null default 3 check (full_week_goals >= 1),
  min_goals_visible    integer not null default 3 check (min_goals_visible >= 1)
);
insert into public.beyond_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Daily Detours ----------------------------------------------------------------
-- ---------------------------------------------------------------------------
create table public.detour_prompts (
  key               text primary key,
  slot              text not null check (slot in ('move', 'make', 'play')),
  text              text not null check (char_length(text) between 1 and 200),
  is_active         boolean not null default true,
  requires_feature  text,                       -- documentation: why a prompt is held
  created_at        timestamptz not null default now()
);

-- The day's three, stored the first time anyone asks, so everyone sees the same.
create table public.detour_days (
  community_day date not null,
  slot          text not null check (slot in ('move', 'make', 'play')),
  prompt_key    text not null references public.detour_prompts (key),
  primary key (community_day, slot)
);

create table public.detour_claims (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  community_day date not null,
  prompt_key    text not null references public.detour_prompts (key),
  created_at    timestamptz not null default now(),
  unique (user_id, community_day, prompt_key)
);
create index detour_claims_user_day_idx on public.detour_claims (user_id, community_day);

insert into public.detour_prompts (key, slot, text, is_active, requires_feature) values
  ('dt_a01', 'move', 'Stretch your neck and shoulders for one slow minute.', true, null),
  ('dt_a02', 'move', 'Drink a glass of water, no screen in your hand.', true, null),
  ('dt_a03', 'move', 'Look at something far away for 30 seconds.', true, null),
  ('dt_a04', 'move', 'Shake out your hands and shoulders.', true, null),
  ('dt_a05', 'move', 'Take five slow breaths.', true, null),
  ('dt_a06', 'move', 'Walk to the end of your room, hallway or street and back.', true, null),
  ('dt_a07', 'move', 'Roll your wrists and ankles for a minute.', true, null),
  ('dt_a08', 'move', 'Unclench your jaw and drop your shoulders.', true, null),
  ('dt_a09', 'move', 'Open a window or step outside for fresh air.', true, null),
  ('dt_a11', 'move', 'Close your eyes for one minute, no screen.', true, null),
  ('dt_a12', 'move', 'Eat a snack or merienda away from your desk.', true, null),
  ('dt_b01', 'make', 'Read one page, paragraph or saved post.', true, null),
  ('dt_b02', 'make', 'Learn one new word or fact.', true, null),
  ('dt_b03', 'make', 'Doodle anything for two minutes.', true, null),
  ('dt_b04', 'make', 'Tidy one small corner of your desk.', true, null),
  ('dt_b05', 'make', 'Make a drink or snack with a little care (instant counts).', true, null),
  ('dt_b06', 'make', 'Write one line just for yourself (nothing is saved here).', true, null),
  ('dt_b07', 'make', 'Close five tabs or files you''re done with.', true, null),
  ('dt_b08', 'make', 'Jot tomorrow''s one top thing (nothing is saved here).', true, null),
  ('dt_b09', 'make', 'Look up one thing you''ve been curious about.', true, null),
  ('dt_b10', 'make', 'Put one thing back where it belongs.', true, null),
  ('dt_b11', 'make', 'Learn how to say hello in a language you don''t know.', true, null),
  ('dt_b12', 'make', 'Name one tiny thing you''d like to make this week.', true, null),
  ('dt_c01', 'play', 'Put on one song and hum, sing or tap along.', true, null),
  ('dt_c02', 'play', 'Say thank you to someone.', true, null),
  ('dt_c03', 'play', 'Send a kind message to a friend or family member.', true, null),
  ('dt_c04', 'play', 'Make up a silly name for something on your desk.', true, null),
  ('dt_c05', 'play', 'Play with a pet, a toy or a fidget for a minute.', true, null),
  ('dt_c06', 'play', 'Think of one good thing from today.', true, null),
  ('dt_c07', 'play', 'React to someone''s post in the Common Room.', false, 'common_room'),
  ('dt_c08', 'play', 'Ask someone at home how their day is going.', true, null),
  ('dt_c09', 'play', 'Send a friend a song you like.', true, null),
  ('dt_c10', 'play', 'Compliment an online or work friend.', true, null),
  ('dt_c11', 'play', 'Look at a photo that makes you smile.', true, null),
  ('dt_c12', 'play', 'Dance for the length of one song.', true, null);

-- ---------------------------------------------------------------------------
-- Weekly Wins ------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- counter says which stored events the goal counts. Only goals whose feature
-- exists are live; the rest are not listed at all.
create table public.weekly_goal_pool (
  key        text primary key,
  name       text not null,
  goal_text  text not null,
  counter    text not null check (counter in ('checkin_days', 'focus_blocks', 'detours')),
  target     integer not null check (target > 0),
  unit       text not null,
  is_live    boolean not null default true,
  is_pinned  boolean not null default false,
  sort       integer not null default 0
);

create table public.weekly_goal_weeks (
  week_start date not null,                    -- the Monday, Asia/Manila
  goal_key   text not null references public.weekly_goal_pool (key),
  primary key (week_start, goal_key)
);

create table public.weekly_goal_claims (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  goal_key   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start, goal_key),
  foreign key (week_start, goal_key) references public.weekly_goal_weeks (week_start, goal_key)
);

insert into public.weekly_goal_pool (key, name, goal_text, counter, target, unit, is_pinned, sort) values
  ('ww_show_up',        'Show Up',        'Check in on 4 different days.', 'checkin_days', 4, 'days',    true,  1),
  ('ww_settle_in',      'Settle In',      'Finish 3 Focus Blocks.',        'focus_blocks', 3, 'blocks',  false, 2),
  ('ww_little_detours', 'Little Detours', 'Do 7 Daily Detours.',           'detours',      7, 'detours', false, 4);

-- ---------------------------------------------------------------------------
-- Keepsakes --------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- A card's key is also the name of its counter in beyond_counters() below.
create table public.keepsake_cards (
  key         text primary key,
  category    text not null,
  name        text not null,
  counts_text text not null,
  sort        integer not null default 0,
  is_live     boolean not null default false     -- a category shows once one card is live
);

create table public.keepsake_steps (
  step_key   text primary key,                   -- also the reward_rules event_type
  card_key   text not null references public.keepsake_cards (key),
  tier       text not null check (tier in ('bronze', 'silver', 'gold')),
  threshold  integer not null check (threshold > 0),
  unique (card_key, tier)
);

-- Steps are permanent: a row here is never removed and never lowers a counter.
create table public.keepsake_earned (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  step_key  text not null references public.keepsake_steps (step_key),
  earned_at timestamptz not null default now(),
  primary key (user_id, step_key)
);

insert into public.keepsake_cards (key, category, name, counts_text, sort, is_live) values
  ('keep_streak', 'Desk Habits', 'Buddy Streak', 'Best streak, in days', 1, true),
  ('keep_seat', 'Desk Habits', 'Regular Seat', 'Different days you checked in', 2, true),
  ('keep_seasons', 'Desk Habits', 'Across the Seasons', 'Different months you checked in', 3, true),
  ('keep_welcome_back', 'Desk Habits', 'Welcome Back', 'Checking in after 7 or more days away', 4, true),
  ('keep_focus', 'Desk Habits', 'Deep Desk', 'Focus Blocks finished', 5, true),
  ('keep_long_haul', 'Desk Habits', 'Long Haul', 'Days with a finished Focus Block', 6, true),
  ('keep_detour', 'Detours & Wins', 'Daily Detours', 'Daily Detours tried', 7, true),
  ('keep_many_detours', 'Detours & Wins', 'Many Detours', 'Different detour prompts tried', 8, true),
  ('keep_wins', 'Detours & Wins', 'Weekly Wins', 'Weeks with a goal finished', 9, true),
  ('keep_full_week', 'Detours & Wins', 'A Full Week', 'Weeks with 3 or more goals finished', 10, true);

insert into public.keepsake_steps (step_key, card_key, tier, threshold) values
  ('keep_streak_bronze', 'keep_streak', 'bronze', 7),
  ('keep_streak_silver', 'keep_streak', 'silver', 30),
  ('keep_streak_gold', 'keep_streak', 'gold', 100),
  ('keep_seat_bronze', 'keep_seat', 'bronze', 10),
  ('keep_seat_silver', 'keep_seat', 'silver', 30),
  ('keep_seat_gold', 'keep_seat', 'gold', 100),
  ('keep_seasons_bronze', 'keep_seasons', 'bronze', 3),
  ('keep_seasons_silver', 'keep_seasons', 'silver', 6),
  ('keep_seasons_gold', 'keep_seasons', 'gold', 12),
  ('keep_welcome_back_bronze', 'keep_welcome_back', 'bronze', 1),
  ('keep_focus_bronze', 'keep_focus', 'bronze', 10),
  ('keep_focus_silver', 'keep_focus', 'silver', 50),
  ('keep_focus_gold', 'keep_focus', 'gold', 150),
  ('keep_long_haul_bronze', 'keep_long_haul', 'bronze', 10),
  ('keep_long_haul_silver', 'keep_long_haul', 'silver', 30),
  ('keep_long_haul_gold', 'keep_long_haul', 'gold', 100),
  ('keep_detour_bronze', 'keep_detour', 'bronze', 25),
  ('keep_detour_silver', 'keep_detour', 'silver', 100),
  ('keep_detour_gold', 'keep_detour', 'gold', 250),
  ('keep_many_detours_bronze', 'keep_many_detours', 'bronze', 10),
  ('keep_many_detours_silver', 'keep_many_detours', 'silver', 20),
  ('keep_many_detours_gold', 'keep_many_detours', 'gold', 30),
  ('keep_wins_bronze', 'keep_wins', 'bronze', 8),
  ('keep_wins_silver', 'keep_wins', 'silver', 26),
  ('keep_wins_gold', 'keep_wins', 'gold', 52),
  ('keep_full_week_bronze', 'keep_full_week', 'bronze', 1),
  ('keep_full_week_silver', 'keep_full_week', 'silver', 4),
  ('keep_full_week_gold', 'keep_full_week', 'gold', 12);

-- ---------------------------------------------------------------------------
-- Reward rules (all inactive until Rika approves the numbers) ------------------
-- ---------------------------------------------------------------------------
insert into public.reward_rules (event_type, label, xp, deskbits, cap_group, daily_cap_count, is_active) values
  ('daily_detour', 'Tried a Daily Detour', 3, 1, 'detour', 3, false);

insert into public.reward_rules (event_type, label, xp, deskbits, is_active) values
  ('keep_streak_bronze', 'Keepsake: Buddy Streak, bronze', 25, 20, false),
  ('keep_streak_silver', 'Keepsake: Buddy Streak, silver', 75, 60, false),
  ('keep_streak_gold', 'Keepsake: Buddy Streak, gold', 200, 150, false),
  ('keep_seat_bronze', 'Keepsake: Regular Seat, bronze', 20, 10, false),
  ('keep_seat_silver', 'Keepsake: Regular Seat, silver', 50, 30, false),
  ('keep_seat_gold', 'Keepsake: Regular Seat, gold', 120, 80, false),
  ('keep_seasons_bronze', 'Keepsake: Across the Seasons, bronze', 20, 10, false),
  ('keep_seasons_silver', 'Keepsake: Across the Seasons, silver', 50, 30, false),
  ('keep_seasons_gold', 'Keepsake: Across the Seasons, gold', 100, 60, false),
  ('keep_welcome_back_bronze', 'Keepsake: Welcome Back, bronze', 20, 10, false),
  ('keep_focus_bronze', 'Keepsake: Deep Desk, bronze', 30, 20, false),
  ('keep_focus_silver', 'Keepsake: Deep Desk, silver', 100, 60, false),
  ('keep_focus_gold', 'Keepsake: Deep Desk, gold', 150, 90, false),
  ('keep_long_haul_bronze', 'Keepsake: Long Haul, bronze', 25, 15, false),
  ('keep_long_haul_silver', 'Keepsake: Long Haul, silver', 65, 40, false),
  ('keep_long_haul_gold', 'Keepsake: Long Haul, gold', 125, 80, false),
  ('keep_detour_bronze', 'Keepsake: Daily Detours, bronze', 25, 15, false),
  ('keep_detour_silver', 'Keepsake: Daily Detours, silver', 80, 50, false),
  ('keep_detour_gold', 'Keepsake: Daily Detours, gold', 120, 80, false),
  ('keep_many_detours_bronze', 'Keepsake: Many Detours, bronze', 25, 15, false),
  ('keep_many_detours_silver', 'Keepsake: Many Detours, silver', 65, 40, false),
  ('keep_many_detours_gold', 'Keepsake: Many Detours, gold', 125, 80, false),
  ('keep_wins_bronze', 'Keepsake: Weekly Wins, bronze', 80, 50, false),
  ('keep_wins_silver', 'Keepsake: Weekly Wins, silver', 100, 70, false),
  ('keep_wins_gold', 'Keepsake: Weekly Wins, gold', 160, 100, false),
  ('keep_full_week_bronze', 'Keepsake: A Full Week, bronze', 40, 25, false),
  ('keep_full_week_silver', 'Keepsake: A Full Week, silver', 80, 50, false),
  ('keep_full_week_gold', 'Keepsake: A Full Week, gold', 150, 90, false);

-- ---------------------------------------------------------------------------
-- Access -------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
alter table public.beyond_settings    enable row level security;
alter table public.detour_prompts     enable row level security;
alter table public.detour_days        enable row level security;
alter table public.detour_claims      enable row level security;
alter table public.weekly_goal_pool   enable row level security;
alter table public.weekly_goal_weeks  enable row level security;
alter table public.weekly_goal_claims enable row level security;
alter table public.keepsake_cards     enable row level security;
alter table public.keepsake_steps     enable row level security;
alter table public.keepsake_earned    enable row level security;

revoke all on public.beyond_settings, public.detour_prompts, public.detour_days,
              public.detour_claims, public.weekly_goal_pool, public.weekly_goal_weeks,
              public.weekly_goal_claims, public.keepsake_cards, public.keepsake_steps,
              public.keepsake_earned
  from anon, authenticated;
grant select on public.detour_claims, public.weekly_goal_claims, public.keepsake_earned to authenticated;

create policy "detour_claims: read own rows"
  on public.detour_claims for select
  using (user_id = auth.uid() and public.is_verified_member());
create policy "weekly_goal_claims: read own rows"
  on public.weekly_goal_claims for select
  using (user_id = auth.uid() and public.is_verified_member());
create policy "keepsake_earned: read own rows"
  on public.keepsake_earned for select
  using (user_id = auth.uid() and public.is_verified_member());

-- ---------------------------------------------------------------------------
-- The daily pick: per slot, the active prompt shown least recently (never shown
-- first), ties broken by a hash of the date. Stored on first request; the
-- advisory lock means two members opening the app at midnight cannot store
-- different sets.
-- ---------------------------------------------------------------------------
create function public.ensure_detour_day(p_day date)
returns table (slot text, prompt_key text, prompt_text text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot text;
begin
  if p_day is distinct from public.community_today() then
    raise exception 'ensure_detour_day: only today can be picked';
  end if;

  perform pg_advisory_xact_lock(hashtext('detour_day:' || p_day::text));

  foreach v_slot in array array['move', 'make', 'play'] loop
    if not exists (select 1 from public.detour_days d where d.community_day = p_day and d.slot = v_slot) then
      insert into public.detour_days (community_day, slot, prompt_key)
      select p_day, v_slot, p.key
        from public.detour_prompts p
       where p.slot = v_slot and p.is_active
       order by (select max(d.community_day) from public.detour_days d where d.prompt_key = p.key) asc nulls first,
                md5(p_day::text || p.key)
       limit 1;
    end if;
  end loop;

  return query
    select d.slot, d.prompt_key, p.text
      from public.detour_days d
      join public.detour_prompts p on p.key = d.prompt_key
     where d.community_day = p_day
     order by case d.slot when 'move' then 1 when 'make' then 2 else 3 end;
end;
$$;

-- ---------------------------------------------------------------------------
-- The weekly pick: pinned live goals first, then the live goals shown least
-- recently, up to weekly_goals_shown. Stored on first request.
-- ---------------------------------------------------------------------------
create function public.ensure_goal_week(p_week date)
returns table (goal_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shown integer;
begin
  if p_week is distinct from date_trunc('week', public.community_today()::timestamp)::date then
    raise exception 'ensure_goal_week: only the current week can be picked';
  end if;

  perform pg_advisory_xact_lock(hashtext('goal_week:' || p_week::text));

  if not exists (select 1 from public.weekly_goal_weeks w where w.week_start = p_week) then
    select weekly_goals_shown into v_shown from public.beyond_settings where id;

    insert into public.weekly_goal_weeks (week_start, goal_key)
    select p_week, g.key
      from public.weekly_goal_pool g
     where g.is_live
     order by g.is_pinned desc,
              (select max(w.week_start) from public.weekly_goal_weeks w where w.goal_key = g.key) asc nulls first,
              md5(p_week::text || g.key)
     limit v_shown;
  end if;

  return query select w.goal_key from public.weekly_goal_weeks w where w.week_start = p_week;
end;
$$;

-- ---------------------------------------------------------------------------
-- Counters, worked out from stored events (never sent by the browser) ----------
-- ---------------------------------------------------------------------------
create function public.beyond_week_counters(p_user uuid, p_week date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'checkin_days', (select count(*) from public.daily_checkins
                      where user_id = p_user and checkin_date between p_week and p_week + 6),
    'focus_blocks', (select count(*) from public.focus_blocks
                      where user_id = p_user and status = 'completed'
                        and community_day between p_week and p_week + 6),
    'detours',      (select count(*) from public.detour_claims
                      where user_id = p_user and community_day between p_week and p_week + 6)
  );
$$;

-- "Welcome Back" counts check-ins made 7 or more days after the previous one.
create function public.beyond_counters(p_user uuid)
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
                          ) f)
  );
$$;

revoke all on function public.ensure_detour_day(date), public.ensure_goal_week(date),
                       public.beyond_week_counters(uuid, date), public.beyond_counters(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_detour_day(date), public.ensure_goal_week(date),
                          public.beyond_week_counters(uuid, date), public.beyond_counters(uuid)
  to service_role;
