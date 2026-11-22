-- 0036: Keep the Desk Lit (support page).
-- See claude/Debbie_Keep_the_Desk_Lit_and_Thank-You_Board_Draft_v0.md. Almost everything about
-- real-money support is still undecided (amounts, provider, QR, who checks, cosmetics), so this
-- migration holds only what the page needs to READ, and every figure starts empty. Nothing here
-- takes payment, records a payment or touches XP, deskbits or access.
--
-- Set from the Supabase SQL editor (no admin screen yet):
--   support_settings.status_state   'empty' | 'early' | 'funded' | 'shortfall'   (null = not shared)
--   support_settings.show_amounts   true only if Rika decides amounts are public
--   support_settings.how_to_give / give_url   how a member can give, once decided
--   support_costs.status / covered_pct / covered_amount / total_amount   per category

create table public.support_settings (
  id            boolean primary key default true check (id),
  status_state  text check (status_state in ('empty', 'early', 'funded', 'shortfall')),
  show_amounts  boolean not null default false,
  how_to_give   text check (how_to_give is null or char_length(how_to_give) <= 600),
  give_url      text check (give_url is null or give_url ~ '^https://'),
  updated_at    timestamptz not null default now()
);
insert into public.support_settings (id) values (true);

create table public.support_costs (
  key             text primary key,
  sort            integer not null,
  label           text not null,
  pays_for        text not null,
  status          text check (status in ('not_yet', 'partly', 'covered')),
  covered_pct     integer check (covered_pct between 0 and 100),
  covered_amount  integer check (covered_amount >= 0),
  total_amount    integer check (total_amount > 0)
);

-- The three categories and what each pays for are decided (draft R3). The status stays empty.
insert into public.support_costs (key, sort, label, pays_for) values
  ('running', 1, 'Running costs', 'Hosting, the database and backups, the Discord bot, and the tools Debbie uses.'),
  ('maintenance', 2, 'Maintenance and development', 'Fixing things, building new features, and pay for the people who look after Debbie and the community.'),
  ('events', 3, 'Events', 'Game nights and community activities.');

alter table public.support_settings enable row level security;
alter table public.support_costs enable row level security;
revoke all on public.support_settings, public.support_costs from anon, authenticated;
grant select on public.support_settings, public.support_costs to authenticated;
create policy "support_settings: members read" on public.support_settings for select
  using (public.is_verified_member());
create policy "support_costs: members read" on public.support_costs for select
  using (public.is_verified_member());
