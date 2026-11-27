-- 0054_daily_anagram.sql
-- Daily Anagram ("Letter Shuffle" on screen): one long scrambled word a day (7 to 9 letters),
-- the same scramble for every member, four minutes to unscramble it, one attempt per member
-- per day.
--
-- Decisions (Dani, 27 Nov 2026): own "daily" schema, English, one attempt, resets at midnight
-- Asia/Manila, one long scrambled word, ONLY the intended answer counts (the answer list is built
-- so each word has no other anagram in a big dictionary, so this is fair), unlimited guesses,
-- no skips, no hints, four minutes on a SERVER clock from Start, unsolved/timed out pays 10% of
-- the deskbits, ranked later by fastest solve (the time is recorded here; no board yet).
--
-- Same shape as Daily Puzzle (0049) and Daily Trivia (0052):
--   * Tables in schema "daily", closed to the browser (RLS on, no policies, no grants).
--   * Three small SECURITY DEFINER functions in public, service role only; the daily-anagram Edge
--     Function calls them after confirming the caller is a verified member.
--   * The scramble is not sent until the member presses Start; the answer is never sent until the
--     attempt is over.
--   * The clock is the database's: an answer arriving more than 4 minutes + 2 seconds (network
--     allowance) after Start is a timed-out attempt, whatever the browser says. Closing the page
--     does not pause the clock.
--   * An attempt not finished by midnight pays nothing and does not count; answers for a day that
--     has ended are refused ("closed").
--
-- Rewards (rules created here, ACTIVE, same split as the other daily games):
--     solved   = 20 XP and 250 deskbits
--     unsolved = 10 XP and  25 deskbits
-- To switch them off:
--   update public.reward_rules set is_active = false
--    where event_type in ('daily_anagram_finished','daily_anagram_solved');

create table daily.anagram_answers (
  word         text primary key check (word ~ '^[a-z]{7,9}$'),
  last_used_on date,
  times_used   integer not null default 0
);

-- One row per community day: the word and the one scramble everybody sees.
create table daily.anagram_days (
  anagram_date date primary key,
  word         text not null references daily.anagram_answers (word),
  scrambled    text not null check (scrambled ~ '^[a-z]{7,9}$' and scrambled <> word)
);

create table daily.anagram_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  anagram_date date not null,
  status       text not null default 'in_progress' check (status in ('in_progress', 'solved', 'unsolved')),
  started_at   timestamptz not null default now(),   -- when Start was pressed: the clock begins here
  finished_at  timestamptz,
  solve_ms     integer check (solve_ms is null or (solve_ms >= 0 and solve_ms <= 242000)),  -- server-measured; solved attempts only
  guess_count  integer not null default 0,
  unique (user_id, anagram_date),
  check ((status = 'in_progress') = (finished_at is null)),
  check ((status = 'solved') = (solve_ms is not null))
);

alter table daily.anagram_answers  enable row level security;
alter table daily.anagram_days     enable row level security;
alter table daily.anagram_attempts enable row level security;
revoke all on all tables in schema daily from public, anon, authenticated;

-- Four minutes, plus 2 seconds for the network. Kept in one place.
create function daily.anagram_limit() returns interval language sql immutable as $$ select interval '242 seconds' $$;

-- ---------------------------------------------------------------------------
-- The word and scramble for a day: picked once, the same for everyone -----------------
-- Never-used words first (random); when all are used, the one used longest ago. The scramble is
-- a random shuffle that is never the word itself. Null when no answers are loaded.
-- ---------------------------------------------------------------------------
create function daily.ensure_anagram(p_date date) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_word text;
  v_scr  text;
  i      integer := 0;
begin
  if exists (select 1 from daily.anagram_days where anagram_date = p_date) then return true; end if;

  perform pg_advisory_xact_lock(hashtext('daily_anagram_pick')::bigint);

  if exists (select 1 from daily.anagram_days where anagram_date = p_date) then return true; end if;

  select word into v_word from daily.anagram_answers
   order by (last_used_on is not null), last_used_on, random()
   limit 1;
  if v_word is null then return false; end if;

  loop
    select string_agg(c, '' order by random()) into v_scr from unnest(string_to_array(v_word, null)) as c;
    exit when v_scr <> v_word;
    i := i + 1;
    if i > 50 then raise exception 'daily anagram: could not scramble %', v_word; end if;
  end loop;

  insert into daily.anagram_days (anagram_date, word, scrambled) values (p_date, v_word, v_scr);
  update daily.anagram_answers set last_used_on = p_date, times_used = times_used + 1 where word = v_word;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- State -------------------------------------------------------------------------------
