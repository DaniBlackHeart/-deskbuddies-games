-- 0056_daily_sudoku.sql
-- Daily Sudoku ("Number Nook" on screen): one 9x9 grid a day, the same for every member, one attempt per
-- member per day, up to 5 mistakes, ranked later by fastest solve.
--
-- Decisions (Dani, 27 Nov 2026, plus claude/Debbie_Daily_Games_Names_and_Ranking_2026-11-27.md):
--   * Own "daily" schema, English UI, resets at midnight Asia/Manila, one attempt per day.
--   * Difficulty is EASY for every day for now. It is a single setting (daily.sudoku_settings) so it can
--     be changed for all the daily games later, once every daily game exists.
--   * 5 mistakes allowed; the 5th ends the game as unsolved. A "mistake" is a number placed in a cell that
--     is not the correct one for that cell (the server checks each number against the real solution, so
--     the solution never reaches the browser while the game is running). A wrong number is NOT placed.
--   * A Give up button ends the attempt as unsolved at once.
--   * No time limit apart from midnight; ranked by fastest solve. The clock is the database's: it starts
--     when the member presses Start, and the solve time is measured here, never by the browser. Leaving
--     the page does not pause it; coming back resumes the same board.
--   * An attempt not finished by midnight pays nothing and does not count; moves for a day that has ended
--     are refused ("closed").
--   * Unsolved (5 mistakes or gave up) pays 10% of the deskbits; XP is unchanged.
--
-- Same shape as the other daily games: tables in schema "daily" closed to the browser (RLS on, no policies,
-- no grants); four small SECURITY DEFINER functions in public, service role only, called by the
-- daily-sudoku Edge Function after it has confirmed the caller is a verified member.
--
-- Rewards (rules created here, ACTIVE):  solved = 20 XP and 250 deskbits; unsolved = 10 XP and 25 deskbits.
-- To switch them off:
--   update public.reward_rules set is_active = false
--    where event_type in ('daily_sudoku_finished','daily_sudoku_solved');
--
-- Pencil-mark notes are kept on the member's screen only (not saved), so they are not on another device.

create table daily.sudoku_settings (
  id         boolean primary key default true check (id),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard'))
);
insert into daily.sudoku_settings (id, difficulty) values (true, 'easy');

create table daily.sudoku_puzzles (
  id           bigint generated always as identity primary key,
  difficulty   text not null check (difficulty in ('easy', 'medium', 'hard')),
  puzzle       text not null unique check (puzzle ~ '^[0-9]{81}$'),    -- 0 = empty cell, row by row
  solution     text not null check (solution ~ '^[1-9]{81}$'),
  last_used_on date,
  times_used   integer not null default 0
);

-- One row per community day: the puzzle everyone gets that day.
create table daily.sudoku_days (
  sudoku_date date primary key,
  puzzle_id   bigint not null references daily.sudoku_puzzles (id)
);

create table daily.sudoku_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  sudoku_date date not null,
  status      text not null default 'in_progress' check (status in ('in_progress', 'solved', 'unsolved')),
  end_reason  text check (end_reason in ('mistakes', 'gave_up')),
  board       text not null check (board ~ '^[0-9]{81}$'),            -- givens plus the member's correct numbers
  mistakes    smallint not null default 0 check (mistakes between 0 and 5),
  started_at  timestamptz not null default now(),                     -- when Start was pressed: the clock begins here
  finished_at timestamptz,
  solve_ms    integer check (solve_ms is null or solve_ms >= 0),      -- server-measured; solved attempts only
  unique (user_id, sudoku_date),
  check ((status = 'in_progress') = (finished_at is null)),
  check ((status = 'solved') = (solve_ms is not null)),
  check ((status = 'unsolved') = (end_reason is not null))
);

