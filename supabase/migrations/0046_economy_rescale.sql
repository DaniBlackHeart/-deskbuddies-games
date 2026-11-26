-- DeskBuddies Games — economy rescale (deskbits payouts and Desk Finds prices)
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Source: Debbie_Economy_Rescale_Proposal_2026-11-24.md, APPROVED by Rika on
-- 24 Nov 2026 (relayed by Dani). All numbers are still provisional config and
-- get revisited after real earning data.
--
-- What this does:
--   1. reward_rules.deskbits goes up by a flat 25x on every rule that pays
--      deskbits (proposal section 3, including the streak milestones
--      20 / 60 / 150 -> 500 / 1,500 / 3,750). The same 25x is applied to the
--      other deskbits rules that were seeded after the proposal's table
--      (the other Keepsake steps, Daily Detour, Side Quest done), because the
--      proposal says "one multiplier of 25 on every deskbits payout".
--   2. shop_items.price moves to the new ladder (proposal sections 4 and 5).
--
-- What this does NOT touch:
--   - XP, caps (cap_group / daily_cap_count) and the 200 XP daily ceiling.
--   - Rules that pay 0 deskbits (desk break, practice, finished-a-game,
--     finished-the-puzzle, stamps, shop_purchase).
--   - reward_ledger rows already paid: they keep their old amounts.
--   - Items members already own: spend_deskbits() charged the price at the
--     time of purchase and ownership never depends on price.
--   - is_active flags and earning_settings.shop_enabled. The shop stays
--     exactly as it is now (the proposal says to hold the switch until about
--     12 Cozy + Statement items exist).
--
-- Correction to the proposal's section 8: it says "no shop table exists yet".
-- shop_items does exist (0032, 20 launch items), so it is repriced here.
--
-- Values are written as absolute numbers, not "deskbits * 25", so running this
-- twice cannot compound. The reward_rules_touch trigger (0028) bumps each
-- rule's version automatically when its deskbits value changes.

begin;

-- 1. Earning rules ------------------------------------------------------------
with new_values (event_type, deskbits) as (
  values
    -- proposal section 3
    ('daily_checkin',            125),
    ('focus_block_complete',     250),
    ('puzzle_solved',            250),
    ('game_win_bonus',           250),
    ('event_checkin',            375),
    ('self_log',                  75),
    ('weekly_win',               500),
    -- other deskbits rules, same 25x
    ('daily_detour',              25),
    ('side_quest_done',         2500),
    -- Keepsake steps (streak = proposal's 500 / 1,500 / 3,750)
    ('keep_streak_bronze',       500),
    ('keep_streak_silver',      1500),
    ('keep_streak_gold',        3750),
    ('keep_seat_bronze',         250),
    ('keep_seat_silver',         750),
    ('keep_seat_gold',          2000),
    ('keep_seasons_bronze',      250),
    ('keep_seasons_silver',      750),
    ('keep_seasons_gold',       1500),
    ('keep_welcome_back_bronze', 250),
    ('keep_focus_bronze',        500),
    ('keep_focus_silver',       1500),
    ('keep_focus_gold',         2250),
    ('keep_long_haul_bronze',    375),
    ('keep_long_haul_silver',   1000),
    ('keep_long_haul_gold',     2000),
    ('keep_detour_bronze',       375),
    ('keep_detour_silver',      1250),
    ('keep_detour_gold',        2000),
    ('keep_many_detours_bronze', 375),
    ('keep_many_detours_silver',1000),
    ('keep_many_detours_gold',  2000),
    ('keep_wins_bronze',        1250),
    ('keep_wins_silver',        1750),
    ('keep_wins_gold',          2500),
    ('keep_full_week_bronze',    625),
    ('keep_full_week_silver',   1250),
    ('keep_full_week_gold',     2250)
),
updated as (
  update public.reward_rules r
     set deskbits = n.deskbits
    from new_values n
   where r.event_type = n.event_type
  returning r.event_type
)
select count(*) as rules_updated from updated;

-- Fail loudly (and roll back) if a rule is missing, instead of half-rescaling.
do $$
declare
  v_missing text;
begin
  select string_agg(e, ', ') into v_missing
    from unnest(array[
      'daily_checkin','focus_block_complete','puzzle_solved','game_win_bonus',
      'event_checkin','self_log','weekly_win','daily_detour','side_quest_done',
      'keep_streak_bronze','keep_streak_gold'
    ]) e
   where not exists (select 1 from public.reward_rules r where r.event_type = e);
  if v_missing is not null then
    raise exception 'economy rescale: reward_rules is missing: %', v_missing;
  end if;
end $$;

-- 2. Desk Finds prices (proposal sections 4 and 5) -----------------------------
with new_prices (key, price) as (
  values
    ('sticky_note_stack',          600),
    ('pen_cup',                    800),
    ('coaster_set',                800),
    ('snack_tin',                  900),
    ('desk_edge_trim',             900),
    ('mini_cactus',               1000),
    ('warm_lamp_shade',           2250),
    ('tea_mug_with_steam',        2500),
    ('fern_pot',                  3000),
    ('keyboard_colourway',        3250),
    ('cozy_desk_mat',             3750),
    ('floating_shelf_with_books', 6500),
    ('window_plant_stand',        8000),
    ('corner_reading_chair',      9500),
    ('mini_aquarium',            19000),
    ('record_player',            21000),
    ('tiny_scarf',                1200),
    ('party_hat',                 1400),
    ('reading_glasses',           2250),
    ('tiny_backpack',             2750)
),
repriced as (
  update public.shop_items s
     set price = p.price
    from new_prices p
   where s.key = p.key
  returning s.key
)
select count(*) as items_repriced from repriced;

commit;

-- Quick check after running (expect 37 rules with deskbits > 0, 20 shop items):
--   select count(*) from public.reward_rules where deskbits > 0;
--   select key, tier, price from public.shop_items order by sort;
--   select event_type, deskbits, version from public.reward_rules
--    where event_type in ('daily_checkin','focus_block_complete','weekly_win');
