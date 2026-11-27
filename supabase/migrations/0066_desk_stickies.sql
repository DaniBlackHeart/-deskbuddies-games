-- 0066_desk_stickies.sql
-- Desk Stickies: short notes a member leaves on another member's pin board.
-- Rules confirmed 24 Nov (claude/Debbie_UI_Decisions_2026-11-24_v1.md, item 9). Numbers are samples.
--   * Any verified member can leave one on another member's desk, if they checked in today
--     (community day, Asia/Manila). No stickies on your own desk.
--   * 150 characters, plain text.
--   * 20 on a desk's board per week. A kept sticky leaves the board (it moves to the Buddybook)
--     and stops counting, so keeping notes never blocks new ones.
--   * The owner can Keep (Buddybook) or Trash. Trash cannot be undone and the sender is NOT told.
--     Trashing clears the text.
--   * allow_stickies = off in the owner's Settings means nobody can leave one.
--   * The board shows only this week's stickies. Ones the owner did not keep drop off the board
--     when the week turns over (the rows stay, hidden).
--   * A report stores a snapshot of the text for the mods. Mod tooling and the Discord ping are
--     NOT in this migration.
--
-- Access: RLS on, no policies, no grants. Only the service role (the desk-stickies Edge
-- Function) touches these tables, so the browser can never read a sticky it should not see.
-- No reward is paid for stickies.

create table public.desk_stickies (
  id          uuid primary key default gen_random_uuid(),
  desk_owner  uuid not null references public.profiles (id) on delete cascade,
  sender      uuid not null references public.profiles (id) on delete cascade,
  body        text not null,
  week_start  date not null,                 -- Monday of the community week it was left
  status      text not null default 'new' check (status in ('new', 'seen', 'kept', 'trashed')),
  created_at  timestamptz not null default now(),
  kept_at     timestamptz,
  check (desk_owner <> sender),
  check ((status = 'trashed' and body = '') or (status <> 'trashed' and char_length(body) between 1 and 150))
);

create index desk_stickies_board_idx on public.desk_stickies (desk_owner, week_start, status);
create index desk_stickies_sender_idx on public.desk_stickies (sender, created_at desc);

create table public.desk_sticky_reports (
  id            uuid primary key default gen_random_uuid(),
  sticky_id     uuid not null references public.desk_stickies (id) on delete cascade,
  reporter      uuid not null references public.profiles (id) on delete cascade,
  sender        uuid not null references public.profiles (id) on delete cascade,
  desk_owner    uuid not null references public.profiles (id) on delete cascade,
  body_snapshot text not null,
  created_at    timestamptz not null default now(),
  unique (sticky_id, reporter)
);

alter table public.desk_stickies        enable row level security;
alter table public.desk_sticky_reports  enable row level security;
revoke all on public.desk_stickies, public.desk_sticky_reports from anon, authenticated;

create function public.sticky_week() returns date
language sql stable set search_path = public as $$
  select date_trunc('week', public.community_today()::timestamp)::date;
$$;

-- Why a sender cannot leave a sticky right now, or 'ok'.
create function public.sticky_can_leave(p_sender uuid, p_owner uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allow boolean;
  v_on_board integer;
begin
  if p_sender = p_owner then return 'self'; end if;
  if not exists (select 1 from public.profiles where id = p_owner and is_member) then return 'missing'; end if;
  if not exists (select 1 from public.profiles where id = p_sender and is_member) then return 'not_member'; end if;

  select allow_stickies into v_allow from public.member_settings where user_id = p_owner;
  if v_allow is false then return 'off'; end if;

  if not exists (select 1 from public.daily_checkins where user_id = p_sender and checkin_date = public.community_today()) then
    return 'not_checked_in';
  end if;

  select count(*) into v_on_board from public.desk_stickies
   where desk_owner = p_owner and week_start = public.sticky_week() and status in ('new', 'seen');
  if v_on_board >= 20 then return 'full'; end if;

  return 'ok';
end;
$$;

-- Leave a sticky. Serialised per desk so the weekly cap holds under parallel requests.
-- Returns the reason from sticky_can_leave, 'bad_body', or 'ok'.
create function public.sticky_leave(p_sender uuid, p_owner uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_reason text;
  v_id uuid;
begin
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 150 then return 'bad_body'; end if;

  perform 1 from public.profiles where id = p_owner for update;
  if not found then return 'missing'; end if;

  v_reason := public.sticky_can_leave(p_sender, p_owner);
  if v_reason <> 'ok' then return v_reason; end if;

  insert into public.desk_stickies (desk_owner, sender, body, week_start)
  values (p_owner, p_sender, v_body, public.sticky_week())
  returning id into v_id;

  -- One bell item per sticky. Fixed wording; the note text never goes into a notification.
  insert into public.notifications (user_id, kind, title, body, href, source_key)
  values (p_owner, 'sticky', 'A new Desk Sticky on your desk', 'Open My Desk to read it.', '/my-desk', 'sticky:' || v_id)
  on conflict (user_id, source_key) do nothing;

  return 'ok';
end;
$$;

-- Owner: keep (moves to the Buddybook) or trash (cannot be undone, text cleared).
-- Only a sticky that is on the owner's board (this week, new/seen) can be acted on.
create function public.sticky_keep(p_owner uuid, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.desk_stickies set status = 'kept', kept_at = now()
   where id = p_id and desk_owner = p_owner and status in ('new', 'seen') and week_start = public.sticky_week();
  get diagnostics n = row_count;
  return case when n = 1 then 'ok' else 'gone' end;
end;
$$;

create function public.sticky_trash(p_owner uuid, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.desk_stickies set status = 'trashed', body = ''
   where id = p_id and desk_owner = p_owner and status in ('new', 'seen') and week_start = public.sticky_week();
  get diagnostics n = row_count;
  return case when n = 1 then 'ok' else 'gone' end;
end;
$$;

-- Report a sticky that is on a board this week. The reporter cannot be its sender.
-- A snapshot of the text is stored because the owner may trash it afterwards.
create function public.sticky_report(p_reporter uuid, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare s public.desk_stickies;
begin
  select * into s from public.desk_stickies
   where id = p_id and status in ('new', 'seen') and week_start = public.sticky_week();
  if not found then return 'gone'; end if;
  if s.sender = p_reporter then return 'own'; end if;
  insert into public.desk_sticky_reports (sticky_id, reporter, sender, desk_owner, body_snapshot)
  values (s.id, p_reporter, s.sender, s.desk_owner, s.body)
  on conflict (sticky_id, reporter) do nothing;
  return 'ok';
end;
$$;

revoke all on function public.sticky_week(), public.sticky_can_leave(uuid, uuid), public.sticky_leave(uuid, uuid, text),
  public.sticky_keep(uuid, uuid), public.sticky_trash(uuid, uuid), public.sticky_report(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.sticky_week(), public.sticky_can_leave(uuid, uuid), public.sticky_leave(uuid, uuid, text),
  public.sticky_keep(uuid, uuid), public.sticky_trash(uuid, uuid), public.sticky_report(uuid, uuid)
  to service_role;
