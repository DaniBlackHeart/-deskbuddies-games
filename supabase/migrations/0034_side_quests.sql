-- 0034_side_quests.sql
-- Debbie "Side Quests": a weekly wheel, plus an archive of quests you were dealt but
-- did not finish. Design: claude/Debbie_Side_Quest_Wheel_Draft_v1.md (a PROPOSAL; every
-- amount and rule here is provisional config, and all reward rules start inactive).
--
-- Server-side draw: the browser only animates. The server picks the quest, saves it once
-- per member per week and returns it, so a refresh, retry or second tab cannot change it.
-- The draw never repeats a theme two weeks running and leans toward the themes a member
-- has been dealt least (weighted by theme, so a small theme is not dealt less often).
-- One free re-spin a week, which returns the first quest to the pool. Tapping "I'll do
-- this one" locks it; a quest never locked is treated as locked once its week has passed.
--
-- Doing the locked quest in its week pays (when earning is on) and marks it done. A
-- quest dealt in an earlier week and not done stays in the archive and can be done any
-- time for the stamp only (no XP, no deskbits). A quest never dealt is not in the archive.
-- Completion is a self-report. Nothing a member writes is stored. Photos are not built.
--
-- Rewards (draft numbers, inactive until approved):
--   side_quest_spin  5 XP   first spin of a week (a re-spin pays nothing)  source sqspin:<week>
--   side_quest_done  20 XP + 100 deskbits, in its week only                source sq:<quest_key>

create table public.side_quests (
  key          text primary key,
  name         text not null,
  what_to_do   text not null,
  theme        text not null,
  easier       text not null,
  social       text not null check (social in ('solo', 'either', 'people')),
  photo_awkward boolean not null default false,
  sort         integer not null default 0,
  is_active    boolean not null default true,
  year_added   integer not null default 2026,
  retired_at   timestamptz
);

create table public.side_quest_weeks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  week_start  date not null,
  quest_key   text not null references public.side_quests (key),
  respun      boolean not null default false,
  locked      boolean not null default false,
  spun_at     timestamptz not null default now(),
  locked_at   timestamptz,
  primary key (user_id, week_start)
);

create table public.side_quest_done (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  quest_key  text not null references public.side_quests (key),
  done_on    date not null,
  in_week    boolean not null,
  primary key (user_id, quest_key)
);

alter table public.side_quests      enable row level security;
alter table public.side_quest_weeks enable row level security;
alter table public.side_quest_done  enable row level security;
revoke all on public.side_quests, public.side_quest_weeks, public.side_quest_done from anon, authenticated;
grant select on public.side_quest_weeks, public.side_quest_done to authenticated;
create policy "side_quest_weeks: read own rows" on public.side_quest_weeks for select
  using (user_id = auth.uid() and public.is_verified_member());
create policy "side_quest_done: read own rows" on public.side_quest_done for select
  using (user_id = auth.uid() and public.is_verified_member());

