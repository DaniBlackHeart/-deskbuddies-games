-- DeskBuddies Games — wrong-answer penalty scoring
-- Run via: supabase db push  (or paste into the Supabase SQL editor)

alter table public.questions add column penalty_points int;

comment on column public.questions.penalty_points is
  'Points deducted for a wrong answer. NULL = default to half of points '
  '(rounded), resolved at question-creation/grading time. Set equal to '
  '"points" for a question that should cost everything if missed.';
