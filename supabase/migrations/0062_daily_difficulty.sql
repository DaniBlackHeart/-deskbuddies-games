-- 0062_daily_difficulty.sql
-- Random daily difficulty for ALL the daily games (Rika, confirmed 27 Nov 2026): each new day, every game picks
-- Easy, Medium or Hard at random (equal chance among the levels that have content) and then an item of that
-- level (never-used first, then longest ago). Everyone gets the same level on a given day. Number Nook (sudoku)
-- already does this since 0060; this adds the other four.
--
-- What "difficulty" means per game (provisional, easy to change; rewards are the same at every level):
--   Five Tiles   : by the word itself. Hard = unusual letters and/or a repeated letter (score 3 or more),
--                  Medium = score 1 or 2, Easy = score 0. Score: +2 if a letter repeats, +1 for each of j q x z k v w f y.
--                  A generated column, so every word added later is levelled automatically.
--   Minute Quiz  : tagged by hand per question (column difficulty; new questions default to medium).
--   Letter Shuffle: by length. 7 letters Easy, 8 Medium, 9 Hard. A generated column.
--   Word Hunt    : Easy = shorter words (4-6), right/down only; Medium = the original mix; Hard = longer words (6-8)
--                  with at least 4 running diagonally. Puzzles for Easy and Hard are loaded by 0063.
-- To fix one level for a game (all new days): update daily.game_settings set difficulty = 'easy' where game = 'puzzle';
-- (games: puzzle, trivia, anagram, word_search). Back to random: 'random'. Days already picked never change.

create table daily.game_settings (
  game       text primary key check (game in ('puzzle', 'trivia', 'anagram', 'word_search')),
  difficulty text not null default 'random' check (difficulty in ('easy', 'medium', 'hard', 'random'))
);
insert into daily.game_settings (game) values ('puzzle'), ('trivia'), ('anagram'), ('word_search');
alter table daily.game_settings enable row level security;
revoke all on daily.game_settings from public, anon, authenticated;

-- The level for a new day: the fixed one if the setting names a level that has content, otherwise random.
create function daily.pick_level(p_game text, p_levels text[]) returns text
language plpgsql
set search_path = public
as $$
declare
  v_setting text;
begin
  if p_levels is null or cardinality(p_levels) = 0 then return null; end if;
  select difficulty into v_setting from daily.game_settings where game = p_game;
  if v_setting is not null and v_setting <> 'random' and v_setting = any (p_levels) then return v_setting; end if;
  return (select l from unnest(p_levels) l order by random() limit 1);
end;
$$;
revoke all on function daily.pick_level(text, text[]) from public, anon, authenticated;

-- Levels on the content --------------------------------------------------------------------------------
alter table daily.puzzle_answers add column difficulty text generated always as (
  case
    when (case when word ~ '(.).*\1' then 2 else 0 end + length(word) - length(regexp_replace(word, '[jqxzkvwfy]', '', 'g'))) >= 3 then 'hard'
    when (case when word ~ '(.).*\1' then 2 else 0 end + length(word) - length(regexp_replace(word, '[jqxzkvwfy]', '', 'g'))) >= 1 then 'medium'
    else 'easy'
  end) stored;

alter table daily.anagram_answers add column difficulty text generated always as (
  case length(word) when 7 then 'easy' when 8 then 'medium' else 'hard' end) stored;

alter table daily.trivia_questions add column difficulty text not null default 'medium'
  check (difficulty in ('easy', 'medium', 'hard'));
update daily.trivia_questions set difficulty = 'easy' where prompt = any (array[
    $q$How many sides does a hexagon have?$q$,
    $q$What is the largest planet in our solar system?$q$,
    $q$Which sport is played at Wimbledon?$q$,
    $q$How many players from one team are on a basketball court at a time?$q$,
    $q$Which sport is Manny Pacquiao best known for?$q$,
    $q$Which planet is known as the Red Planet?$q$,
    $q$Which is the tallest animal in the world?$q$,
    $q$Which company owns the Android mobile operating system?$q$,
    $q$Which gas do plants take in from the air to make food?$q$,
    $q$What is the capital city of Italy?$q$,
    $q$What is the capital city of Spain?$q$,
    $q$What is the square root of 81?$q$,
    $q$What is the capital city of South Korea?$q$,
    $q$What is the capital city of Japan?$q$,
    $q$How many strings does a standard guitar have?$q$,
    $q$What is the largest organ of the human body?$q$,
    $q$What is 12 × 12?$q$,
    $q$Which is the largest ocean on Earth?$q$,
    $q$Which of these birds cannot fly?$q$,
    $q$Which is the only mammal that can truly fly?$q$,
    $q$What is the currency of Japan?$q$,
    $q$Kyoto is a city in which country?$q$,
    $q$How many days are in a leap year?$q$,
    $q$Which country has the largest land area in the world?$q$,
    $q$What is the tallest mountain on Earth above sea level?$q$,
    $q$What is the largest animal on Earth?$q$,
    $q$What is the name of Earth's natural satellite?$q$,
    $q$What is the capital city of France?$q$,
    $q$What gas do humans need to breathe in to survive?$q$,
    $q$How many continents are there?$q$,
    $q$What force pulls objects toward the Earth?$q$,
    $q$What do bees make?$q$,
    $q$What is the capital city of Thailand?$q$,
    $q$Who painted the Mona Lisa?$q$,
    $q$What is the capital city of the Philippines?$q$,
    $q$Mount Fuji is found in which country?$q$,
    $q$How many rings are on the Olympic flag?$q$,
    $q$What is the smallest prime number?$q$,
    $q$What is the Filipino word for 'water'?$q$,
    $q$What is the capital city of Canada?$q$,
    $q$Which animal is nicknamed the 'ship of the desert'?$q$,
    $q$Mixing blue and yellow paint gives which colour?$q$,
    $q$Which is the fastest land animal?$q$,
    $q$How many legs does a spider have?$q$,
    $q$What is the freezing point of water in degrees Celsius?$q$,
    $q$What is the chemical formula for water?$q$
  ]);
