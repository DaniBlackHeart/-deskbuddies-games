-- 0052_daily_trivia.sql
-- Daily Trivia: one question a day, the same for every member, one minute to answer,
-- one attempt per member per day. Multiple choice or typed answers, graded like Trivia Night
-- (typed answers go through the same normalise-and-compare as the live game).
--
-- Decisions (Dani, 27 Nov 2026): own "daily" schema, English, one attempt, resets at midnight
-- Asia/Manila, mix of multiple choice and typed, a Start button then one minute on a SERVER
-- clock, no practice, a wrong / timed-out / unanswered attempt pays 10% of the deskbits.
-- Questions are supplied by Dani/Rika (seed/daily-trivia has the loader).
--
-- Same shape as the Daily Puzzle (0049):
--   * Tables live in schema "daily", closed to the browser (RLS on, no policies, no grants).
--   * Four small SECURITY DEFINER functions in public, service role only, are the only way in.
--     The daily-trivia Edge Function calls them after confirming the caller is a verified member.
--   * The question text is not sent until the member presses Start; the right answer is never sent
--     until their attempt is over.
--   * The clock is the database's: the attempt stores when Start was pressed. Leaving or closing
--     the page does not pause it. A reply that arrives after one minute (plus 2 seconds for the
--     network) is a timed-out attempt, whatever the browser says.
--   * An attempt not finished by midnight pays nothing and does not count: its reward is only asked
--     for when it finishes, and a day that has ended refuses answers ("closed").
--
-- Rewards (rules created here, ACTIVE, same split as the puzzle):
--     correct    = 20 XP and 250 deskbits
--     not correct (wrong, timed out) = 10 XP and 25 deskbits
-- To switch them off:
--   update public.reward_rules set is_active = false
--    where event_type in ('daily_trivia_finished','daily_trivia_correct');

-- ---------------------------------------------------------------------------
-- Questions -------------------------------------------------------------------
-- ---------------------------------------------------------------------------
create table daily.trivia_questions (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('multiple_choice', 'typed')),
  category        text,                                   -- free text, e.g. 'Science'; never shown before Start
  prompt          text not null check (length(btrim(prompt)) > 0),
  choices         jsonb,                                  -- multiple_choice: array of 2 to 6 strings
  correct_choice  integer,                                -- multiple_choice: index into choices
  accepted_answers jsonb,                                 -- typed: array of accepted spellings
  scheduled_for   date unique,                            -- optional: pin this question to one day
  is_active       boolean not null default true,
  last_used_on    date,
  times_used      integer not null default 0,
  created_at      timestamptz not null default now(),
  check (type <> 'multiple_choice' or (
    jsonb_typeof(choices) = 'array'
    and jsonb_array_length(choices) between 2 and 6
    and correct_choice between 0 and jsonb_array_length(choices) - 1)),
  check (type <> 'typed' or (
    jsonb_typeof(accepted_answers) = 'array'
    and jsonb_array_length(accepted_answers) >= 1))
);

-- One row per community day: the question everyone gets that day.
create table daily.trivia_days (
  trivia_date date primary key,
  question_id uuid not null references daily.trivia_questions (id)
);

create table daily.trivia_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  trivia_date   date not null,
  status        text not null default 'in_progress'
                check (status in ('in_progress', 'correct', 'incorrect', 'timed_out')),
  started_at    timestamptz not null default now(),   -- when Start was pressed: the clock begins here
  finished_at   timestamptz,
  answer_choice integer,                              -- what the member picked (multiple choice)
  answer_text   text check (answer_text is null or length(answer_text) <= 200),
  unique (user_id, trivia_date),
  check ((status = 'in_progress') = (finished_at is null))
);

