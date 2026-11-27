-- 0049_daily_puzzle.sql
-- Daily Puzzle: one five-letter word a day, the same for every member, six guesses,
-- one attempt per member per day. Wordle-style rules, our own word lists.
--
-- Spec: claude/Debbie_Daily_Puzzle_Spec_v0.md (v0.2, 27 Nov 2026).
--
-- Where things live
--   * Own schema "daily", closed to the browser: no grants to anon/authenticated and
--     RLS on with no policies. The tables are only reachable through the three
--     functions in public (daily_puzzle_state, daily_puzzle_guess), which only the
--     service role can run, and which the daily-puzzle Edge Function calls after it
--     has confirmed the caller is a verified member.
--   * The answer and the word lists never reach the browser. A guess is graded here,
--     and the answer is returned only once the attempt is over.
--   * Word lists are loaded by 0050_daily_puzzle_words.sql.
--
-- Rules enforced here
--   * One attempt per member per day, six guesses, a guess must be in the word list
--     and a rejected guess does not use one up.
--   * The puzzle belongs to the community day (Asia/Manila, community_today()). A
--     guess sent for a day that has already ended is refused ("closed"). An attempt
--     left unfinished at midnight is simply never finished: it pays nothing and does
--     not count (the reward is only asked for when an attempt finishes).
--   * Two guesses sent at once cannot both count: the member's attempt row is locked
--     while a guess is graded.
--
-- Rewards (see the bottom of this file): the finished-puzzle and solved-puzzle rules
-- in reward_rules are given the 10% / 90% split that makes
--   solved   = 20 XP and 250 deskbits
--   unsolved = 10 XP and  25 deskbits
-- and are switched on. Nothing pays unless earning_settings.earning_enabled is on.
-- To switch the puzzle's rewards off again:
--   update public.reward_rules set is_active = false
--    where event_type in ('puzzle_finished','puzzle_solved');

create schema if not exists daily;
revoke all on schema daily from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Words -----------------------------------------------------------------------
-- ---------------------------------------------------------------------------
create table daily.puzzle_valid_words (
  word text primary key check (word ~ '^[a-z]{5}$')
);

-- The pool of possible answers. Every answer must also be a valid guess.
create table daily.puzzle_answers (
  word         text primary key references daily.puzzle_valid_words(word),
  last_used_on date,
  times_used   integer not null default 0
);

-- One row per community day: the word everyone plays that day.
create table daily.puzzles (
  puzzle_date date primary key,
  word        text not null references daily.puzzle_answers(word)
);

-- ---------------------------------------------------------------------------
-- Attempts and guesses --------------------------------------------------------
-- ---------------------------------------------------------------------------
create table daily.puzzle_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  puzzle_date date not null,
  status      text not null default 'in_progress' check (status in ('in_progress', 'solved', 'unsolved')),
  guess_count smallint not null default 0 check (guess_count between 0 and 6),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, puzzle_date),
  check ((status = 'in_progress') = (finished_at is null))
);

create table daily.puzzle_guesses (
  attempt_id uuid not null references daily.puzzle_attempts(id) on delete cascade,
  guess_no   smallint not null check (guess_no between 1 and 6),
  guess      text not null check (guess ~ '^[a-z]{5}$'),
  -- one character per letter: c = right place, p = in the word elsewhere, a = not in the word
  marks      text not null check (marks ~ '^[cpa]{5}$'),
  created_at timestamptz not null default now(),
  primary key (attempt_id, guess_no)
);

alter table daily.puzzle_valid_words enable row level security;
alter table daily.puzzle_answers     enable row level security;
alter table daily.puzzles            enable row level security;
alter table daily.puzzle_attempts    enable row level security;
alter table daily.puzzle_guesses     enable row level security;
-- No policies on purpose: members never read these tables directly.
revoke all on all tables in schema daily from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Marking a guess (standard rules for repeated letters) ------------------------
-- Pass 1 marks right-place letters. Pass 2 gives "in the word elsewhere" to a
-- letter only while an unmatched copy of it is left in the answer.
-- ---------------------------------------------------------------------------
create function daily.mark_guess(p_answer text, p_guess text) returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  a      text[] := regexp_split_to_array(p_answer, '');
  g      text[] := regexp_split_to_array(p_guess, '');
  marks  text[] := array['a', 'a', 'a', 'a', 'a'];
  taken  boolean[] := array[false, false, false, false, false];
  i      integer;
  j      integer;
