-- 0028_reward_ledger.sql
-- Debbie earning foundation: one append-only ledger, one balance row per
-- member, one function (grant_reward) that is the only way to pay out.
--
-- Design: claude/Debbie_Earning_System_Draft_v0.md (sections 3, 4 and 12).
-- Values below are the initial config Rika approved on 21 Nov 2026. They live
-- in reward_rules, not in code. NOTHING PAYS until the master switch is
-- turned on:  update public.earning_settings set earning_enabled = true;
--
-- Not in this migration on purpose: levels (curve not settled), spending,
-- reversals/corrections (policy undecided), milestones, streak freezes, VC XP.

-- ---------------------------------------------------------------------------
-- Settings (single row) -------------------------------------------------------
-- ---------------------------------------------------------------------------
create table public.earning_settings (
  id                 boolean primary key default true check (id),  -- exactly one row
  earning_enabled    boolean not null default false,               -- master switch
  daily_xp_ceiling   integer not null default 200 check (daily_xp_ceiling >= 0),
  community_timezone text not null default 'Asia/Manila',          -- the one community day
  updated_at         timestamptz not null default now()
);
insert into public.earning_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Rules (config, versioned) ----------------------------------------------------
-- ---------------------------------------------------------------------------
create table public.reward_rules (
  event_type      text primary key,
  label           text not null,   -- plain, non-private wording for the Desk Log
  xp              integer not null default 0 check (xp >= 0),
  deskbits        integer not null default 0 check (deskbits >= 0),
  cap_group       text,
  daily_cap_count integer check (daily_cap_count is null or daily_cap_count > 0),
  is_active       boolean not null default false,
  version         integer not null default 1,
  updated_at      timestamptz not null default now(),
  check ((cap_group is null) = (daily_cap_count is null))
);

create function public.reward_rules_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.xp, new.deskbits, new.cap_group, new.daily_cap_count)
     is distinct from (old.xp, old.deskbits, old.cap_group, old.daily_cap_count) then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger reward_rules_touch
  before update on public.reward_rules
  for each row execute function public.reward_rules_touch();

-- ---------------------------------------------------------------------------
-- Ledger (append-only truth) ---------------------------------------------------
-- ---------------------------------------------------------------------------
create table public.reward_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  event_type     text not null references public.reward_rules(event_type),
  source_key     text not null check (char_length(source_key) between 1 and 200),
  xp_delta       integer not null default 0,
  deskbits_delta integer not null default 0,
  payout         text not null check (payout in ('paid', 'capped_type', 'capped_daily')),
  cap_group      text,                       -- snapshot, so later rule edits don't regroup history
  community_day  date not null,
  rule_version   integer not null,
  reverses_id    uuid references public.reward_ledger(id),
  meta           jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 2048),
  created_at     timestamptz not null default now(),
  unique (user_id, source_key),              -- idempotency: one real action, one row
  -- anything that lowers deskbits (a purchase) must never touch XP
  check (deskbits_delta >= 0 or xp_delta = 0)
);

create index reward_ledger_user_day_group_idx
  on public.reward_ledger (user_id, community_day, cap_group);
create index reward_ledger_user_created_idx
  on public.reward_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Balances (cached totals, updated in the same transaction as the ledger) -----
-- ---------------------------------------------------------------------------
create table public.member_progress (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  xp_total         bigint not null default 0 check (xp_total >= 0),
  deskbits_balance bigint not null default 0 check (deskbits_balance >= 0),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access: members read their own rows; nobody writes except through the
-- functions below (service role). ---------------------------------------------
-- ---------------------------------------------------------------------------
alter table public.earning_settings enable row level security;
alter table public.reward_rules     enable row level security;
alter table public.reward_ledger    enable row level security;
alter table public.member_progress  enable row level security;

revoke all on public.earning_settings, public.reward_rules,
              public.reward_ledger,    public.member_progress
  from anon, authenticated;
grant select on public.reward_ledger, public.member_progress to authenticated;

create policy "reward_ledger: read own rows"
  on public.reward_ledger for select
  using (user_id = auth.uid() and public.is_verified_member());

create policy "member_progress: read own row"
  on public.member_progress for select
  using (user_id = auth.uid() and public.is_verified_member());

-- earning_settings and reward_rules have no policies: service role only.

-- ---------------------------------------------------------------------------
-- The community day: the single place it is computed ---------------------------
-- ---------------------------------------------------------------------------
create function public.community_today() returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone (select community_timezone from public.earning_settings where id))::date;
$$;