-- Also finishes an attempt whose four minutes ran out. The scramble is included only while the
-- attempt is running (and after it ends, with the answer).
-- ---------------------------------------------------------------------------
create function public.daily_anagram_state(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
  v_day   daily.anagram_days;
  v_att   daily.anagram_attempts;
  v_left  integer;
begin
  if not daily.ensure_anagram(v_today) then
    return jsonb_build_object('anagram_date', v_today, 'status', 'no_word', 'time_limit_seconds', 240);
  end if;
  select * into v_day from daily.anagram_days where anagram_date = v_today;

  select * into v_att from daily.anagram_attempts
   where user_id = p_user_id and anagram_date = v_today
   for update;

  if not found then
    return jsonb_build_object('anagram_date', v_today, 'status', 'not_started',
                              'time_limit_seconds', 240, 'letter_count', length(v_day.word));
  end if;

  if v_att.status = 'in_progress' and now() > v_att.started_at + daily.anagram_limit() then
    update daily.anagram_attempts
       set status = 'unsolved', finished_at = v_att.started_at + interval '240 seconds'
     where id = v_att.id
     returning * into v_att;
  end if;

  if v_att.status = 'in_progress' then
    v_left := greatest(0, ceil(extract(epoch from (v_att.started_at + interval '240 seconds' - now())))::integer);
    return jsonb_build_object('anagram_date', v_today, 'status', 'in_progress', 'time_limit_seconds', 240,
      'seconds_left', v_left, 'scrambled', v_day.scrambled, 'letter_count', length(v_day.word),
      'guess_count', v_att.guess_count);
  end if;

  return jsonb_build_object('anagram_date', v_today, 'status', v_att.status, 'time_limit_seconds', 240,
    'scrambled', v_day.scrambled, 'letter_count', length(v_day.word), 'answer', v_day.word,
    'guess_count', v_att.guess_count, 'solve_ms', v_att.solve_ms);
end;
$$;

-- ---------------------------------------------------------------------------
-- Start: the clock begins -----------------------------------------------------------------
-- Pressing Start twice (two tabs) leaves the first start time in place.
-- ---------------------------------------------------------------------------
create function public.daily_anagram_start(p_user_id uuid, p_date date) returns jsonb
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
  if not daily.ensure_anagram(v_today) then
    return jsonb_build_object('result', 'no_word');
  end if;

  insert into daily.anagram_attempts (user_id, anagram_date)
  values (p_user_id, v_today)
  on conflict (user_id, anagram_date) do nothing;

  return jsonb_build_object('result', 'ok') || public.daily_anagram_state(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- A guess -------------------------------------------------------------------------------------
-- Unlimited guesses. The attempt row is locked while a guess is checked, so two guesses sent at
-- once cannot both finish it. Results:
--   closed | not_started | finished | wrong_letters (not made of the same letters) | wrong (same letters, not
--   the word) | ok (solved, or the minute ran out and it was recorded as unsolved)
-- ---------------------------------------------------------------------------
create function public.daily_anagram_guess(p_user_id uuid, p_date date, p_guess text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guess  text := lower(btrim(coalesce(p_guess, '')));
  v_day    daily.anagram_days;
  v_att    daily.anagram_attempts;
  v_late   boolean;
  v_ms     integer;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;

  select * into v_att from daily.anagram_attempts
   where user_id = p_user_id and anagram_date = p_date
   for update;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' then return jsonb_build_object('result', 'finished'); end if;

  select * into v_day from daily.anagram_days where anagram_date = p_date;
  v_late := now() > v_att.started_at + daily.anagram_limit();

  if v_late then
    update daily.anagram_attempts
       set status = 'unsolved', finished_at = v_att.started_at + interval '240 seconds'
     where id = v_att.id;
    return jsonb_build_object('result', 'ok') || public.daily_anagram_state(p_user_id);
  end if;

  if v_guess !~ '^[a-z]+$' or length(v_guess) <> length(v_day.word)
     or (select string_agg(c, '' order by c) from unnest(string_to_array(v_guess, null)) c)
        is distinct from (select string_agg(c, '' order by c) from unnest(string_to_array(v_day.word, null)) c) then
    update daily.anagram_attempts set guess_count = guess_count + 1 where id = v_att.id;
    return jsonb_build_object('result', 'wrong_letters');
  end if;

  if v_guess <> v_day.word then
    update daily.anagram_attempts set guess_count = guess_count + 1 where id = v_att.id;
    return jsonb_build_object('result', 'wrong');
  end if;

  v_ms := least(240000, greatest(0, floor(extract(epoch from (now() - v_att.started_at)) * 1000)::integer));
  update daily.anagram_attempts
     set status = 'solved', finished_at = now(), solve_ms = v_ms, guess_count = guess_count + 1
   where id = v_att.id;
  return jsonb_build_object('result', 'ok') || public.daily_anagram_state(p_user_id);
end;
$$;

revoke all on function public.daily_anagram_state(uuid) from public, anon, authenticated;
revoke all on function public.daily_anagram_start(uuid, date) from public, anon, authenticated;
revoke all on function public.daily_anagram_guess(uuid, date, text) from public, anon, authenticated;
grant execute on function public.daily_anagram_state(uuid) to service_role;
grant execute on function public.daily_anagram_start(uuid, date) to service_role;
grant execute on function public.daily_anagram_guess(uuid, date, text) to service_role;
revoke all on function daily.ensure_anagram(date) from public, anon, authenticated;
revoke all on function daily.anagram_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rewards ---------------------------------------------------------------------------------------
-- Finishing pays 10 XP and 25 deskbits; solving pays the rest (+10 XP, +225 deskbits), so
-- solved = 20 XP / 250 deskbits and unsolved = 10 XP / 25 deskbits. Absolute values.
-- ---------------------------------------------------------------------------
insert into public.reward_rules (event_type, label, xp, deskbits, cap_group, daily_cap_count, is_active) values
  ('daily_anagram_finished', 'Finished the daily anagram', 10,  25, 'daily_anagram_finished', 1, true),
  ('daily_anagram_solved',   'Solved the daily anagram',   10, 225, 'daily_anagram_solved',   1, true)
on conflict (event_type) do update
  set xp = excluded.xp, deskbits = excluded.deskbits, is_active = true;
