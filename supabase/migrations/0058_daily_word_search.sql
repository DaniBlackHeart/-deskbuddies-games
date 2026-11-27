-- 0058_daily_word_search.sql
-- Daily Word Search ("Word Hunt" on screen): one 10x10 grid a day, the same for every member, 8 hidden words
-- (4 to 8 letters) running right, down or diagonally down-right, five minutes from Start, one attempt per
-- member per day, ranked later by fastest solve.
--
-- Decisions (Dani, 27 Nov 2026, plus claude/Debbie_Daily_Games_Names_and_Ranking_2026-11-27.md):
--   * Own "daily" schema, English UI, resets at midnight Asia/Manila, one attempt per day.
--   * The clock starts when the member presses Start and is the database's, never the browser's.
--     Leaving the page does not pause it. A 2-second grace covers network delay.
--   * The grid and the word list are sent after Start. WHERE each word is stays on the server until the
--     attempt is over: every found word is checked here (the member picks the first and last letter).
--   * Wrong picks cost nothing (no penalty, no limit). Finding all 8 = solved; solve_ms is server-measured.
--   * Time up with words missing = unsolved (end_reason 'time'); a Give up button ends it as unsolved at once
--     (end_reason 'gave_up'). Partial finds earn nothing extra: unsolved pays the 10% reward, not ranked.
--   * An attempt not finished by midnight pays nothing and does not count; moves for a day that has ended
--     are refused ("closed").
--
-- Same shape as the other daily games: tables in schema "daily" closed to the browser (RLS on, no policies,
-- no grants); small SECURITY DEFINER functions in public, service role only, called by the
-- daily-word-search Edge Function after it has confirmed the caller is a verified member.
--
-- Rewards (rules created here, ACTIVE):  solved = 20 XP and 250 deskbits; unsolved = 10 XP and 25 deskbits.
-- To switch them off:
--   update public.reward_rules set is_active = false
--    where event_type in ('daily_word_search_finished','daily_word_search_solved');

create table daily.word_search_puzzles (
  id           bigint generated always as identity primary key,
  grid         text not null unique check (grid ~ '^[A-Z]{100}$'),     -- row by row, 10 x 10
  words        text[] not null check (cardinality(words) = 8),
  starts       smallint[] not null check (cardinality(starts) = 8),    -- cell (0-99) of each word's first letter
  ends         smallint[] not null check (cardinality(ends) = 8),      -- cell of each word's last letter
  last_used_on date,
  times_used   integer not null default 0
);

create table daily.word_search_days (
  search_date date primary key,
  puzzle_id   bigint not null references daily.word_search_puzzles (id)
);

create table daily.word_search_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  search_date date not null,
  status      text not null default 'in_progress' check (status in ('in_progress', 'solved', 'unsolved')),
  end_reason  text check (end_reason in ('time', 'gave_up')),
  words_found smallint[] not null default '{}',                        -- word numbers 1..8 found so far
  started_at  timestamptz not null default now(),                      -- when Start was pressed
  finished_at timestamptz,
  solve_ms    integer check (solve_ms is null or solve_ms >= 0),       -- server-measured; solved attempts only
  unique (user_id, search_date),
  check ((status = 'in_progress') = (finished_at is null)),
  check ((status = 'solved') = (solve_ms is not null)),
  check ((status = 'unsolved') = (end_reason is not null))
);

alter table daily.word_search_puzzles enable row level security;
alter table daily.word_search_days    enable row level security;
alter table daily.word_search_attempts enable row level security;
revoke all on all tables in schema daily from public, anon, authenticated;

-- Five minutes, plus 2 seconds of network grace. ---------------------------------------------------------
create function daily.word_search_limit() returns interval language sql immutable as $$ select interval '302 seconds' $$;

