-- Debbie — daily check-in (streak only, no rewards yet)
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- One row per member per calendar day. The calendar day is decided by the
-- Edge Function (daily-checkin), in Asia/Manila time — never by the browser.
--
-- Security model:
--   - Members can READ only their own rows (RLS below).
--   - Nobody can INSERT/UPDATE/DELETE from the browser: there is no write
--     policy. Rows are created only by the daily-checkin Edge Function using
--     the service role, which is what stops fake or backdated check-ins.
--   - unique (user_id, checkin_date) is the duplicate guard: two taps, two
--     tabs or two devices on the same day can only ever create one row.
--
-- Deliberately NOT included: XP, currency or any reward. Reward values and
-- daily caps are still undecided; when they are, they should be granted by
-- a separate, traceable reward-transaction table, not stored here.

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

alter table public.daily_checkins enable row level security;

create policy "daily_checkins: read own rows"
  on public.daily_checkins for select
  using (user_id = auth.uid() and public.is_verified_member());
