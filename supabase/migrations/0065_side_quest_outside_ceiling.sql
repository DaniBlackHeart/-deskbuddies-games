-- 0065_side_quest_outside_ceiling.sql
-- Side Quest payouts sit OUTSIDE the daily XP ceiling (decided 21 Nov, see
-- claude/Debbie_Side_Quest_Wheel_Draft_v1.md section 2). Until now grant_reward applied the
-- 200 XP ceiling to every event, so a member who had already reached 200 XP that day and
-- then finished their quest got a "capped_daily" row worth nothing, and that row blocks a
-- later retry (one ledger row per source_key). This adds a per-rule flag and teaches
-- grant_reward to honour it.
--
-- Behaviour for rules with ceiling_exempt = true:
--   * the grant is never clipped or zeroed by the daily ceiling;
--   * its XP does not use up room for other events that day (it is left out of the
--     day's total). Per-type caps (cap_group) still apply, though the side-quest rules have none.
-- Every other rule behaves exactly as before. Nothing pays until earning_enabled is on.
--
-- The flag is read from reward_rules at the time of the sum, not snapshotted on the ledger.
-- Flipping it later would change how past days count toward the ceiling only for that rule's rows.

alter table public.reward_rules
  add column if not exists ceiling_exempt boolean not null default false;

update public.reward_rules
   set ceiling_exempt = true
 where event_type in ('side_quest_spin', 'side_quest_done');

create or replace function public.grant_reward(
  p_user_id    uuid,
  p_event_type text,
  p_source_key text,
  p_meta       jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings       public.earning_settings;
  v_rule           public.reward_rules;
  v_existing       public.reward_ledger;
  v_is_member      boolean;
  v_today          date;
  v_paid_in_group  integer;
  v_xp_today       bigint;
  v_room           bigint;
  v_xp             integer;
  v_deskbits       integer;
  v_payout         text := 'paid';
begin
  if p_source_key is null or char_length(p_source_key) < 1 or char_length(p_source_key) > 200 then
    raise exception 'grant_reward: invalid source_key';
  end if;

  select * into v_settings from public.earning_settings where id;
  if not v_settings.earning_enabled then
    return jsonb_build_object('status', 'disabled', 'xp', 0, 'deskbits', 0);
  end if;

  select * into v_rule from public.reward_rules
   where event_type = p_event_type and is_active;
  if not found then
    return jsonb_build_object('status', 'no_rule', 'xp', 0, 'deskbits', 0);
  end if;

  select is_member into v_is_member from public.profiles where id = p_user_id;
  if v_is_member is distinct from true then
    return jsonb_build_object('status', 'not_member', 'xp', 0, 'deskbits', 0);
  end if;

  -- Serialize every grant for this member, so caps hold under parallel requests.
  insert into public.member_progress (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  perform 1 from public.member_progress where user_id = p_user_id for update;

  -- Same real action twice (retry, refresh, double click): no second payout.
  select * into v_existing from public.reward_ledger
   where user_id = p_user_id and source_key = p_source_key;
  if found then
    return jsonb_build_object('status', 'duplicate',
                              'xp', v_existing.xp_delta,
                              'deskbits', v_existing.deskbits_delta);
  end if;

  v_today    := public.community_today();
  v_xp       := v_rule.xp;
  v_deskbits := v_rule.deskbits;

  -- Per-type daily cap: paid grants in this cap group today.
  if v_rule.cap_group is not null then
    select count(*) into v_paid_in_group from public.reward_ledger
     where user_id = p_user_id and community_day = v_today
       and cap_group = v_rule.cap_group and payout = 'paid';
    if v_paid_in_group >= v_rule.daily_cap_count then
      v_xp := 0; v_deskbits := 0; v_payout := 'capped_type';
    end if;
  end if;

  -- Overall daily XP ceiling. XP is clipped to the room left; with no room left
  -- the grant pays nothing (XP and deskbits). Activity is still recorded.
  -- Rules marked ceiling_exempt skip this, and their XP is not counted in the day's total.
  if v_payout = 'paid' and v_xp > 0 and not v_rule.ceiling_exempt then
    select coalesce(sum(l.xp_delta), 0) into v_xp_today
      from public.reward_ledger l
      join public.reward_rules r on r.event_type = l.event_type
     where l.user_id = p_user_id and l.community_day = v_today
       and l.payout = 'paid' and not r.ceiling_exempt;
    v_room := greatest(v_settings.daily_xp_ceiling - v_xp_today, 0);
    if v_room = 0 then
      v_xp := 0; v_deskbits := 0; v_payout := 'capped_daily';
    elsif v_xp > v_room then
      v_xp := v_room;
    end if;
  end if;

  insert into public.reward_ledger
    (user_id, event_type, source_key, xp_delta, deskbits_delta, payout,
     cap_group, community_day, rule_version, meta)
  values
    (p_user_id, p_event_type, p_source_key, v_xp, v_deskbits, v_payout,
     v_rule.cap_group, v_today, v_rule.version, coalesce(p_meta, '{}'::jsonb));

  update public.member_progress
     set xp_total         = xp_total + v_xp,
         deskbits_balance = deskbits_balance + v_deskbits,
         updated_at       = now()
   where user_id = p_user_id;

  return jsonb_build_object(
    'status',   case when v_payout = 'paid' then 'granted' else 'capped' end,
    'xp',       v_xp,
    'deskbits', v_deskbits,
    'payout',   v_payout
  );
end;
$$;

revoke all on function public.grant_reward(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.grant_reward(uuid, text, text, jsonb) to service_role;