alter table daily.sudoku_settings enable row level security;
alter table daily.sudoku_puzzles  enable row level security;
alter table daily.sudoku_days     enable row level security;
alter table daily.sudoku_attempts enable row level security;
revoke all on all tables in schema daily from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The puzzle for a day: picked once, the same for everyone -------------------------------
-- From today's difficulty setting; never-used first (random), then the longest-ago used.
-- ---------------------------------------------------------------------------
create function daily.ensure_sudoku(p_date date) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_difficulty text;
begin
  if exists (select 1 from daily.sudoku_days where sudoku_date = p_date) then return true; end if;

  perform pg_advisory_xact_lock(hashtext('daily_sudoku_pick')::bigint);

  if exists (select 1 from daily.sudoku_days where sudoku_date = p_date) then return true; end if;

  select difficulty into v_difficulty from daily.sudoku_settings where id;
  select id into v_id from daily.sudoku_puzzles
   where difficulty = v_difficulty
   order by (last_used_on is not null), last_used_on, random()
   limit 1;
  if v_id is null then return false; end if;

  insert into daily.sudoku_days (sudoku_date, puzzle_id) values (p_date, v_id);
  update daily.sudoku_puzzles set last_used_on = p_date, times_used = times_used + 1 where id = v_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- State ------------------------------------------------------------------------------------
