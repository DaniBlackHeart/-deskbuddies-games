-- Debbie — My Desk: saved desk layouts and the items members own.
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Security model (same pattern as daily_checkins / member_progress):
--   - Members can READ only their own rows.
--   - Nobody can write from the browser: there is no write policy. Layouts
--     are saved only by the desk-save Edge Function (service role), which
--     checks every item against what the member actually owns and refuses
--     the whole save if any item isn't theirs.
--   - member_items is written only by server-side code (future milestone /
--     Challenge / shop grants). Nothing grants items yet, so for now only
--     starter and free items can be placed.
--
-- item_key is "<slot>:<item id>", e.g. "companion:paper". Starter and free
-- items are NOT stored here; they are defined in the shared catalog.
-- Deliberately NOT included: prices, deskbit spending, XP. Placing an item
-- never costs anything.

create table public.member_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_key text not null,
  source text not null default 'grant',
  granted_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table public.desk_layouts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.member_items enable row level security;
alter table public.desk_layouts enable row level security;

create policy "member_items: read own rows"
  on public.member_items for select
  using (user_id = auth.uid() and public.is_verified_member());

create policy "desk_layouts: read own row"
  on public.desk_layouts for select
  using (user_id = auth.uid() and public.is_verified_member());

-- For testing only (do NOT leave in a migration): give yourself a buddy.
--   insert into public.member_items (user_id, item_key, source)
--   values ('<your profiles.id>', 'companion:paper', 'manual test');
