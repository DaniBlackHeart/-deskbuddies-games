-- DeskBuddies Games — Chill / Hard session modes
-- Run via: supabase db push  (or paste into the Supabase SQL editor)

alter table public.trivia_sessions
  add column mode text not null default 'chill' check (mode in ('chill', 'hard'));

comment on column public.trivia_sessions.mode is
  'chill = original scoring (correct = +points, wrong/no-answer = 0). '
  'hard = wrong answers cost the question''s penalty_points, not '
  'answering costs 25% of points, chosen by the MOD when starting the session.';
