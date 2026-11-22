-- 0032_desk_finds.sql
-- Debbie "Desk Finds": the deskbits shop.
--
-- Design: claude/Debbie_Desk_Finds_Draft_v0.md (v0, with Rika's six answers of
-- 21 Nov 2026) and the "Debbie Desk Finds" design canvas.
--
-- Security model (same as the rest of the earning system):
--   - The price lives here, in shop_items. The browser never sends a price.
--   - spend_deskbits() is the ONLY way to buy. One transaction: lock the
--     member's progress row, check the shop is open, check the item is for sale,
--     check it is not already owned, check the balance, write a negative-deskbits
--     ledger row (xp_delta stays 0, so spending can never touch XP), insert the
--     item into member_items. Only the service role can call it.
--   - source_key = shop:<item_key> with the ledger's unique (user_id, source_key),
--     so a double click or two tabs cannot buy the same item twice.
--   - Spending never changes XP, level or access. Owned items stay owned if an
--     item is later switched off or repriced.
--
-- The shop is OFF until you switch it on:
--     update public.earning_settings set shop_enabled = true;
-- Earning carries on either way. Prices are the draft's provisional config.
-- Owned items are stored as member_items rows keyed  find:<item_key>.
--
-- Not in this migration on purpose: Little Gifts, shop buddies, extra desk
-- surfaces, avatar clothing (all still open in the draft).

alter table public.earning_settings
  add column shop_enabled boolean not null default false;

create table public.shop_items (
  key        text primary key,
  category   text not null check (category in ('accessories', 'comfort', 'furniture', 'showpieces', 'wardrobe')),
  name       text not null,
  tier       text not null check (tier in ('small', 'cozy', 'statement', 'showpiece')),
  price      integer not null check (price > 0),
  is_style   boolean not null default false,   -- a look applied to the desk, takes no decor slot
  note       text,
  sort       integer not null default 0,
  is_active  boolean not null default true,    -- off = gone from the shop, still owned and usable
  created_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;
revoke all on public.shop_items from anon, authenticated;   -- service role only

insert into public.shop_items (key, category, name, tier, price, is_style, note, sort) values
  ('sticky_note_stack', 'accessories', 'Sticky-note stack', 'small', 30, false, null, 1),
  ('pen_cup', 'accessories', 'Pen cup', 'small', 40, false, null, 2),
  ('coaster_set', 'accessories', 'Coaster set', 'small', 40, false, null, 3),
  ('snack_tin', 'accessories', 'Snack tin', 'small', 45, false, 'Ties to Desk Breaks.', 4),
  ('desk_edge_trim', 'accessories', 'Desk edge trim', 'small', 45, true, 'A look for your desk. It takes no decor slot.', 5),
  ('mini_cactus', 'accessories', 'Mini cactus', 'small', 50, false, null, 6),
  ('warm_lamp_shade', 'comfort', 'Warm lamp shade', 'cozy', 90, false, null, 7),
  ('tea_mug_with_steam', 'comfort', 'Tea mug with steam', 'cozy', 100, false, null, 8),
  ('fern_pot', 'comfort', 'Fern pot', 'cozy', 120, false, null, 9),
  ('keyboard_colourway', 'comfort', 'Keyboard colourway', 'cozy', 130, true, 'A look for your desk, in sage, rose or dusk. It takes no decor slot.', 10),
  ('cozy_desk_mat', 'comfort', 'Cozy desk mat', 'cozy', 150, true, 'A look for your desk. It takes no decor slot.', 11),
  ('floating_shelf_with_books', 'furniture', 'Floating shelf with books', 'statement', 220, false, 'Decor only. Trophies go on the Brag Shelf.', 12),
  ('window_plant_stand', 'furniture', 'Window plant stand', 'statement', 260, false, null, 13),
  ('corner_reading_chair', 'furniture', 'Corner reading chair', 'statement', 320, false, null, 14),
  ('mini_aquarium', 'showpieces', 'Mini aquarium', 'showpiece', 480, false, null, 15),
  ('record_player', 'showpieces', 'Record player', 'showpiece', 520, false, null, 16),
  ('tiny_scarf', 'wardrobe', 'Tiny scarf', 'small', 60, false, null, 17),
  ('party_hat', 'wardrobe', 'Party hat', 'small', 70, false, null, 18),
  ('reading_glasses', 'wardrobe', 'Reading glasses', 'cozy', 90, false, null, 19),
  ('tiny_backpack', 'wardrobe', 'Tiny backpack', 'cozy', 110, false, null, 20);

-- Ledger needs a rule row for the event type. It stays inactive so grant_reward()
-- can never pay it out; only spend_deskbits() writes these rows.
insert into public.reward_rules (event_type, label, xp, deskbits, is_active)
values ('shop_purchase', 'Bought something in Desk Finds', 0, 0, false);

create function public.spend_deskbits(p_user_id uuid, p_item_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_member boolean;
  v_open      boolean;
  v_item      public.shop_items;
  v_balance   bigint;
  v_rule      public.reward_rules;
begin
  select is_member into v_is_member from public.profiles where id = p_user_id;
  if v_is_member is distinct from true then
    return jsonb_build_object('status', 'not_member');
  end if;

  select shop_enabled into v_open from public.earning_settings where id;
  if not coalesce(v_open, false) then
    return jsonb_build_object('status', 'shop_closed');
  end if;

  select * into v_item from public.shop_items where key = p_item_key and is_active;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Serialize this member's spending (same lock grant_reward uses).
  insert into public.member_progress (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select deskbits_balance into v_balance from public.member_progress where user_id = p_user_id for update;

  if exists (select 1 from public.member_items where user_id = p_user_id and item_key = 'find:' || v_item.key) then
    return jsonb_build_object('status', 'already_owned', 'price', v_item.price, 'balance', v_balance);
  end if;

  if v_balance < v_item.price then
    return jsonb_build_object('status', 'insufficient', 'price', v_item.price, 'balance', v_balance);
  end if;

  select * into v_rule from public.reward_rules where event_type = 'shop_purchase';

  insert into public.reward_ledger
    (user_id, event_type, source_key, xp_delta, deskbits_delta, payout,
     cap_group, community_day, rule_version, meta)
  values
    (p_user_id, 'shop_purchase', 'shop:' || v_item.key, 0, -v_item.price, 'paid',
     null, public.community_today(), v_rule.version,
     jsonb_build_object('item', v_item.key, 'price', v_item.price));

  update public.member_progress
     set deskbits_balance = deskbits_balance - v_item.price, updated_at = now()
   where user_id = p_user_id;

  insert into public.member_items (user_id, item_key, source)
  values (p_user_id, 'find:' || v_item.key, 'shop');

  return jsonb_build_object('status', 'purchased', 'price', v_item.price, 'balance', v_balance - v_item.price);
end;
$$;

revoke all on function public.spend_deskbits(uuid, text) from public, anon, authenticated;
grant execute on function public.spend_deskbits(uuid, text) to service_role;
