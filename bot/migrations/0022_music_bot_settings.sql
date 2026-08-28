-- Music bot settings (DJ role per Discord server).
--
-- This table is only ever read/written by the music bot process using the
-- Supabase service-role key — it never goes through the frontend or the
-- anon/authenticated roles at all. RLS is enabled with zero policies,
-- matching this repo's existing "defense in depth" pattern (see
-- PROJECT_CONTEXT.md §4 — same shape as `active_session_lock`,
-- `uno_deck_state`, `impostor_secrets`): a blanket "no policy" table simply
-- isn't readable/writable by anyone except the service role, which bypasses
-- RLS by design. Safe to re-run.

create table if not exists music_settings (
  guild_id text primary key,
  dj_role_id text,
  default_volume numeric,
  updated_at timestamptz not null default now()
);

alter table music_settings enable row level security;
-- Deliberately no policies — service-role-only access, same as
-- active_session_lock / uno_deck_state / impostor_secrets elsewhere in
-- this schema.

-- Keep updated_at current on every upsert.
create or replace function set_music_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists music_settings_set_updated_at on music_settings;
create trigger music_settings_set_updated_at
  before update on music_settings
  for each row
  execute function set_music_settings_updated_at();
