-- 0067_buddy_boards_more: real data for the Buddy Boards tabs that already have a data source.
-- Boards added (all read-only, computed live from existing tables, nothing stored, nothing paid):
--   Brain Breaks (today, community day): Five Tiles (fewest tries, then fastest), Minute Quiz (fastest correct),
--     Letter Shuffle, Number Nook, Word Hunt (fastest solve). Only solved / correct attempts are ranked.
--   Focus and habits: Focus days (days with a finished Focus Block, month), Daily streaks (check-in run right now),
--     Quests finished (side quests completed, month).
--   Community: Stickies left (month), Events joined (month), Buddies collected (all time).
-- Not built (no data source yet): Games tab, Games played, Stamps collected, Shared in the feed, Reacts given.
-- Rules, same as the Overall board (0064): members only, hidden members (show_on_boards = false) are left out and
-- everyone below moves up, ties share a place, top ten, only member-visible fields leave the database
-- (a name, an avatar, numbers, a rank, a "you" flag; never a user id).
-- Also: buddy_boards_overview() = "Your places" plus "The month so far" (community totals, no names, no ranks).
-- No placing reward is paid by anything here.

-- Raw values per member for one board. k1/k2 sort ascending = better. v/v2 are what the member sees.
create or replace function public.buddy_board_values(p_board text, p_start date, p_end date)
returns table (user_id uuid, k1 numeric, k2 numeric, v bigint, v2 bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
begin
  if p_board = 'five_tiles' then
    return query select a.user_id, a.guess_count::numeric, extract(epoch from (a.finished_at - a.started_at)) * 1000,
                        a.guess_count::bigint, (extract(epoch from (a.finished_at - a.started_at)) * 1000)::bigint
                   from daily.puzzle_attempts a where a.puzzle_date = v_today and a.status = 'solved';
  elsif p_board = 'minute_quiz' then
    return query select a.user_id, extract(epoch from (a.finished_at - a.started_at)) * 1000, 0::numeric,
                        (extract(epoch from (a.finished_at - a.started_at)) * 1000)::bigint, null::bigint
                   from daily.trivia_attempts a where a.trivia_date = v_today and a.status = 'correct';
  elsif p_board = 'letter_shuffle' then
    return query select a.user_id, a.solve_ms::numeric, 0::numeric, a.solve_ms::bigint, null::bigint
                   from daily.anagram_attempts a where a.anagram_date = v_today and a.status = 'solved';
  elsif p_board = 'number_nook' then
    return query select a.user_id, a.solve_ms::numeric, 0::numeric, a.solve_ms::bigint, null::bigint
                   from daily.sudoku_attempts a where a.sudoku_date = v_today and a.status = 'solved';
  elsif p_board = 'word_hunt' then
    return query select a.user_id, a.solve_ms::numeric, 0::numeric, a.solve_ms::bigint, null::bigint
                   from daily.word_search_attempts a where a.search_date = v_today and a.status = 'solved';
  elsif p_board = 'focus_days' then
    return query select f.user_id, -count(distinct f.community_day)::numeric, 0::numeric, count(distinct f.community_day)::bigint, null::bigint
                   from focus_blocks f
                  where f.status = 'completed' and f.community_day >= p_start and f.community_day < p_end
                  group by f.user_id;
  elsif p_board = 'streaks' then
    return query
      with ck as (select distinct c.user_id as uid, c.checkin_date as d from daily_checkins c),
      runs as (select uid, d, d - (row_number() over (partition by uid order by d))::int as grp from ck),
      r as (select uid, count(*) as c, max(d) as last_d from runs group by uid, grp)
      select r.uid, -r.c::numeric, 0::numeric, r.c::bigint, null::bigint from r where r.last_d >= v_today - 1;
  elsif p_board = 'quests' then
    return query select q.user_id, -count(*)::numeric, 0::numeric, count(*)::bigint, null::bigint
                   from side_quest_done q where q.done_on >= p_start and q.done_on < p_end group by q.user_id;
  elsif p_board = 'stickies_left' then
    return query select s.sender, -count(*)::numeric, 0::numeric, count(*)::bigint, null::bigint
                   from desk_stickies s
                  where public.community_day_of(s.created_at) >= p_start and public.community_day_of(s.created_at) < p_end
                  group by s.sender;
  elsif p_board = 'events_joined' then
    return query select e.user_id, -count(*)::numeric, 0::numeric, count(*)::bigint, null::bigint
                   from event_checkins e
                  where public.community_day_of(e.created_at) >= p_start and public.community_day_of(e.created_at) < p_end
                  group by e.user_id;
  elsif p_board = 'buddies' then
    return query select m.user_id, -count(*)::numeric, 0::numeric, count(*)::bigint, null::bigint
                   from member_items m where m.item_key like 'companion:%' group by m.user_id;
  else
    raise exception 'unknown board';
  end if;
end;
$$;
revoke all on function public.buddy_board_values(text, date, date) from public, anon, authenticated;

-- One board, ranked. p_period: 'this' | 'last' (ignored by daily, right-now and all-time boards).
-- Returns { board, month_start, hidden, rows:[{rank,name,avatar_url,value,value2,is_you}], you:{rank,value,value2}|null,
--           tag } where tag is only set for Number Nook (today's level).
create or replace function public.buddy_board_one(p_user_id uuid, p_board text, p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_this date := date_trunc('month', public.community_today()::timestamp)::date;
  v_start date;
  v_end date;
  v_hidden boolean;
  v_rows jsonb;
  v_you jsonb;
  v_tag text;
begin
  if p_period not in ('this', 'last') then raise exception 'bad period'; end if;
  if p_period = 'this' then v_start := v_this; v_end := (v_this + interval '1 month')::date;
  else v_start := (v_this - interval '1 month')::date; v_end := v_this; end if;

  v_hidden := coalesce((select not s.show_on_boards from member_settings s where s.user_id = p_user_id), false);

  with vals as (
    select b.* from public.buddy_board_values(p_board, v_start, v_end) b
    join profiles p on p.id = b.user_id and p.is_member
    left join member_settings s on s.user_id = b.user_id
    where coalesce(s.show_on_boards, true)
  ),
  ranked as (
    select x.*, rank() over (order by x.k1, x.k2) as rnk from vals x
  ),
  shown as (select r.* from ranked r order by r.rnk, r.user_id limit 10)
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
              'rank', sh.rnk, 'name', p.username, 'avatar_url', p.avatar_url,
              'value', sh.v, 'value2', sh.v2, 'is_you', sh.user_id = p_user_id) order by sh.rnk, sh.user_id), '[]'::jsonb)
       from shown sh join profiles p on p.id = sh.user_id),
    (select jsonb_build_object('rank', r.rnk, 'value', r.v, 'value2', r.v2)
       from ranked r where r.user_id = p_user_id and r.user_id not in (select user_id from shown))
  into v_rows, v_you;

  if p_board = 'number_nook' then
    select initcap(sp.difficulty) into v_tag from daily.sudoku_days d
      join daily.sudoku_puzzles sp on sp.id = d.puzzle_id where d.sudoku_date = public.community_today();
  end if;

  return jsonb_build_object('board', p_board, 'month_start', v_start, 'hidden', v_hidden,
                            'rows', v_rows, 'you', v_you, 'tag', v_tag);