-- The grid is released only after Start. The solution only once the attempt is over.
-- ---------------------------------------------------------------------------
create function public.daily_sudoku_state(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
  v_p     daily.sudoku_puzzles;
  v_att   daily.sudoku_attempts;
begin
  if not daily.ensure_sudoku(v_today) then
    return jsonb_build_object('sudoku_date', v_today, 'status', 'no_puzzle', 'max_mistakes', 5);
  end if;
  select p.* into v_p from daily.sudoku_puzzles p
    join daily.sudoku_days d on d.puzzle_id = p.id where d.sudoku_date = v_today;

  select * into v_att from daily.sudoku_attempts where user_id = p_user_id and sudoku_date = v_today;
  if not found then
    return jsonb_build_object('sudoku_date', v_today, 'status', 'not_started', 'max_mistakes', 5,
                              'difficulty', v_p.difficulty);
  end if;

  if v_att.status = 'in_progress' then
    return jsonb_build_object('sudoku_date', v_today, 'status', 'in_progress', 'max_mistakes', 5,
      'difficulty', v_p.difficulty, 'puzzle', v_p.puzzle, 'board', v_att.board, 'mistakes', v_att.mistakes,
      'elapsed_ms', floor(extract(epoch from (now() - v_att.started_at)) * 1000)::bigint);
  end if;

  return jsonb_build_object('sudoku_date', v_today, 'status', v_att.status, 'end_reason', v_att.end_reason,
    'max_mistakes', 5, 'difficulty', v_p.difficulty, 'puzzle', v_p.puzzle, 'board', v_att.board,
    'solution', v_p.solution, 'mistakes', v_att.mistakes, 'solve_ms', v_att.solve_ms);
end;
$$;

-- ---------------------------------------------------------------------------
-- Start: the clock begins ---------------------------------------------------------------------
-- Pressing Start twice (two tabs) leaves the first start time in place.
-- ---------------------------------------------------------------------------
create function public.daily_sudoku_start(p_user_id uuid, p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
  v_puz   text;
begin
  if p_date is distinct from v_today then
    return jsonb_build_object('result', 'closed');
  end if;
  if not daily.ensure_sudoku(v_today) then
    return jsonb_build_object('result', 'no_puzzle');
  end if;
  select p.puzzle into v_puz from daily.sudoku_puzzles p
    join daily.sudoku_days d on d.puzzle_id = p.id where d.sudoku_date = v_today;

  insert into daily.sudoku_attempts (user_id, sudoku_date, board)
  values (p_user_id, v_today, v_puz)
  on conflict (user_id, sudoku_date) do nothing;

  return jsonb_build_object('result', 'ok') || public.daily_sudoku_state(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Place a number --------------------------------------------------------------------------------
-- p_cell is 0..80 (row by row), p_digit 1..9. The attempt row is locked while it is checked, so two
-- moves sent at once are handled one after the other. Results:
--   closed | not_started | finished | invalid | given (a starting number) | filled (already has a number)
--   | ok (correct; the state says if that finished the grid) | wrong (a mistake; the number is NOT placed;
--   the 5th mistake ends the game as unsolved and the state is included)
-- ---------------------------------------------------------------------------
create function public.daily_sudoku_place(p_user_id uuid, p_date date, p_cell integer, p_digit integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att daily.sudoku_attempts;
  v_p   daily.sudoku_puzzles;
  v_new text;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;
  if p_cell is null or p_cell < 0 or p_cell > 80 or p_digit is null or p_digit < 1 or p_digit > 9 then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into v_att from daily.sudoku_attempts
   where user_id = p_user_id and sudoku_date = p_date for update;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' then return jsonb_build_object('result', 'finished'); end if;

  select p.* into v_p from daily.sudoku_puzzles p
    join daily.sudoku_days d on d.puzzle_id = p.id where d.sudoku_date = p_date;

  if substr(v_p.puzzle, p_cell + 1, 1) <> '0' then return jsonb_build_object('result', 'given'); end if;
  if substr(v_att.board, p_cell + 1, 1) <> '0' then return jsonb_build_object('result', 'filled'); end if;

  if substr(v_p.solution, p_cell + 1, 1) = p_digit::text then
    v_new := overlay(v_att.board placing p_digit::text from p_cell + 1 for 1);
    if v_new = v_p.solution then
      update daily.sudoku_attempts
         set board = v_new, status = 'solved', finished_at = now(),
             solve_ms = floor(extract(epoch from (now() - started_at)) * 1000)::integer
       where id = v_att.id;
    else
      update daily.sudoku_attempts set board = v_new where id = v_att.id;
    end if;
    return jsonb_build_object('result', 'ok') || public.daily_sudoku_state(p_user_id);
  end if;

  -- a mistake
  if v_att.mistakes + 1 >= 5 then
    update daily.sudoku_attempts
       set mistakes = 5, status = 'unsolved', end_reason = 'mistakes', finished_at = now()
     where id = v_att.id;
    return jsonb_build_object('result', 'wrong') || public.daily_sudoku_state(p_user_id);
  end if;
  update daily.sudoku_attempts set mistakes = mistakes + 1 where id = v_att.id;
  return jsonb_build_object('result', 'wrong', 'mistakes', v_att.mistakes + 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Give up ---------------------------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
create function public.daily_sudoku_give_up(p_user_id uuid, p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att daily.sudoku_attempts;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;
  select * into v_att from daily.sudoku_attempts
   where user_id = p_user_id and sudoku_date = p_date for update;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' then return jsonb_build_object('result', 'finished'); end if;

  update daily.sudoku_attempts
     set status = 'unsolved', end_reason = 'gave_up', finished_at = now()
   where id = v_att.id;
  return jsonb_build_object('result', 'ok') || public.daily_sudoku_state(p_user_id);
end;
$$;

revoke all on function public.daily_sudoku_state(uuid) from public, anon, authenticated;
revoke all on function public.daily_sudoku_start(uuid, date) from public, anon, authenticated;
revoke all on function public.daily_sudoku_place(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.daily_sudoku_give_up(uuid, date) from public, anon, authenticated;
grant execute on function public.daily_sudoku_state(uuid) to service_role;
grant execute on function public.daily_sudoku_start(uuid, date) to service_role;
grant execute on function public.daily_sudoku_place(uuid, date, integer, integer) to service_role;
grant execute on function public.daily_sudoku_give_up(uuid, date) to service_role;
revoke all on function daily.ensure_sudoku(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rewards -----------------------------------------------------------------------------------------------
-- Finishing pays 10 XP and 25 deskbits; solving pays the rest (+10 XP, +225 deskbits), so
-- solved = 20 XP / 250 deskbits and unsolved = 10 XP / 25 deskbits. Absolute values.
-- ---------------------------------------------------------------------------
insert into public.reward_rules (event_type, label, xp, deskbits, cap_group, daily_cap_count, is_active) values
  ('daily_sudoku_finished', 'Finished the daily sudoku', 10,  25, 'daily_sudoku_finished', 1, true),
  ('daily_sudoku_solved',   'Solved the daily sudoku',   10, 225, 'daily_sudoku_solved',   1, true)
on conflict (event_type) do update
  set xp = excluded.xp, deskbits = excluded.deskbits, is_active = true;