alter table daily.trivia_questions enable row level security;
alter table daily.trivia_days      enable row level security;
alter table daily.trivia_attempts  enable row level security;
revoke all on all tables in schema daily from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The question for a day: picked once, the same for everyone --------------------
-- A question pinned to the date wins; otherwise a never-used one (random), and when
-- all have been used the one used longest ago. Null when no question is loaded.
-- ---------------------------------------------------------------------------
create function daily.ensure_trivia(p_date date) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  select question_id into v_id from daily.trivia_days where trivia_date = p_date;
  if found then return v_id; end if;

  perform pg_advisory_xact_lock(hashtext('daily_trivia_pick')::bigint);

  select question_id into v_id from daily.trivia_days where trivia_date = p_date;
  if found then return v_id; end if;

  select id into v_id from daily.trivia_questions
   where scheduled_for = p_date and is_active;
  if v_id is null then
    select id into v_id from daily.trivia_questions
     where is_active and scheduled_for is null
     order by (last_used_on is not null), last_used_on, random()
     limit 1;
  end if;
  if v_id is null then return null; end if;

  insert into daily.trivia_days (trivia_date, question_id) values (p_date, v_id);
  update daily.trivia_questions
     set last_used_on = p_date, times_used = times_used + 1
   where id = v_id;
  return v_id;
end;
$$;

-- One minute, plus 2 seconds for the network. Kept in one place.
create function daily.trivia_limit() returns interval language sql immutable as $$ select interval '62 seconds' $$;

