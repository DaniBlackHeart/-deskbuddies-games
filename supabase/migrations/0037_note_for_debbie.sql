-- 0037: A Note for Debbie (suggestions, feedback, something broken).
-- See the design notes for "A Note for Debbie". Where notes should go is still open in the design
-- (an in-app inbox for the team, or a Discord channel), so this stores them privately in the
-- database and posts them nowhere. Only the service role can read them (no member policy at all),
-- so the privacy line on the page ("only the team reads it, it is not posted") is true.
-- Sending a note earns nothing. No attachments, and no journal/book/habit/focus content is attached.
--
-- The team reads notes in the Supabase table editor (debbie_notes) until an admin inbox exists.
-- The daily limit is provisional and can be changed: update note_settings set daily_limit = N where id;

create table public.note_settings (
  id           boolean primary key default true check (id),
  daily_limit  integer not null default 5 check (daily_limit between 1 and 50)
);
insert into public.note_settings (id) values (true);

create table public.debbie_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('idea', 'broke', 'liked', 'else')),
  page        text check (page is null or char_length(page) <= 40),
  body        text not null check (char_length(body) between 3 and 1000),
  reply_ok    boolean not null default true,
  status      text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at  timestamptz not null default now()
);
create index debbie_notes_created_idx on public.debbie_notes (created_at desc);
create index debbie_notes_user_idx on public.debbie_notes (user_id, created_at);

alter table public.note_settings enable row level security;
alter table public.debbie_notes enable row level security;
revoke all on public.note_settings, public.debbie_notes from anon, authenticated;

-- One note, with the daily limit checked and the insert done together so two quick sends cannot slip past it.
create function public.note_submit(p_user uuid, p_kind text, p_page text, p_body text, p_reply boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer;
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext('note:' || p_user::text));
  select daily_limit into lim from public.note_settings where id;
  select count(*) into used from public.debbie_notes
   where user_id = p_user and public.community_day_of(created_at) = public.community_today();
  if used >= lim then return 'limit'; end if;
  insert into public.debbie_notes (user_id, kind, page, body, reply_ok)
  values (p_user, p_kind, p_page, p_body, p_reply);
  return 'ok';
end;
$$;
revoke all on function public.note_submit(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.note_submit(uuid, text, text, text, boolean) to service_role;
