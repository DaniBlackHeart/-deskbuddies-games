-- Wheel of Fortune — round rotation fix
--
-- The buzzer is a one-time face-off to open a round, not something that
-- reopens on every miss for the round's whole duration. Once someone's
-- opening guess lands correctly, "the guessing phase" (per the brief) is
-- over for that round — from then on, a wrong guess (post-spin consonant,
-- Bankrupt, Lose a Turn, a failed solve, or a timeout) just passes control
-- to the next seat directly (they spin immediately, no buzzing), same as
-- the real show's seat rotation. is_opened tracks which mode a round is
-- currently in, so wheel-play's resolveTurnEnd knows whether a miss should
-- reopen the buzzer (not opened yet) or hand off to the next seat (opened).
-- See PROJECT_CONTEXT.md §6c-ii for the full reasoning and correction log.

alter table public.wheel_rounds
  add column is_opened boolean not null default false;