-- ---------------------------------------------------------------------------
-- State: where the member's question for today stands ---------------------------
-- Also finishes an attempt whose minute ran out (the member may have closed the tab).
-- The question is included only while the attempt is running; the right answer only
-- once it is over.
-- ---------------------------------------------------------------------------
create function public.daily_trivia_state(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
  v_qid   uuid;
  v_q     daily.trivia_questions;
  v_att   daily.trivia_attempts;
  v_left  integer;
  v_ans   text;
begin
  v_qid := daily.ensure_trivia(v_today);
  if v_qid is null then
    return jsonb_build_object('trivia_date', v_today, 'status', 'no_question', 'time_limit_seconds', 60);
  end if;

  select * into v_q from daily.trivia_questions where id = v_qid;

  select * into v_att from daily.trivia_attempts
   where user_id = p_user_id and trivia_date = v_today
   for update;

  if not found then
    return jsonb_build_object('trivia_date', v_today, 'status', 'not_started',
                              'time_limit_seconds', 60, 'type', v_q.type);
  end if;

  if v_att.status = 'in_progress' and now() > v_att.started_at + daily.trivia_limit() then
    update daily.trivia_attempts
       set status = 'timed_out', finished_at = v_att.started_at + interval '60 seconds'
     where id = v_att.id
     returning * into v_att;
  end if;

  if v_att.status = 'in_progress' then
    v_left := greatest(0, ceil(extract(epoch from (v_att.started_at + interval '60 seconds' - now())))::integer);
    return jsonb_build_object(
      'trivia_date', v_today, 'status', 'in_progress', 'time_limit_seconds', 60,
      'seconds_left', v_left, 'type', v_q.type, 'category', v_q.category,
      'prompt', v_q.prompt,
      'choices', case when v_q.type = 'multiple_choice' then v_q.choices end);
  end if;

  -- Finished: show the right answer.
  v_ans := case when v_q.type = 'multiple_choice'
                then v_q.choices ->> v_q.correct_choice
                else v_q.accepted_answers ->> 0 end;
  return jsonb_build_object(
    'trivia_date', v_today, 'status', v_att.status, 'time_limit_seconds', 60,
    'type', v_q.type, 'category', v_q.category, 'prompt', v_q.prompt,
    'choices', case when v_q.type = 'multiple_choice' then v_q.choices end,
    'correct_answer', v_ans,
    'your_choice', v_att.answer_choice,
    'your_answer', v_att.answer_text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Start: the clock begins ---------------------------------------------------------
-- Pressing Start twice (two tabs) leaves the first start time in place.
-- ---------------------------------------------------------------------------
create function public.daily_trivia_start(p_user_id uuid, p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.community_today();
  v_qid   uuid;
begin
  if p_date is distinct from v_today then
    return jsonb_build_object('result', 'closed');
  end if;
  v_qid := daily.ensure_trivia(v_today);
  if v_qid is null then
    return jsonb_build_object('result', 'no_question');
  end if;

  insert into daily.trivia_attempts (user_id, trivia_date)
  values (p_user_id, v_today)
  on conflict (user_id, trivia_date) do nothing;

  return jsonb_build_object('result', 'ok') || public.daily_trivia_state(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Answer key: what the Edge Function grades against --------------------------------
-- Only released for an attempt that is still running and inside its time.
-- ---------------------------------------------------------------------------
create function public.daily_trivia_answer_key(p_user_id uuid, p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att daily.trivia_attempts;
  v_q   daily.trivia_questions;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;

  select * into v_att from daily.trivia_attempts
   where user_id = p_user_id and trivia_date = p_date;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' or now() > v_att.started_at + daily.trivia_limit() then
    return jsonb_build_object('result', 'finished');
  end if;

  select q.* into v_q from daily.trivia_questions q
    join daily.trivia_days d on d.question_id = q.id
   where d.trivia_date = p_date;

  return jsonb_build_object('result', 'ok', 'type', v_q.type,
    'choice_count', case when v_q.type = 'multiple_choice' then jsonb_array_length(v_q.choices) end,
    'correct_choice', v_q.correct_choice, 'accepted_answers', v_q.accepted_answers);
end;
$$;

-- ---------------------------------------------------------------------------
-- Finish: record the outcome once ---------------------------------------------------
-- The attempt row is locked, so two answers sent at once cannot both count: the first one
-- in finishes it and the other gets "finished". A late answer is recorded as timed out.
-- p_outcome is only ever 'correct' or 'incorrect', decided by the Edge Function.
-- ---------------------------------------------------------------------------
create function public.daily_trivia_finish(
  p_user_id uuid, p_date date, p_outcome text, p_choice integer, p_text text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att    daily.trivia_attempts;
  v_status text;
begin
  if p_date is distinct from public.community_today() then
    return jsonb_build_object('result', 'closed');
  end if;
  if p_outcome not in ('correct', 'incorrect') then
    raise exception 'daily trivia: bad outcome %', p_outcome;
  end if;

  select * into v_att from daily.trivia_attempts
   where user_id = p_user_id and trivia_date = p_date
   for update;
  if not found then return jsonb_build_object('result', 'not_started'); end if;
  if v_att.status <> 'in_progress' then return jsonb_build_object('result', 'finished'); end if;

  v_status := case when now() > v_att.started_at + daily.trivia_limit() then 'timed_out' else p_outcome end;

  update daily.trivia_attempts
     set status = v_status,
         finished_at = case when v_status = 'timed_out' then v_att.started_at + interval '60 seconds' else now() end,
         answer_choice = case when v_status = 'timed_out' then null else p_choice end,
         answer_text   = case when v_status = 'timed_out' then null else left(p_text, 200) end
   where id = v_att.id;

  return jsonb_build_object('result', 'ok') || public.daily_trivia_state(p_user_id);
end;
$$;

revoke all on function public.daily_trivia_state(uuid) from public, anon, authenticated;
revoke all on function public.daily_trivia_start(uuid, date) from public, anon, authenticated;
revoke all on function public.daily_trivia_answer_key(uuid, date) from public, anon, authenticated;
revoke all on function public.daily_trivia_finish(uuid, date, text, integer, text) from public, anon, authenticated;
grant execute on function public.daily_trivia_state(uuid) to service_role;
grant execute on function public.daily_trivia_start(uuid, date) to service_role;
grant execute on function public.daily_trivia_answer_key(uuid, date) to service_role;
grant execute on function public.daily_trivia_finish(uuid, date, text, integer, text) to service_role;
revoke all on function daily.ensure_trivia(date) from public, anon, authenticated;
revoke all on function daily.trivia_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rewards ---------------------------------------------------------------------------
-- Finishing pays 10 XP and 25 deskbits; a correct answer pays the rest (+10 XP, +225
-- deskbits), so correct = 20 XP / 250 deskbits and not correct = 10 XP / 25 deskbits.
-- Absolute values; running twice changes nothing.
-- ---------------------------------------------------------------------------
insert into public.reward_rules (event_type, label, xp, deskbits, cap_group, daily_cap_count, is_active) values
  ('daily_trivia_finished', 'Finished the daily trivia', 10,  25, 'daily_trivia_finished', 1, true),
  ('daily_trivia_correct',  'Answered the daily trivia', 10, 225, 'daily_trivia_correct',  1, true)
on conflict (event_type) do update
  set xp = excluded.xp, deskbits = excluded.deskbits, is_active = true;