-- The puzzle for a day: picked once, the same for everyone (never-used first, then longest ago). -----------
create function daily.ensure_word_search(p_date date) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
begin
  if exists (select 1 from daily.word_search_days where search_date = p_date) then return true; end if;

  perform pg_advisory_xact_lock(hashtext('daily_word_search_pick')::bigint);

  if exists (select 1 from daily.word_search_days where search_date = p_date) then return true; end if;

  select id into v_id from daily.word_search_puzzles
   order by (last_used_on is not null), last_used_on, random()
   limit 1;
  if v_id is null then return false; end if;

  insert into daily.word_search_days (search_date, puzzle_id) values (p_date, v_id);
  update daily.word_search_puzzles set last_used_on = p_date, times_used = times_used + 1 where id = v_id;
  return true;
end;
$$;

-- State -----------------------------------------------------------------------------------------------------
-- Not started: nothing but the status. In progress: the grid, the words and the ones found so far (with
-- where they are), and the seconds left. Finished: also where EVERY word was.
-- Time up is settled here: the first look after the time (plus grace) ends the attempt as unsolved.
create function public.daily_word_search_state(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
  v_p     daily.word_search_puzzles;
  v_att   daily.word_search_attempts;
  v_found jsonb;
  v_left  integer;
begin
  if not daily.ensure_word_search(v_today) then
    return jsonb_build_object('search_date', v_today, 'status', 'no_puzzle', 'time_limit_seconds', 300);
  end if;
  select p.* into v_p from daily.word_search_puzzles p
    join daily.word_search_days d on d.puzzle_id = p.id where d.search_date = v_today;

  select * into v_att from daily.word_search_attempts
   where user_id = p_user_id and search_date = v_today for update;
  if not found then
    return jsonb_build_object('search_date', v_today, 'status', 'not_started', 'time_limit_seconds', 300,
                              'word_count', 8);
  end if;

  if v_att.status = 'in_progress' and now() > v_att.started_at + daily.word_search_limit() then
    update daily.word_search_attempts
       set status = 'unsolved', end_reason = 'time', finished_at = v_att.started_at + interval '300 seconds'
     where id = v_att.id
    returning * into v_att;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('i', i, 'start', v_p.starts[i], 'end', v_p.ends[i]) order by i), '[]'::jsonb)
    into v_found from unnest(v_att.words_found) as i;

  if v_att.status = 'in_progress' then
    v_left := greatest(0, ceil(extract(epoch from (v_att.started_at + interval '300 seconds' - now())))::integer);
    return jsonb_build_object('search_date', v_today, 'status', 'in_progress', 'time_limit_seconds', 300,
      'grid', v_p.grid, 'words', to_jsonb(v_p.words), 'found', v_found, 'seconds_left', v_left);
  end if;

  return jsonb_build_object('search_date', v_today, 'status', v_att.status, 'end_reason', v_att.end_reason,
    'time_limit_seconds', 300, 'grid', v_p.grid, 'found_count', coalesce(cardinality(v_att.words_found), 0),
    'solve_ms', v_att.solve_ms,
    'placements', (select jsonb_agg(jsonb_build_object('i', g, 'word', v_p.words[g], 'start', v_p.starts[g],
                      'end', v_p.ends[g], 'found', g = any (v_att.words_found)) order by g) from generate_series(1, 8) g));
end;
$$;