insert into public.side_quests (key, name, what_to_do, theme, easier, social, photo_awkward, sort) values
  ('sq_touch_grass', 'Touch Grass', 'Spend at least 1 hour outside with your phone in a pocket or bag. Feel the ground, grass or breeze.', 'Outside', 'Doorstep, balcony or an open window counts.', 'solo', false, 1),
  ('sq_three_good_things', 'Three Good Things', 'Think of three things that went well today and why each happened. Say it, jot it or just think it.', 'Positivity', 'One good thing is enough on a rough day.', 'solo', false, 2),
  ('sq_kumustahan', 'Kumustahan', 'Message or call someone you haven''t talked to in a while and just ask how they are. No agenda.', 'Connect', 'A voice note or a one-line "thinking of you".', 'people', false, 3),
  ('sq_sweat_a_little', 'Sweat a Little', '20 minutes of movement that gets your heart going: brisk walk, dance, bike, jump rope, swim, stairs.', 'Move', 'Five minutes at a time, seated or at your own pace.', 'solo', false, 4),
  ('sq_taste_something_new', 'Taste Something New', 'Try a food, fruit or drink you''ve never had, from your kitchen, a market or a neighbour.', 'New', 'If you have dietary limits, try a new way to prepare something familiar.', 'solo', false, 5),
  ('sq_thank_you_out_loud', 'Thank-You Out Loud', 'Say thank you to someone in person or by voice call and name the specific thing they did.', 'Gratitude', 'A voice note counts (or even a Desk Stickie if it''s a DB member).', 'people', false, 6),
  ('sq_bayanihan_moment', 'Bayanihan Moment', 'Do one small useful thing for someone without being asked: carry something, lend a hand, share what you have.', 'Community', 'Help someone at home or online.', 'people', false, 7),
  ('sq_sky_check', 'Sky Check', 'Look at the sky for five minutes at sunrise, sunset or night. Notice colors, clouds, stars.', 'Outside', 'From a window.', 'solo', false, 8),
  ('sq_dance_it_out', 'Dance It Out', 'Play one full song and move however you like.', 'Move', 'Seated or hands-only moving counts.', 'solo', false, 9),
  ('sq_curate_your_feed', 'Curate Your Feed', 'Mute, unfollow or leave 5 things that reliably leave you feeling worse. Follow or save 3 that leave you feeling better.', 'Positivity', 'Do 2 and 1.', 'solo', false, 10),
  ('sq_save_a_seat', 'Save a Seat', 'Invite one person to do something with you this week: a walk, a Shared Desk session, a game, merienda.', 'Connect', 'Invite them to something online.', 'people', false, 11),
  ('sq_new_route', 'New Route', 'Take a different route somewhere, or walk a street you''ve never been on, in daylight and somewhere you feel safe.', 'New', 'Sit somewhere different at home and notice what looks different.', 'solo', false, 12),
  ('sq_clean_up_crew', 'Clean-Up Crew', 'Spend 10 minutes picking up litter outside your home or tidying a shared space. Use gloves and a bag; skip anything sharp or unsafe.', 'Community', 'Tidy one shared space indoors, like a common area or a group''s shared folder.', 'either', false, 13),
  ('sq_tambay_time', 'Tambay Time', 'Sit in one outdoor spot for 15 minutes doing nothing. Watch what happens around you.', 'Outside', 'A window seat or doorway.', 'solo', false, 14),
  ('sq_written_salamat', 'Written Salamat', 'Write a short thank-you note, card or message naming something specific, then send or hand it over.', 'Gratitude', 'One sentence is enough.', 'people', false, 15),
  ('sq_good_news_hunt', 'Good News Hunt', 'Find three things going right in your community or the world this week. Tell one person about one of them.', 'Positivity', 'Find just one.', 'either', false, 16),
  ('sq_merienda_walk', 'Merienda Walk', 'Walk 15 minutes to somewhere you''d normally ride or order from: a store, a café, a friend''s place, a food stall.', 'Move', 'Walk a few laps of your home or yard with a snack.', 'solo', false, 17),
  ('sq_beginner_again', 'Beginner Again', 'Spend 20 minutes on something you''re a complete beginner at: origami, a knot, a chord, a few dance steps, a drawing.', 'New', '10 minutes is fine.', 'solo', false, 18),
  ('sq_cook_for_someone', 'Cook for Someone', 'Make a meal or snack for someone else and share it. Simple is fine.', 'Connect', 'Make them a drink, or share a recipe.', 'people', false, 19),
  ('sq_name_that_tree', 'Name That Tree', 'Find three plants, trees or birds near you and learn their names. Ask someone or look them up afterwards.', 'New', 'Houseplants or birds seen from a window.', 'solo', false, 20),
  ('sq_stretch_reset', 'Stretch Reset', '10 minutes of slow stretching, head to toe.', 'Move', 'Three minutes, in a chair.', 'solo', false, 21),
  ('sq_reframe_it', 'Reframe It', 'Pick one thing that annoyed you this week. Find one other way to read it and one thing it taught you. It stays with you; nothing is saved.', 'Positivity', 'Two minutes of thinking is enough.', 'solo', true, 22),
  ('sq_good_neighbors', 'Good Neighbors', 'Greet three people you cross paths with — a neighbour, guard, vendor, driver — with a smile or by name.', 'Community', 'Greet three people in your group chats by name.', 'people', false, 23),
  ('sq_memory_lane', 'Memory Lane', 'Ask a family member or older friend to tell you a story from their life. Listen.', 'Connect', 'A voice note, or ask about the story behind one family recipe.', 'people', false, 24),
  ('sq_screen_free_meal', 'Screen-Free Meal', 'Eat one meal with no screens. Notice taste, texture and who''s at the table.', 'Outside', 'Screen-free for the first five minutes.', 'either', false, 25),
  ('sq_make_a_suki', 'Make a Suki', 'Chat with a small local vendor or shopkeeper and learn their name. Buy something if you''d like to and can; buying is not required.', 'Community', 'Give a kind shout-out to a small business online.', 'people', false, 26),
  ('sq_salamat_jar', 'Salamat Jar', 'Start a jar, notebook or note with 5 small things you''re glad about. Add to it whenever you like.', 'Gratitude', 'Start with 3.', 'solo', false, 27),
  ('sq_plant_something', 'Plant Something', 'Plant a seed, take a cutting, sprout beans on damp tissue, or water and tend a plant that''s already yours.', 'Outside', 'Tending an existing plant counts.', 'solo', false, 28),
  ('sq_try_a_new_move', 'Try a New Move', 'Try a kind of movement you haven''t: yoga, tai chi, zumba, tinikling steps, a martial art, a new sport.', 'Move', 'Follow a 10-minute video at home.', 'either', false, 29),
  ('sq_celebrate_someone_else', 'Celebrate Someone Else', 'Congratulate someone on a recent win, big or small, and be specific about what you admired.', 'Community', 'One message.', 'people', false, 30),
  ('sq_weather_walk', 'Weather Walk', 'Go out in weather you usually skip: light drizzle with an umbrella, or a cool evening. Stay home during storm warnings.', 'Outside', 'Listen to the rain from a window.', 'solo', false, 31),
  ('sq_kindness_to_future_you', 'Kindness to Future You', 'Do one thing now that your future self will thank you for: lay out clothes, clear your desk, fill a water bottle, prep a meal.', 'Positivity', 'One tiny thing.', 'solo', false, 32),
  ('sq_ask_for_help', 'Ask for Help', 'Ask someone for help or advice with something small. Notice how it goes.', 'Connect', 'A text is fine.', 'people', true, 33),
  ('sq_local_treasure', 'Local Treasure', 'Visit a nearby place you''ve walked past but never entered: a plaza, library, market, chapel, park or museum. Daytime, public places only.', 'New', 'Look a place near you up online and learn one fact about it.', 'solo', false, 34),
  ('sq_move_with_others', 'Move With Others', 'Do any movement with at least one other person: a walk, badminton, basketball, zumba, stretching on a call.', 'Move', 'A video-call stretch.', 'people', false, 35),
  ('sq_give_something_away', 'Give Something Away', 'Pass on something you no longer need to someone who''ll use it.', 'Community', 'Offer to lend something instead.', 'people', false, 36),
  ('sq_savor_it', 'Savor It', 'Take five slow minutes with one good thing — a warm drink, a shower, a breeze — and notice it fully.', 'Gratitude', 'Two minutes.', 'solo', false, 37),
  ('sq_wind_down_night', 'Wind-Down Night', 'Screens off 30 minutes before bed for one night. Stretch, read, breathe or just sit.', 'Move', '15 minutes.', 'solo', true, 38),
  ('sq_pen_paper', 'Pen & Paper', 'Write or draw by hand for 10 minutes. No audience.', 'New', 'Doodle one shape.', 'solo', false, 39),
  ('sq_read_outside', 'Read Outside', 'Read anything you enjoy — a book, an e-reader, a comic — outdoors for 20 minutes.', 'Outside', 'Beside an open window.', 'solo', false, 40),
  ('sq_talk_to_yourself_like_a_friend', 'Talk to Yourself Like a Friend', 'Pick something you''re hard on yourself about. Say or write what you''d tell a friend in the same spot.', 'Positivity', 'One kind sentence.', 'solo', true, 41),
  ('sq_share_a_skill', 'Share a Skill', 'Spend 15 minutes helping someone with something you''re good at: feedback, a how-to, a tip, a quick lesson.', 'Community', 'Offer one tip.', 'people', false, 42),
  ('sq_ask_a_better_question', 'Ask a Better Question', 'Ask someone a question deeper than "kumusta", such as what they''re looking forward to, then listen for 10 minutes without trying to fix anything.', 'Connect', 'Do it by text.', 'people', false, 43),
  ('sq_first_light', 'First Light', 'Be outside, or at an open window, for the first ten minutes of daylight.', 'Outside', 'Face a window and watch the light change.', 'solo', false, 44),
  ('sq_gratitude_walk', 'Gratitude Walk', 'Walk 15 minutes and quietly thank ten things you pass, big or small.', 'Gratitude', 'Do it from a window or while seated.', 'solo', false, 45),
  ('sq_good_news_tell_me', 'Good News, Tell Me', 'Share something good that happened to you this week with someone who''ll be glad for you.', 'Positivity', 'Write it down for yourself.', 'either', false, 46),
  ('sq_old_hobby_new_day', 'Old Hobby, New Day', 'Go back to a hobby or craft you dropped, for 20 minutes.', 'New', '10 minutes, or pick a different one.', 'solo', false, 47),
  ('sq_unplugged_hour', 'Unplugged Hour', 'One hour with your phone away, unless you need it for work, safety or health. Do anything else.', 'Outside', '30 minutes.', 'solo', true, 48),
  ('sq_learn_a_word', 'Learn a Word', 'Learn five words in a language or regional dialect you don''t speak, and use one with someone.', 'New', 'Learn two.', 'either', false, 49),
  ('sq_thank_your_body', 'Thank Your Body', 'Name three things your body did for you today, then do one kind thing for it: rest, water, a stretch, a warm bath. Focus on what it does, not how it looks.', 'Gratitude', 'Name one thing.', 'solo', true, 50),
  ('sq_pass_the_good_vibes', 'Pass the Good Vibes', 'Leave an encouraging message for a community member you haven''t talked to much.', 'Community', 'A short message.', 'people', false, 51),
  ('sq_look_back_look_forward', 'Look Back, Look Forward', 'Pick three moments from your year and one thing you want to try next.', 'Gratitude', 'One moment.', 'solo', false, 52),
  ('sq_solo_caf_date', 'Solo Café Date', 'Take yourself out for a drink or snack somewhere you like. Sit for 30 minutes with no work and your phone away, or only for music.', 'New', 'Set up a café at home: a nice cup, a snack, a window seat.', 'solo', false, 53),
  ('sq_solo_picnic', 'Solo Picnic', 'Pack a snack and eat it outdoors by yourself for 30 minutes: a park, a rooftop, a yard or a doorstep.', 'Outside', 'Spread a blanket by a window or on the living-room floor.', 'solo', false, 54),
  ('sq_bookshop_library_wander', 'Bookshop & Library Wander', 'Browse the shelves for 30 minutes. Pick up three books you''d never normally choose and read the first page of one.', 'New', 'Browse a library''s online catalog or your own shelf with the same rule.', 'solo', false, 55),
  ('sq_viewpoint_date', 'Viewpoint Date', 'Go alone to a spot with a good view — a seawall, hill, rooftop or open field — and sit until you''ve really looked. Daytime, somewhere you feel safe.', 'Outside', 'Pick the best view from your own home and sit there for 15 minutes.', 'solo', false, 56),
  ('sq_treat_yourself_night_in', 'Treat-Yourself Night In', 'Set up a cozy night for one: a warm shower, a favorite snack, soft light, nothing you have to do.', 'Positivity', 'One cozy thing, like a warm drink and a lamp.', 'solo', false, 57),
  ('sq_dinner_for_one', 'Dinner for One', 'Cook or plate a meal just for you. Set the table, sit down and eat it slowly.', 'Gratitude', 'Make a drink or a snack and serve it properly.', 'solo', false, 58),
  ('sq_soundtrack_walk', 'Soundtrack Walk', 'Make a 20-minute playlist of songs that lift you and walk to it by yourself.', 'Move', 'Walk laps at home, or sit and sway along.', 'solo', false, 59),
  ('sq_just_play', 'Just Play', 'Spend 20 minutes doing something purely for fun with no goal: a puzzle, a toy, a doodle, a game, time with a pet.', 'New', 'Ten minutes.', 'solo', false, 60);