end;
$$;
revoke all on function public.buddy_board_one(uuid, text, text) from public, anon, authenticated;

-- "Your places": the caller's place on every live board except Overall (the page already has that one).
-- Hidden members get none. Plus "The month so far": community totals, no names, no ranks.
create or replace function public.buddy_boards_overview(p_user_id uuid, p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_this date := date_trunc('month', public.community_today()::timestamp)::date;
  v_start date;
  v_end date;
  v_hidden boolean;
  v_places jsonb := '[]'::jsonb;
  v_b text;
  v_rank bigint;
  v_stats jsonb;
begin
  if p_period not in ('this', 'last') then raise exception 'bad period'; end if;
  if p_period = 'this' then v_start := v_this; v_end := (v_this + interval '1 month')::date;
  else v_start := (v_this - interval '1 month')::date; v_end := v_this; end if;

  v_hidden := coalesce((select not s.show_on_boards from member_settings s where s.user_id = p_user_id), false);

  if not v_hidden then
    foreach v_b in array array['five_tiles','minute_quiz','letter_shuffle','number_nook','word_hunt',
                               'focus_days','streaks','quests','stickies_left','events_joined','buddies'] loop
      select r.rnk into v_rank from (
        select b.user_id, rank() over (order by b.k1, b.k2) as rnk
          from public.buddy_board_values(v_b, v_start, v_end) b
          join profiles p on p.id = b.user_id and p.is_member
          left join member_settings s on s.user_id = b.user_id
         where coalesce(s.show_on_boards, true)
      ) r where r.user_id = p_user_id;
      if v_rank is not null then
        v_places := v_places || jsonb_build_array(jsonb_build_object('board', v_b, 'rank', v_rank));
      end if;
    end loop;
  end if;

  v_stats := jsonb_build_object(
    'focus_blocks', (select count(*) from focus_blocks f where f.status = 'completed' and f.community_day >= v_start and f.community_day < v_end),
    'check_ins',    (select count(*) from daily_checkins c where c.checkin_date >= v_start and c.checkin_date < v_end),
    'quests',       (select count(*) from side_quest_done q where q.done_on >= v_start and q.done_on < v_end),
    'stickies',     (select count(*) from desk_stickies s where public.community_day_of(s.created_at) >= v_start and public.community_day_of(s.created_at) < v_end),
    'events',       (select count(*) from event_checkins e where public.community_day_of(e.created_at) >= v_start and public.community_day_of(e.created_at) < v_end)
  );

  return jsonb_build_object('month_start', v_start, 'hidden', v_hidden, 'places', v_places, 'stats', v_stats);
end;
$$;
revoke all on function public.buddy_boards_overview(uuid, text) from public, anon, authenticated;