-- Start: the clock begins (a second press, e.g. from another tab, keeps the first start time). -------------
create function public.daily_word_search_start(p_user_id uuid, p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
begin
  if p_date is distinct from v_today then
    return jsonb_build_object('result', 'closed');
  end if;
  if not daily.ensure_word_search(v_today) then
    return jsonb_build_object('result', 'no_puzzle');
  end if;
  insert into daily.word_search_attempts (user_id, search_date) values (p_user_id, v_today)
  on conflict (user_id, search_date) do nothing;
  return jsonb_build_object('result', 'ok') || public.daily_word_search_state(p_user_id);
end;
$$;

-- Find a word ------------------------------------------------------------------------------------------------
-- p_start and p_end are the first and last cell (0-99) the member picked, in either order. The attempt row is
-- locked while it is checked, so two picks sent at once are handled one after the other. Results:
--   closed | not_started | finished | invalid | time_up (state included) | miss (not a hidden word; free)
--   | already (that word was found) | found (state included; the 8th word finishes the game as solved)
create function public.daily_word_search_find(p_user_id uuid, p_date date, p_start integer, p_end integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att daily.word_search_attempts;
  v_p   daily.word_search_puzzles;
  v_i   integer := null;
  g     integer;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;
  if p_start is null or p_end is null or p_start < 0 or p_start > 99 or p_end < 0 or p_end > 99 then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into v_att from daily.word_search_attempts
   where user_id = p_user_id and search_date = p_date for update;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' then return jsonb_build_object('result', 'finished'); end if;

  if now() > v_att.started_at + daily.word_search_limit() then
    update daily.word_search_attempts
       set status = 'unsolved', end_reason = 'time', finished_at = v_att.started_at + interval '300 seconds'
     where id = v_att.id;
    return jsonb_build_object('result', 'time_up') || public.daily_word_search_state(p_user_id);
  end if;

  select p.* into v_p from daily.word_search_puzzles p
    join daily.word_search_days d on d.puzzle_id = p.id where d.search_date = p_date;

  for g in 1..8 loop
    if (v_p.starts[g] = p_start and v_p.ends[g] = p_end) or (v_p.starts[g] = p_end and v_p.ends[g] = p_start) then
      v_i := g;
      exit;
    end if;
  end loop;

  if v_i is null then return jsonb_build_object('result', 'miss'); end if;
  if v_i = any (v_att.words_found) then return jsonb_build_object('result', 'already'); end if;

  if cardinality(v_att.words_found) + 1 = 8 then
    update daily.word_search_attempts
       set words_found = array_append(words_found, v_i::smallint), status = 'solved', finished_at = now(),
           solve_ms = least(300000, floor(extract(epoch from (now() - started_at)) * 1000)::integer)
     where id = v_att.id;
  else
    update daily.word_search_attempts set words_found = array_append(words_found, v_i::smallint) where id = v_att.id;
  end if;
  return jsonb_build_object('result', 'found', 'word_index', v_i) || public.daily_word_search_state(p_user_id);
end;
$$;

-- Give up ----------------------------------------------------------------------------------------------------
create function public.daily_word_search_give_up(p_user_id uuid, p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att daily.word_search_attempts;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;
  select * into v_att from daily.word_search_attempts
   where user_id = p_user_id and search_date = p_date for update;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' then return jsonb_build_object('result', 'finished'); end if;

  update daily.word_search_attempts
     set status = 'unsolved', end_reason = 'gave_up', finished_at = now()
   where id = v_att.id;
  return jsonb_build_object('result', 'ok') || public.daily_word_search_state(p_user_id);
end;
$$;

revoke all on function public.daily_word_search_state(uuid) from public, anon, authenticated;
revoke all on function public.daily_word_search_start(uuid, date) from public, anon, authenticated;
revoke all on function public.daily_word_search_find(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.daily_word_search_give_up(uuid, date) from public, anon, authenticated;
grant execute on function public.daily_word_search_state(uuid) to service_role;
grant execute on function public.daily_word_search_start(uuid, date) to service_role;
grant execute on function public.daily_word_search_find(uuid, date, integer, integer) to service_role;
grant execute on function public.daily_word_search_give_up(uuid, date) to service_role;
revoke all on function daily.ensure_word_search(date) from public, anon, authenticated;
revoke all on function daily.word_search_limit() from public, anon, authenticated;

-- Rewards: finishing pays 10 XP / 25 deskbits; solving adds +10 XP / +225 deskbits (absolute values). -----
insert into public.reward_rules (event_type, label, xp, deskbits, cap_group, daily_cap_count, is_active) values
  ('daily_word_search_finished', 'Finished the daily word search', 10,  25, 'daily_word_search_finished', 1, true),
  ('daily_word_search_solved',   'Solved the daily word search',   10, 225, 'daily_word_search_solved',   1, true)
on conflict (event_type) do update
  set xp = excluded.xp, deskbits = excluded.deskbits, is_active = true;
