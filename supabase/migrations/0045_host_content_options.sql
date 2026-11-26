-- DeskBuddies Games — let a member host choose WHICH set / category to play.
--
-- Before 0043 only MODs could start a session, and MODs picked a Trivia
-- question set, a Family Feud set or an Impostor category from the MOD pages.
-- Members can't read those authoring tables (they stay MOD-only), so this
-- function hands back just the NAMES and sizes of what is playable: no
-- questions, answers or words. The session itself is still assembled
-- server-side by the host Edge Function, same as before.

create or replace function public.host_content_options()
returns table (game text, id uuid, name text, item_count int)
language sql
security definer
set search_path = public
stable
as $$
  select * from (
    select 'trivia'::text as game, s.id, s.name,
           (select count(*)::int from public.questions q where q.question_set_id = s.id and q.archived_at is null) as item_count
      from public.question_sets s
     where s.archived_at is null
    union all
    select 'feud', s.id, s.name,
           (select count(*)::int from public.feud_round_questions q where q.feud_set_id = s.id)
      from public.feud_sets s
    union all
    select 'impostor', c.id, c.name,
           (select count(*)::int from public.impostor_words w where w.category_id = c.id and w.archived_at is null)
      from public.impostor_categories c
     where c.archived_at is null
  ) options
  where options.item_count > 0 and public.is_verified_member()
  order by options.game, options.name;
$$;

revoke all on function public.host_content_options() from public, anon;
grant execute on function public.host_content_options() to authenticated;
