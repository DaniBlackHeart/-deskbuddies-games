-- 0041_member_avatars: each member's chosen avatar look.
-- Stored as part ids (a small JSON object), never images or free text, so there is nothing to
-- moderate and the art can change later. Any signed-in member can READ an avatar (it shows beside
-- names in Home and the Common Room); it is not public on the internet (anon has no access).
-- Nobody writes from the browser: the member-avatar Edge Function (service role) validates every
-- id against the catalog and refuses parts the member does not own (member_items, 0029).
-- A missing row means the starter look. Avatar parts are never sold or granted by this migration.

create table if not exists public.member_avatars (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  parts jsonb not null check (jsonb_typeof(parts) = 'object' and pg_column_size(parts) <= 1024),
  updated_at timestamptz not null default now()
);

alter table public.member_avatars enable row level security;
revoke all on public.member_avatars from anon, authenticated;
grant select on public.member_avatars to authenticated;

drop policy if exists member_avatars_read_members on public.member_avatars;
create policy member_avatars_read_members on public.member_avatars
  for select using (public.is_verified_member());
