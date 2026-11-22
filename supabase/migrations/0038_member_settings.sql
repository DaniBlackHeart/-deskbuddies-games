-- 0038_member_settings: per-member Settings choices that other features will enforce.
-- One row per member, created the first time they change a switch. A missing row means every
-- switch is on (the design default). Members can read only their own row; changes go through
-- the member-settings Edge Function, so the browser never writes this table directly.
-- Nothing here reads or exposes journals, books, habits or focus goals.

create table if not exists public.member_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_stickies boolean not null default true,
  notify_news boolean not null default true,
  allow_stickies boolean not null default true,
  show_in_around boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.member_settings enable row level security;

drop policy if exists member_settings_read_own on public.member_settings;
create policy member_settings_read_own on public.member_settings
  for select to authenticated using (user_id = auth.uid());

-- Sets one switch for one member. The column is chosen from a fixed list, never from raw input.
create or replace function public.member_setting_set(p_user_id uuid, p_key text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in ('notify_stickies','notify_news','allow_stickies','show_in_around') then
    raise exception 'unknown setting';
  end if;
  insert into member_settings (user_id) values (p_user_id) on conflict (user_id) do nothing;
  execute format('update member_settings set %I = $1, updated_at = now() where user_id = $2', p_key)
    using p_value, p_user_id;
end;
$$;

revoke all on function public.member_setting_set(uuid, text, boolean) from public, anon, authenticated;