update daily.trivia_questions set difficulty = 'hard' where prompt = any (array[
    $q$How many hearts does an octopus have?$q$,
    $q$About how many islands does the Philippines have?$q$,
    $q$How many bones does an adult human body have?$q$,
    $q$Ferdinand Magellan died in a 1521 battle on which island?$q$,
    $q$Pizza as we know it began in which Italian city?$q$,
    $q$Which metal is liquid at room temperature?$q$,
    $q$What is the chemical symbol for gold?$q$,
    $q$What is the capital city of Australia?$q$,
    $q$In which year did the Philippines declare independence from Spain?$q$,
    $q$Which of these numbers is a prime number?$q$,
    $q$Which is the longest river in the Philippines?$q$,
    $q$Which Roman numeral stands for 50?$q$
  ]);

alter table daily.word_search_puzzles add column difficulty text not null default 'medium'
  check (difficulty in ('easy', 'medium', 'hard'));

-- Pick functions: level first, then the item ------------------------------------------------------------
create or replace function daily.ensure_puzzle(p_date date) returns text
language plpgsql
set search_path = public
as $$
declare
  v_word text;
  v_level text;
begin
  select word into v_word from daily.puzzles where puzzle_date = p_date;
  if found then return v_word; end if;

  perform pg_advisory_xact_lock(hashtext('daily_puzzle_pick')::bigint);

  select word into v_word from daily.puzzles where puzzle_date = p_date;
  if found then return v_word; end if;

  v_level := daily.pick_level('puzzle', array(select distinct difficulty from daily.puzzle_answers));
  select word into v_word from daily.puzzle_answers
   where difficulty = v_level
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

create or replace function daily.ensure_trivia(p_date date) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_level text;
begin
  select question_id into v_id from daily.trivia_days where trivia_date = p_date;
  if found then return v_id; end if;

  perform pg_advisory_xact_lock(hashtext('daily_trivia_pick')::bigint);

  select question_id into v_id from daily.trivia_days where trivia_date = p_date;
  if found then return v_id; end if;

  select id into v_id from daily.trivia_questions
   where scheduled_for = p_date and is_active;
  if v_id is null then
    v_level := daily.pick_level('trivia',
      array(select distinct difficulty from daily.trivia_questions where is_active and scheduled_for is null));
    select id into v_id from daily.trivia_questions
     where is_active and scheduled_for is null and difficulty = v_level
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

create or replace function daily.ensure_anagram(p_date date) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_word  text;
  v_scr   text;
  v_level text;
  i       integer := 0;
begin
  if exists (select 1 from daily.anagram_days where anagram_date = p_date) then return true; end if;

  perform pg_advisory_xact_lock(hashtext('daily_anagram_pick')::bigint);

  if exists (select 1 from daily.anagram_days where anagram_date = p_date) then return true; end if;

  v_level := daily.pick_level('anagram', array(select distinct difficulty from daily.anagram_answers));
  select word into v_word from daily.anagram_answers
   where difficulty = v_level
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

create or replace function daily.ensure_word_search(p_date date) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_level text;
begin
  if exists (select 1 from daily.word_search_days where search_date = p_date) then return true; end if;

  perform pg_advisory_xact_lock(hashtext('daily_word_search_pick')::bigint);

  if exists (select 1 from daily.word_search_days where search_date = p_date) then return true; end if;

  v_level := daily.pick_level('word_search', array(select distinct difficulty from daily.word_search_puzzles));
  select id into v_id from daily.word_search_puzzles
   where difficulty = v_level
   order by (last_used_on is not null), last_used_on, random()
   limit 1;
  if v_id is null then return false; end if;

  insert into daily.word_search_days (search_date, puzzle_id) values (p_date, v_id);
  update daily.word_search_puzzles set last_used_on = p_date, times_used = times_used + 1 where id = v_id;
  return true;
end;
$$;

revoke all on function daily.ensure_puzzle(date) from public, anon, authenticated;
revoke all on function daily.ensure_trivia(date) from public, anon, authenticated;
revoke all on function daily.ensure_anagram(date) from public, anon, authenticated;
revoke all on function daily.ensure_word_search(date) from public, anon, authenticated;

-- The level of a day's game, for the Edge Functions to show next to the title. Service role only. ----------
create function public.daily_game_level(p_game text, p_date date) returns text
language sql
security definer
set search_path = public
as $$
  select case p_game
    when 'puzzle'      then (select a.difficulty from daily.puzzles d join daily.puzzle_answers a on a.word = d.word where d.puzzle_date = p_date)
    when 'trivia'      then (select q.difficulty from daily.trivia_days d join daily.trivia_questions q on q.id = d.question_id where d.trivia_date = p_date)
    when 'anagram'     then (select a.difficulty from daily.anagram_days d join daily.anagram_answers a on a.word = d.word where d.anagram_date = p_date)
    when 'word_search' then (select p.difficulty from daily.word_search_days d join daily.word_search_puzzles p on p.id = d.puzzle_id where d.search_date = p_date)
    when 'sudoku'      then (select p.difficulty from daily.sudoku_days d join daily.sudoku_puzzles p on p.id = d.puzzle_id where d.sudoku_date = p_date)
  end;
$$;
revoke all on function public.daily_game_level(text, date) from public, anon, authenticated;
grant execute on function public.daily_game_level(text, date) to service_role;