begin
  for i in 1..5 loop
    if g[i] = a[i] then
      marks[i] := 'c';
      taken[i] := true;
    end if;
  end loop;
  for i in 1..5 loop
    if marks[i] = 'a' then
      for j in 1..5 loop
        if not taken[j] and a[j] = g[i] then
          marks[i] := 'p';
          taken[j] := true;
          exit;
        end if;
      end loop;
    end if;
  end loop;
  return array_to_string(marks, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- The word for a day: picked once, the same for everyone -----------------------
-- Never-used answers come first (random among them); when every answer has been
-- used the longest-ago one is reused. The advisory lock keeps two members who
-- arrive at the same moment after midnight from picking two different words.
-- ---------------------------------------------------------------------------
create function daily.ensure_puzzle(p_date date) returns text
language plpgsql
set search_path = public
as $$
declare
  v_word text;
begin
  select word into v_word from daily.puzzles where puzzle_date = p_date;
  if found then return v_word; end if;

  perform pg_advisory_xact_lock(hashtext('daily_puzzle_pick')::bigint);

  select word into v_word from daily.puzzles where puzzle_date = p_date;
  if found then return v_word; end if;

  select word into v_word from daily.puzzle_answers
   order by (last_used_on is not null), last_used_on, random()
   limit 1;
  if v_word is null then
    raise exception 'daily puzzle: no answers are loaded';
  end if;

  insert into daily.puzzles (puzzle_date, word) values (p_date, v_word);
  update daily.puzzle_answers
     set last_used_on = p_date, times_used = times_used + 1
   where word = v_word;
  return v_word;
end;
$$;

-- ---------------------------------------------------------------------------
-- State: where the member's puzzle for today stands ----------------------------
-- The answer is included only when the attempt is over.
-- ---------------------------------------------------------------------------
create function public.daily_puzzle_state(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := public.community_today();
  v_word    text;
  v_att     daily.puzzle_attempts;
  v_guesses jsonb;
begin
  v_word := daily.ensure_puzzle(v_today);

  select * into v_att from daily.puzzle_attempts
   where user_id = p_user_id and puzzle_date = v_today;

  if not found then
    return jsonb_build_object(
      'puzzle_date', v_today, 'status', 'not_started',
      'guess_count', 0, 'max_guesses', 6, 'guesses', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('guess', guess, 'marks', marks) order by guess_no), '[]'::jsonb)
    into v_guesses
    from daily.puzzle_guesses where attempt_id = v_att.id;

  return jsonb_build_object(
    'puzzle_date', v_today,
    'status',      v_att.status,
    'guess_count', v_att.guess_count,
    'max_guesses', 6,
    'guesses',     v_guesses,
    'answer',      case when v_att.status <> 'in_progress' then v_word end,
    'finished_at', v_att.finished_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A guess ---------------------------------------------------------------------
-- p_puzzle_date is the day the member's screen thinks it is playing. If that day
-- has ended the guess is refused, so a puzzle left open overnight can never be
-- answered against the next day's word.
-- result: closed | invalid | not_a_word | finished | ok
-- ---------------------------------------------------------------------------
create function public.daily_puzzle_guess(p_user_id uuid, p_puzzle_date date, p_guess text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today  date := public.community_today();
  v_guess  text := lower(btrim(coalesce(p_guess, '')));
  v_word   text;
  v_att    daily.puzzle_attempts;
  v_marks  text;
  v_n      integer;
  v_status text;
begin
  if p_puzzle_date is distinct from v_today then
    return jsonb_build_object('result', 'closed');
  end if;

  if v_guess !~ '^[a-z]{5}$' then
    return jsonb_build_object('result', 'invalid');
  end if;

  -- A word that is not in the list costs nothing and does not start an attempt.
  if not exists (select 1 from daily.puzzle_valid_words where word = v_guess) then
    return jsonb_build_object('result', 'not_a_word');
  end if;

  v_word := daily.ensure_puzzle(v_today);

  insert into daily.puzzle_attempts (user_id, puzzle_date)
  values (p_user_id, v_today)
  on conflict (user_id, puzzle_date) do nothing;

  -- Lock this member's attempt so two guesses sent at once are graded one after the other.
  select * into v_att from daily.puzzle_attempts
   where user_id = p_user_id and puzzle_date = v_today
   for update;

  if v_att.status <> 'in_progress' then
    return jsonb_build_object('result', 'finished');
  end if;

  v_n     := v_att.guess_count + 1;
  v_marks := daily.mark_guess(v_word, v_guess);

  insert into daily.puzzle_guesses (attempt_id, guess_no, guess, marks)
  values (v_att.id, v_n, v_guess, v_marks);

  v_status := case when v_marks = 'ccccc' then 'solved'
                   when v_n >= 6 then 'unsolved'
                   else 'in_progress' end;

  update daily.puzzle_attempts
     set guess_count = v_n,
         status      = v_status,
         finished_at = case when v_status <> 'in_progress' then now() end
   where id = v_att.id;

  return jsonb_build_object(
    'result',      'ok',
    'marks',       v_marks,
    'guess_count', v_n,
    'status',      v_status,
    'answer',      case when v_status <> 'in_progress' then v_word end
  );
end;
$$;

revoke all on function public.daily_puzzle_state(uuid) from public, anon, authenticated;
revoke all on function public.daily_puzzle_guess(uuid, date, text) from public, anon, authenticated;
grant execute on function public.daily_puzzle_state(uuid) to service_role;
grant execute on function public.daily_puzzle_guess(uuid, date, text) to service_role;
revoke all on function daily.mark_guess(text, text) from public, anon, authenticated;
revoke all on function daily.ensure_puzzle(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rewards ---------------------------------------------------------------------
-- 0046 left puzzle_finished at 0 deskbits and set puzzle_solved to 250. For the
-- 10% rule the finish pays 25 deskbits and the solve pays the other 225, so:
--   solved   = finished + solved = 20 XP, 250 deskbits
--   unsolved = finished only     = 10 XP,  25 deskbits
-- XP is unchanged. Absolute values, so running this twice cannot compound; the
-- reward_rules_touch trigger bumps each rule's version. Practice rounds were
-- removed, so that rule goes (only if it has never paid anything).
-- ---------------------------------------------------------------------------
update public.reward_rules
   set deskbits = 25, is_active = true
 where event_type = 'puzzle_finished';

update public.reward_rules
   set deskbits = 225, is_active = true
 where event_type = 'puzzle_solved';

delete from public.reward_rules r
 where r.event_type = 'puzzle_practice'
   and not exists (select 1 from public.reward_ledger l where l.event_type = 'puzzle_practice');
