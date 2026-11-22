-- 0039_notifications: the member's own mailbox behind the bell.
-- A notification is written by the server (triggers below, or later features through the
-- service role) and read by its owner only. Members cannot insert, edit or delete rows; they
-- mark them read through the notifications Edge Function.
-- source_key makes each event produce one notification (no double counting).
-- Notification text never carries journal, goal, photo or note content: titles and bodies are
-- written by the server from fixed wording and the names of stamps and buddies.
-- Desk Sticky, reminder, social and "What's new" kinds are allowed in the table, but nothing
-- writes them yet because those features are not built.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('sticky','earned','reminder','social','news')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 300),
  href text check (href is null or href ~ '^/[a-z0-9/_-]*$'),
  source_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, source_key)
);

create index if not exists notifications_user_recent on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select using (user_id = auth.uid() and public.is_verified_member());

-- Marks one notification (or all) read for the given member.
create or replace function public.notifications_mark_read(p_user_id uuid, p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update notifications set read_at = now()
   where user_id = p_user_id and read_at is null and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.notifications_mark_read(uuid, uuid) from public, anon, authenticated;

-- Earned: a stamp lands in the Buddybook.
create or replace function public.notify_stamp_earned() returns trigger
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select name, earned_line into d from stamp_defs where key = new.stamp_key;
  insert into notifications (user_id, kind, title, body, href, source_key)
  values (new.user_id, 'earned', 'A new stamp in your Buddybook: ' || coalesce(d.name, 'a new stamp'), d.earned_line, '/buddybook', 'stamp:' || new.stamp_key)
  on conflict (user_id, source_key) do nothing;
  return new;
end;
$$;
drop trigger if exists member_stamps_notify on public.member_stamps;
create trigger member_stamps_notify after insert on public.member_stamps
  for each row execute function public.notify_stamp_earned();

-- Earned: a buddy joins the member's collection.
create or replace function public.notify_buddy_found() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if new.item_key like 'companion:%' then
    select name into nm from buddy_defs where key = substr(new.item_key, 11);
    insert into notifications (user_id, kind, title, body, href, source_key)
    values (new.user_id, 'earned', 'You found a new buddy: ' || coalesce(nm, 'a new buddy'), 'It is in your Buddybook now.', '/buddybook', 'buddy:' || new.item_key)
    on conflict (user_id, source_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists member_items_notify on public.member_items;
create trigger member_items_notify after insert on public.member_items
  for each row execute function public.notify_buddy_found();
