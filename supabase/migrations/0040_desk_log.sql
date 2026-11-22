-- 0040_desk_log: the Desk Log, a routine record of what happens around the desks.
--
-- Nothing new is stored. Every line is built, when asked, from rows that already exist and that
-- are already unique per real action (daily_checkins, focus_blocks, keepsake_earned,
-- event_checkins, weekly_goal_claims, detour_claims). So a retry or a duplicate event can never
-- create a second line, and a correction is a new row, never a rewrite of history.
--
-- Two scopes, one function, called only by the desk-log Edge Function (service role):
--   'around'  other members' lines of member-visible kinds only (check-in, focus, achievement,
--             event check-in). No amounts, no private categories, no text a member typed.
--   'mine'    the member's own lines, with the reward each one paid (from reward_ledger, own
--             rows only) and who can see it. Self-logged detours appear here only.
-- The browser never queries other members' tables, and the function takes the viewer's id from
-- the verified session, so a member can never ask for another member's rewards.
--
-- Wording is fixed here and uses generic phrases only: no focus goal, activity type, journal,
-- book, habit or note ever reaches a line. A focus block shows its length to its owner only.
-- Last 7 days, newest first, at most 200 lines.

create or replace function public.desk_log(p_user_id uuid, p_scope text)
returns table (
  entry_key   text,
  kind        text,      -- check-in | focus | achievement | activity
  at          timestamptz,
  user_id     uuid,
  username    text,
  avatar_url  text,
  line        text,
  xp          integer,   -- 'mine' only, else null
  deskbits    integer,   -- 'mine' only, else null
  visibility  text       -- 'members' | 'only_you' ('mine' only, else null)
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := now() - interval '7 days';
begin
  if p_scope not in ('around', 'mine') then
    raise exception 'unknown scope';
  end if;

  return query
  with ev as (
    -- Check-ins
    select 'checkin:' || c.checkin_date::text as ekey, 'check-in'::text as k, c.created_at as t,
           c.user_id as uid, 'pulled up a chair.'::text as l, 'members'::text as vis
      from daily_checkins c
     where c.created_at >= since
    union all
    -- Finished focus blocks (length is shown to the owner only)
    select 'focus:' || f.id::text, 'focus', f.ended_at, f.user_id,
           case when p_scope = 'mine'
                then 'finished a ' || f.minutes::text || '-minute focus block.'
                else 'finished a focus block.' end,
           'members'
      from focus_blocks f
     where f.status = 'completed' and f.ended_at is not null and f.ended_at >= since
    union all
    -- Keepsakes
    select 'milestone:' || e.step_key, 'achievement', e.earned_at, e.user_id,
           'earned a Keepsake: ' || kc.name || ', ' || ks.tier || '.', 'members'
      from keepsake_earned e
      join keepsake_steps ks on ks.step_key = e.step_key
      join keepsake_cards kc on kc.key = ks.card_key
     where e.earned_at >= since
    union all
    -- Weekly Wins (the goal itself is not named)
    select 'weekly:' || w.week_start::text || ':' || w.goal_key, 'achievement', w.created_at, w.user_id,
           'completed a Weekly Win.', 'members'
      from weekly_goal_claims w
     where w.created_at >= since
    union all
    -- Event check-ins (the event's title is already public on the calendar)
    select 'event:' || ec.event_id::text, 'activity', ec.created_at, ec.user_id,
           'checked in to ' || ce.title || '.', 'members'
      from event_checkins ec
      join calendar_events ce on ce.id = ec.event_id
     where ec.created_at >= since
    union all
    -- Self-logged detours: the member's own log only, never the title or the prompt
    select 'detour:' || d.community_day::text || ':' || d.prompt_key, 'activity', d.created_at, d.user_id,
           'logged time away from the screen.', 'only_you'
      from detour_claims d
     where p_scope = 'mine' and d.created_at >= since
  )
  select ev.ekey,
         ev.k,
         ev.t,
         ev.uid,
         pr.username,
         pr.avatar_url,
         ev.l,
         case when p_scope = 'mine' then coalesce(rl.xp_delta, 0) end,
         case when p_scope = 'mine' then coalesce(rl.deskbits_delta, 0) end,
         case when p_scope = 'mine' then ev.vis end
    from ev
    join profiles pr on pr.id = ev.uid
    left join reward_ledger rl
           on p_scope = 'mine' and rl.user_id = ev.uid and rl.source_key = ev.ekey and rl.payout = 'paid'
   where case when p_scope = 'mine'
              then ev.uid = p_user_id
              else ev.uid <> p_user_id and ev.vis = 'members' and pr.is_member
         end
   order by ev.t desc
   limit 200;
end;
$$;

revoke all on function public.desk_log(uuid, text) from public, anon, authenticated;
