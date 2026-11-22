-- 0033_buddybook.sql
-- Debbie "Buddybook": the member's private, read-only record.
--
-- Design: claude/Debbie_Buddybook_Design_Brief.md and the "Debbie Buddybook" design.
--
-- Privacy: the Buddybook is only for its owner. Visitors never see it (they see the
-- Brag Shelf). Nothing is readable through the API except the caller's own rows:
-- member_stamps has a select-own policy, config tables have none (service role
-- only), and the buddybook Edge Function only ever answers for the caller.
--
-- Firsts stamps are worked out from the member's own recorded history, so a late
-- joiner can earn them all, and each is recorded once and never removed. A stamp
-- pays 5 XP (provisional, inactive until approved) through grant_reward() with the
-- source key milestone:<stamp_key>.
--
-- Not in this migration on purpose: Side Quest stamps (no wheel yet), First Brain
-- Break and First Game Night (their features are not built, so they are not live).

create table public.stamp_defs (
  key         text primary key,
  name        text not null,
  earned_line text not null,           -- generic, never what the member wrote
  sort        integer not null default 0,
  is_live     boolean not null default false
);

create table public.member_stamps (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  stamp_key text not null references public.stamp_defs (key),
  earned_on date not null,
  primary key (user_id, stamp_key)
);

create table public.buddy_defs (
  key       text primary key,          -- matches member_items 'companion:<key>'
  name      text not null,
  hint      text,                      -- broad hint for a locked buddy; null = not shown while locked
  one_liner text,
  sort      integer not null default 0
);

alter table public.stamp_defs    enable row level security;
alter table public.member_stamps enable row level security;
alter table public.buddy_defs    enable row level security;
revoke all on public.stamp_defs, public.member_stamps, public.buddy_defs from anon, authenticated;
grant select on public.member_stamps to authenticated;
create policy "member_stamps: read own rows"
  on public.member_stamps for select
  using (user_id = auth.uid() and public.is_verified_member());

insert into public.stamp_defs (key, name, earned_line, sort, is_live) values
  ('stamp_first_hello', 'First Hello', 'Checked in for the first time', 1, true),
  ('stamp_first_block', 'First Block', 'Finished a first Focus Block', 2, true),
  ('stamp_first_brain_break', 'First Brain Break', 'Finished a first daily puzzle', 3, false),
  ('stamp_first_detour', 'First Detour', 'Tried a first Daily Detour', 4, true),
  ('stamp_first_game', 'First Game Night', 'Finished a first live game', 5, false),
  ('stamp_first_win', 'First Weekly Win', 'Finished a first Weekly Win', 6, true),
  ('stamp_made_it_mine', 'Made It Mine', 'Saved a first desk customisation', 7, true);

insert into public.buddy_defs (key, name, hint, one_liner, sort) values
  ('paper', 'Paper Pal', 'A first companion for your desk', 'Your first companion at the desk.', 1),
  ('sprout', 'Lamp Sprout', 'A companion for trying small things', null, 2),
  ('mug', 'Mug Mallow', 'A companion for good breaks', 'Always up for a good break.', 3),
  ('bookmark', 'Bookmark Critter', 'A reading companion', null, 4),
  ('pebble', 'Pebble Buddy', 'A movement companion', null, 5),
  ('riceball', 'Riceball Pal', 'A kitchen companion', null, 6),
  ('button', 'Button Bug', 'A companion for game nights', null, 7),
  ('sticky', 'Sticky Sprite', 'A companion for those who show up', 'Glad you keep showing up.', 8),
  ('pencil', 'Pencil Pup', 'A creative companion', null, 9),
  ('cloudlet', 'Cloudlet', 'A resting companion', null, 10),
  ('keycap', 'Keycap Kitty', 'A companion for focused hours', 'Settled in for the long focus.', 11),
  ('spoolie', 'Spoolie', 'A making companion', null, 12),
  ('tabby', 'Tabby Tab', 'A learning companion', null, 13),
  ('snackling', 'Snackling', 'A companion for steady weeks', null, 14),
  ('patch', 'Patch', 'A companion for trying different things', null, 15),
  ('foundie', 'Foundie', null, 'You were here when this little place became a home.', 16);

insert into public.reward_rules (event_type, label, xp, deskbits, is_active) values
  ('stamp_first_hello', 'Stamp: First Hello', 5, 0, false),
  ('stamp_first_block', 'Stamp: First Block', 5, 0, false),
  ('stamp_first_detour', 'Stamp: First Detour', 5, 0, false),
  ('stamp_first_win', 'Stamp: First Weekly Win', 5, 0, false),
  ('stamp_made_it_mine', 'Stamp: Made It Mine', 5, 0, false);

-- The date each Firsts stamp was first earned, from stored events. Null = not yet.
create function public.buddybook_stamp_facts(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'stamp_first_hello',  (select min(checkin_date) from public.daily_checkins where user_id = p_user),
    'stamp_first_block',  (select min(community_day) from public.focus_blocks
                            where user_id = p_user and status = 'completed'),
    'stamp_first_detour', (select min(community_day) from public.detour_claims where user_id = p_user),
    'stamp_first_win',    (select public.community_day_of(min(created_at)) from public.weekly_goal_claims where user_id = p_user),
    'stamp_made_it_mine', (select public.community_day_of(updated_at) from public.desk_layouts where user_id = p_user)
  );
$$;
revoke all on function public.buddybook_stamp_facts(uuid) from public, anon, authenticated;
grant execute on function public.buddybook_stamp_facts(uuid) to service_role;