insert into public.reward_rules (event_type, label, xp, deskbits, is_active) values
  ('side_quest_spin', 'Tried the Side Quest wheel', 5, 0, false),
  ('side_quest_done', 'Finished a Side Quest', 20, 100, false);

-- Weighted theme draw. Returns null when no quest is left to deal.
create function public.sq_draw(p_user uuid, p_week date, p_exclude text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  last_theme text;
  th text[];
  ws numeric[];
  i integer;
  total numeric := 0;
  r numeric;
  pick text;
  chosen text;
  has_other boolean;
begin
  select q.theme into last_theme
    from public.side_quest_weeks w join public.side_quests q on q.key = w.quest_key
   where w.user_id = p_user and w.week_start = p_week - 7;

  -- Themes that still have a quest to deal, each weighted by how rarely it has been dealt.
  select array_agg(e.theme order by e.theme),
         array_agg(1.0 / (1 + coalesce(s.seen, 0)) order by e.theme)
    into th, ws
    from (select distinct q.theme from public.side_quests q
           where q.is_active and q.retired_at is null
             and q.key <> all (coalesce(p_exclude, '{}'))
             and not exists (select 1 from public.side_quest_done d where d.user_id = p_user and d.quest_key = q.key)) e
    left join (select q.theme, count(*) as seen
                 from public.side_quest_weeks w join public.side_quests q on q.key = w.quest_key
                where w.user_id = p_user and (w.locked or w.week_start < p_week)
                group by q.theme) s on s.theme = e.theme;
  if th is null then return null; end if;

  -- Never the same theme two weeks running, unless it is the only theme left.
  has_other := exists (select 1 from unnest(th) x where x is distinct from last_theme);
  for i in 1 .. array_length(th, 1) loop
    if has_other and th[i] is not distinct from last_theme then ws[i] := 0; end if;
    total := total + ws[i];
  end loop;
  if total = 0 then return null; end if;

  r := random() * total;
  for i in 1 .. array_length(th, 1) loop
    if ws[i] > 0 then
      pick := th[i];
      r := r - ws[i];
      exit when r <= 0;
    end if;
  end loop;

  select q.key into chosen
    from public.side_quests q
   where q.theme = pick and q.is_active and q.retired_at is null
     and q.key <> all (coalesce(p_exclude, '{}'))
     and not exists (select 1 from public.side_quest_done d where d.user_id = p_user and d.quest_key = q.key)
   order by random()
   limit 1;
  return chosen;
end;
$$;

-- Spin: one draw per member per week, repeatable without changing the result.
create function public.sq_spin(p_user uuid, p_week date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare k text;
begin
  perform pg_advisory_xact_lock(hashtext('sq:' || p_user::text || p_week::text));
  select quest_key into k from public.side_quest_weeks where user_id = p_user and week_start = p_week;
  if k is not null then return k; end if;
  k := public.sq_draw(p_user, p_week, null);
  if k is null then return null; end if;
  insert into public.side_quest_weeks (user_id, week_start, quest_key) values (p_user, p_week, k);
  return k;
end;
$$;

-- One free re-spin a week, only before locking. Returns the quest now dealt.
create function public.sq_respin(p_user uuid, p_week date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare w public.side_quest_weeks; k text;
begin
  perform pg_advisory_xact_lock(hashtext('sq:' || p_user::text || p_week::text));
  select * into w from public.side_quest_weeks where user_id = p_user and week_start = p_week;
  if not found then return null; end if;
  if w.locked or w.respun then return w.quest_key; end if;
  k := public.sq_draw(p_user, p_week, array[w.quest_key]);
  if k is null then return w.quest_key; end if;
  update public.side_quest_weeks set quest_key = k, respun = true
   where user_id = p_user and week_start = p_week;
  return k;
end;
$$;

create function public.sq_lock(p_user uuid, p_week date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('sq:' || p_user::text || p_week::text));
  update public.side_quest_weeks set locked = true, locked_at = coalesce(locked_at, now())
   where user_id = p_user and week_start = p_week;
  return found;
end;
$$;

-- Mark a quest done. Allowed for this week's locked quest, or any earlier-dealt quest
-- not yet done (the archive). Returns 'done_in_week', 'done_archive', 'already' or
-- 'not_available'.
create function public.sq_done(p_user uuid, p_quest text, p_today date, p_week date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare in_week boolean; n integer;
begin
  perform pg_advisory_xact_lock(hashtext('sqd:' || p_user::text));
  if exists (select 1 from public.side_quest_done where user_id = p_user and quest_key = p_quest) then
    return 'already';
  end if;
  if exists (select 1 from public.side_quest_weeks
              where user_id = p_user and week_start = p_week and quest_key = p_quest and locked) then
    in_week := true;
  elsif exists (select 1 from public.side_quest_weeks
                 where user_id = p_user and week_start < p_week and quest_key = p_quest) then
    in_week := false;
  else
    return 'not_available';
  end if;
  insert into public.side_quest_done (user_id, quest_key, done_on, in_week)
  values (p_user, p_quest, p_today, in_week)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 'already'; end if;
  return case when in_week then 'done_in_week' else 'done_archive' end;
end;
$$;

revoke all on function public.sq_draw(uuid, date, text[]), public.sq_spin(uuid, date), public.sq_respin(uuid, date),
  public.sq_lock(uuid, date), public.sq_done(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.sq_draw(uuid, date, text[]), public.sq_spin(uuid, date), public.sq_respin(uuid, date),
  public.sq_lock(uuid, date), public.sq_done(uuid, text, date, date) to service_role;
