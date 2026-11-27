-- 0064_buddy_boards_overall: Buddy Boards v1, the Overall board only.
-- Design: claude/Debbie_Buddy_Boards_Decisions_2026-11-26.md (Overall = Buddy XP earned this month).
--
-- What this adds:
--  * member_settings.show_on_boards (default true): "Show me on Buddy Boards". Hidden members are left
--    out of every board and everyone below them moves up. Hiding never pauses earning.
--  * buddy_board_overall(): one read-only function, service role only. It ranks Buddy XP earned in a
--    calendar month, Philippine time, straight from reward_ledger (community_day is already Manila).
--    It returns only member-visible fields: a name, a Discord avatar, a total, a rank, and a "you" flag.
--    Never a user id, a balance, a source key or any history.
--
-- Not in this migration on purpose (waiting on Rika / not built): placing rewards (deskbits, Podium and
-- Monthly Champ buddies, trophies), stored podiums, minimum-participant rules, the other boards.
-- Provisional rules used here (from the decisions doc, "Proposed for Rika"): ties share a place and
-- seasons turn over on the 1st at 12:00 am Philippine time.

alter table public.member_settings
  add column if not exists show_on_boards boolean not null default true;

-- Same fixed list as before, plus the new switch. The column is still chosen from a list, never from raw input.
create or replace function public.member_setting_set(p_user_id uuid, p_key text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in ('notify_stickies','notify_news','allow_stickies','show_in_around','show_on_boards') then
    raise exception 'unknown setting';
  end if;
  insert into member_settings (user_id) values (p_user_id) on conflict (user_id) do nothing;
  execute format('update member_settings set %I = $1, updated_at = now() where user_id = $2', p_key)
    using p_value, p_user_id;
end;
$$;

revoke all on function public.member_setting_set(uuid, text, boolean) from public, anon, authenticated;

-- Overall board for one month. p_period: 'this' or 'last'.
-- Returns { period, month_start, hidden, rows:[{rank,name,avatar_url,value,is_you}], you:{rank,value}|null }.
-- "you" is filled only when the caller is ranked but not already in the ten rows shown.
create or replace function public.buddy_board_overall(p_user_id uuid, p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_this_start date := date_trunc('month', (now() at time zone 'Asia/Manila'))::date;
  v_start date;
  v_end date;
  v_hidden boolean;
  v_rows jsonb;
  v_you jsonb;
begin
  if p_period not in ('this', 'last') then
    raise exception 'bad period';
  end if;
  if p_period = 'this' then
    v_start := v_this_start;
    v_end := (v_this_start + interval '1 month')::date;
  else
    v_start := (v_this_start - interval '1 month')::date;
    v_end := v_this_start;
  end if;

  v_hidden := coalesce((select not s.show_on_boards from member_settings s where s.user_id = p_user_id), false);

  with totals as (
    select l.user_id, sum(l.xp_delta)::bigint as v
    from reward_ledger l
    join profiles p on p.id = l.user_id and p.is_member
    left join member_settings s on s.user_id = l.user_id
    where l.community_day >= v_start and l.community_day < v_end
      and coalesce(s.show_on_boards, true)
    group by l.user_id
    having sum(l.xp_delta) > 0
  ),
  ranked as (
    select t.user_id, t.v, rank() over (order by t.v desc) as rnk from totals t
  ),
  shown as (
    select r.user_id, r.v, r.rnk from ranked r order by r.rnk, r.user_id limit 10
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
              'rank', sh.rnk, 'name', p.username, 'avatar_url', p.avatar_url,
              'value', sh.v, 'is_you', sh.user_id = p_user_id) order by sh.rnk, sh.user_id), '[]'::jsonb)
       from shown sh join profiles p on p.id = sh.user_id),
    (select jsonb_build_object('rank', r.rnk, 'value', r.v)
       from ranked r
       where r.user_id = p_user_id and r.user_id not in (select user_id from shown))
  into v_rows, v_you;

  return jsonb_build_object(
    'period', p_period,
    'month_start', v_start,
    'hidden', v_hidden,
    'rows', v_rows,
    'you', v_you
  );
end;
$$;

revoke all on function public.buddy_board_overall(uuid, text) from public, anon, authenticated;
