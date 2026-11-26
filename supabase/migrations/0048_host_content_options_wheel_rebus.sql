-- DeskBuddies Games — let member hosts SEE the Wheel categories and Rebus sets.
--
-- Wheel of Fortune and Type What You See pick their content automatically
-- (a new category each round; puzzles mixed from every set), so a member host
-- never chooses one. But MODs see the full list on the host page, and members
-- should be able to see what is in the mix too. Same rule as 0045: names and
-- sizes only, never phrases, puzzles or answers.
--
-- The return type gains a column (extra_count = Rebus sprint puzzles), and
-- Postgres can't change a function's return type with CREATE OR REPLACE, so
-- it is dropped and recreated with the same grants.

drop function if exists public.host_content_options();

create function public.host_content_options()
returns table (game text, id uuid, name text, item_count int, extra_count int)
language sql
security definer
set search_path = public
stable
as $$
  select * from (
    select 'trivia'::text as game, s.id, s.name,
           (select count(*)::int from public.questions q where q.question_set_id = s.id and q.archived_at is null) as item_count,
           0 as extra_count
      from public.question_sets s
     where s.archived_at is null
    union all
    select 'feud', s.id, s.name,
           (select count(*)::int from public.feud_round_questions q where q.feud_set_id = s.id), 0
      from public.feud_sets s
    union all
    select 'impostor', c.id, c.name,
           (select count(*)::int from public.impostor_words w where w.category_id = c.id and w.archived_at is null), 0
      from public.impostor_categories c
     where c.archived_at is null
    union all
    select 'wheel', c.id, c.name,
           (select count(*)::int from public.wheel_phrases p where p.category_id = c.id and p.archived_at is null), 0
      from public.wheel_categories c
     where c.archived_at is null
    union all
    select 'rebus', s.id, s.name,
           (select count(*)::int from public.rebus_puzzles p where p.rebus_set_id = s.id and p.archived_at is null),
           (select count(*)::int from public.rebus_sprint_puzzles sp where sp.rebus_set_id = s.id)
      from public.rebus_sets s
     where s.archived_at is null
  ) options
  where (options.item_count > 0 or options.extra_count > 0) and public.is_verified_member()
  order by options.game, options.name;
$$;

revoke all on function public.host_content_options() from public, anon;
grant execute on function public.host_content_options() to authenticated;