-- ---------------------------------------------------------------------------
-- grant_reward: the only way to pay out ----------------------------------------
-- Returns jsonb: { status, xp, deskbits, payout? }
--   status: granted | capped | duplicate | disabled | no_rule | not_member
-- ---------------------------------------------------------------------------
create function public.grant_reward(
  p_user_id    uuid,
  p_event_type text,
  p_source_key text,
  p_meta       jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings       public.earning_settings;
  v_rule           public.reward_rules;
  v_existing       public.reward_ledger;
  v_is_member      boolean;
  v_today          date;
  v_paid_in_group  integer;
  v_xp_today       bigint;
  v_room           bigint;
  v_xp             integer;
  v_deskbits       integer;
  v_payout         text := 'paid';
begin
  if p_source_key is null or char_length(p_source_key) < 1 or char_length(p_source_key) > 200 then
    raise exception 'grant_reward: invalid source_key';
  end if;

  select * into v_settings from public.earning_settings where id;
  if not v_settings.earning_enabled then
    return jsonb_build_object('status', 'disabled', 'xp', 0, 'deskbits', 0);
  end if;

  select * into v_rule from public.reward_rules
   where event_type = p_event_type and is_active;
  if not found then
    return jsonb_build_object('status', 'no_rule', 'xp', 0, 'deskbits', 0);
  end if;

  select is_member into v_is_member from public.profiles where id = p_user_id;
  if v_is_member is distinct from true then
    return jsonb_build_object('status', 'not_member', 'xp', 0, 'deskbits', 0);
  end if;

  -- Serialize every grant for this member, so caps hold under parallel requests.
  insert into public.member_progress (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  perform 1 from public.member_progress where user_id = p_user_id for update;

  -- Same real action twice (retry, refresh, double click): no second payout.
  select * into v_existing from public.reward_ledger
   where user_id = p_user_id and source_key = p_source_key;
  if found then
    return jsonb_build_object('status', 'duplicate',
                              'xp', v_existing.xp_delta,
                              'deskbits', v_existing.deskbits_delta);
  end if;

  v_today    := public.community_today();
  v_xp       := v_rule.xp;
  v_deskbits := v_rule.deskbits;

  -- Per-type daily cap: paid grants in this cap group today.
  if v_rule.cap_group is not null then
    select count(*) into v_paid_in_group from public.reward_ledger
     where user_id = p_user_id and community_day = v_today
       and cap_group = v_rule.cap_group and payout = 'paid';
    if v_paid_in_group >= v_rule.daily_cap_count then
      v_xp := 0; v_deskbits := 0; v_payout := 'capped_type';
    end if;
  end if;

  -- Overall daily XP ceiling. XP is clipped to the room left; with no room left
  -- the grant pays nothing (XP and deskbits). Activity is still recorded.
  if v_payout = 'paid' and v_xp > 0 then
    select coalesce(sum(xp_delta), 0) into v_xp_today from public.reward_ledger
     where user_id = p_user_id and community_day = v_today and payout = 'paid';
    v_room := greatest(v_settings.daily_xp_ceiling - v_xp_today, 0);
    if v_room = 0 then
      v_xp := 0; v_deskbits := 0; v_payout := 'capped_daily';
    elsif v_xp > v_room then
      v_xp := v_room;
    end if;
  end if;

  insert into public.reward_ledger
    (user_id, event_type, source_key, xp_delta, deskbits_delta, payout,
     cap_group, community_day, rule_version, meta)
  values
    (p_user_id, p_event_type, p_source_key, v_xp, v_deskbits, v_payout,
     v_rule.cap_group, v_today, v_rule.version, coalesce(p_meta, '{}'::jsonb));

  update public.member_progress
     set xp_total         = xp_total + v_xp,
         deskbits_balance = deskbits_balance + v_deskbits,
         updated_at       = now()
   where user_id = p_user_id;

  return jsonb_build_object(
    'status',   case when v_payout = 'paid' then 'granted' else 'capped' end,
    'xp',       v_xp,
    'deskbits', v_deskbits,
    'payout',   v_payout
  );
end;
$$;

revoke all on function public.grant_reward(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.grant_reward(uuid, text, text, jsonb) to service_role;
revoke all on function public.community_today() from public, anon, authenticated;
grant execute on function public.community_today() to service_role;

-- ---------------------------------------------------------------------------
-- Initial rules (Rika, 21 Nov 2026). Only the check-in feature exists today, so
-- only that rule is active; the rest switch on when their feature ships.
-- Streak milestones, Keepsakes, side quests and VC time are not seeded: they
-- need the milestone engine / a Discord listener.
-- ---------------------------------------------------------------------------
insert into public.reward_rules
  (event_type, label, xp, deskbits, cap_group, daily_cap_count, is_active)
values
  ('daily_checkin',         'Daily check-in',            10,  5, 'daily_checkin',  1, true),
  ('focus_block_complete',  'Finished a Focus Block',    20, 10, 'focus_block',    4, false),
  ('desk_break',            'Took a Desk Break',          5,  0, 'desk_break',     4, false),
  ('puzzle_finished',       'Finished the daily puzzle', 10,  0, 'puzzle_finished', 1, false),
  ('puzzle_solved',         'Solved the daily puzzle',   10, 10, 'puzzle_solved',  1, false),
  ('puzzle_practice',       'Practice round',             2,  0, 'puzzle_practice', 3, false),
  ('game_session_finished', 'Finished a game',           15,  0, 'game_session',   3, false),
  ('game_win_bonus',        'Won a game',                10, 10, 'game_win',        3, false),
  ('event_checkin',         'Checked in to an event',    25, 15, 'event_checkin',  2, false),
  ('self_log',              'Logged an activity',         8,  3, 'self_log',       3, false),
  ('weekly_win',            'Completed a Weekly Win',    30, 20, null,          null, false);
