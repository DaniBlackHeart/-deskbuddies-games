-- 0035: Buddy Calendar.
-- See claude/Debbie_Buddy_Calendar_System_Decisions_v1.md. Discord scheduled events are the
-- source of title, time, place and status; Debbie keeps one row per event series (category,
-- host code, kind, whether it is shown) and one row per occurrence (so a repeating event has a
-- record for each date). Nothing here is sample data: the tables start empty and the Edge
-- Function fills them from Discord.
--
-- Config that starts empty and must be set by a Mod/admin (plain SQL, see the delivery notes):
--   calendar_settings.team_role_ids   Discord role IDs whose events appear automatically
--   birthday_month_roles.role_id      the Discord role for each birth month
-- Reward values for "checked in to an official event" are provisional and the rule is inactive.

create table public.calendar_settings (
  id                    boolean primary key default true check (id),
  team_role_ids         text[] not null default '{}',
  sync_minutes          integer not null default 15 check (sync_minutes >= 5),
  history_months        integer not null default 5 check (history_months between 1 and 24),
  last_attempt_at       timestamptz,
  last_synced_at        timestamptz,          -- last SUCCESSFUL fetch
  last_attempt_failed   boolean not null default false,
  sync_started_at       timestamptz,          -- shared lock so visitors never each fetch
  birthdays_synced_at   timestamptz
);
insert into public.calendar_settings (id) values (true);

create table public.event_series (
  id                  uuid primary key default gen_random_uuid(),
  discord_event_id    text not null unique,
  creator_discord_id  text,
  host_name           text,
  recurring           boolean not null default false,
  state               text not null default 'pending' check (state in ('pending', 'shown', 'hidden')),
  kind                text not null default 'member' check (kind in ('official', 'member')),
  category            text check (category in ('coworking', 'reading', 'games', 'career')),
  host_code           text check (host_code is null or char_length(host_code) between 3 and 40),
  created_at          timestamptz not null default now()
);

create table public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  series_id     uuid not null references public.event_series (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  title         text not null,
  description   text,
  location      text,
  status        text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  last_seen_at  timestamptz not null default now(),
  unique (series_id, starts_at)
);
create index calendar_events_starts_idx on public.calendar_events (starts_at);

create table public.event_checkins (
  event_id    uuid not null references public.calendar_events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Wrong tries, for Mods only (never member-visible).
create table public.event_checkin_attempts (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references public.calendar_events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index event_checkin_attempts_idx on public.event_checkin_attempts (event_id, user_id, created_at);

create table public.birthday_month_roles (
  month    integer primary key check (month between 1 and 12),
  role_id  text
);
insert into public.birthday_month_roles (month) select g from generate_series(1, 12) g;

create table public.birthday_names (
  month       integer primary key check (month between 1 and 12),
  names       text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

-- RLS: Edge Functions (service role) do all reading and writing. A member may read
-- only their own check-ins; everything else has no member-facing policy at all.
alter table public.calendar_settings        enable row level security;
alter table public.event_series             enable row level security;
alter table public.calendar_events          enable row level security;
alter table public.event_checkins           enable row level security;
alter table public.event_checkin_attempts   enable row level security;
alter table public.birthday_month_roles     enable row level security;
alter table public.birthday_names           enable row level security;
revoke all on public.calendar_settings, public.event_series, public.calendar_events,
  public.event_checkins, public.event_checkin_attempts, public.birthday_month_roles,
  public.birthday_names from anon, authenticated;
grant select on public.event_checkins to authenticated;
create policy "event_checkins: read own rows" on public.event_checkins for select
  using (auth.uid() = user_id);

-- Reward: the 'event_checkin' rule already exists (0028, provisional values, inactive).
-- Source key per occurrence: event:<calendar_events.id>.

-- One visitor at a time may run the shared sync.
create function public.calendar_try_lock(p_force boolean) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare got boolean := false;
begin
  update public.calendar_settings s
     set sync_started_at = now(), last_attempt_at = now()
   where s.id
     and (s.sync_started_at is null or s.sync_started_at < now() - interval '2 minutes')
     and (p_force or s.last_attempt_at is null
          or s.last_attempt_at < now() - make_interval(mins => s.sync_minutes))
  returning true into got;
  return coalesce(got, false);
end;
$$;

-- One check-in attempt, decided entirely here so the checks and the write cannot race.
-- Returns one of: not_found, not_available, not_set, closed, locked, wrong, ok, already.
-- "closed" is answered before the code is looked at, so it never reveals whether a code was right.
create function public.calendar_checkin(p_user uuid, p_event uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  tz text;
  win_end timestamptz;
  stored text;
  tries integer;
begin
  select e.id, e.starts_at, e.ends_at, e.status, s.host_code, s.state, s.kind
    into ev
    from public.calendar_events e join public.event_series s on s.id = e.series_id
   where e.id = p_event;
  if not found or ev.state <> 'shown' then return 'not_found'; end if;
  if ev.status = 'cancelled' then return 'not_available'; end if;

  select community_timezone into tz from public.earning_settings where id;
  win_end := (((coalesce(ev.ends_at, ev.starts_at) at time zone tz)::date + 1)::timestamp) at time zone tz;
  if now() < ev.starts_at or now() >= win_end then return 'closed'; end if;
  if ev.host_code is null then return 'not_set'; end if;

  if exists (select 1 from public.event_checkins where event_id = p_event and user_id = p_user) then
    return 'already';
  end if;

  select count(*) into tries from public.event_checkin_attempts
   where event_id = p_event and user_id = p_user and created_at > now() - interval '15 minutes';
  if tries >= 5 then return 'locked'; end if;

  stored := upper(btrim(ev.host_code));
  if upper(btrim(coalesce(p_code, ''))) <> stored then
    insert into public.event_checkin_attempts (event_id, user_id) values (p_event, p_user);
    return 'wrong';
  end if;

  insert into public.event_checkins (event_id, user_id) values (p_event, p_user)
  on conflict do nothing;
  return 'ok';
end;
$$;

revoke all on function public.calendar_try_lock(boolean), public.calendar_checkin(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.calendar_try_lock(boolean), public.calendar_checkin(uuid, uuid, text)
  to service_role;
