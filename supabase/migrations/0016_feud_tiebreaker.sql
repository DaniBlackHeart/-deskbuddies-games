-- Family Feud — tiebreaker round
-- A MOD can add one or more round questions flagged as tiebreaker-only
-- content. Those are never used by normal round progression (start_round
-- explicitly excludes them) — they're only pulled in if the main game ends
-- tied, via the new start_tiebreaker_round action, which plays out through
-- the exact same face-off/board/steal mechanics as any other round (those
-- gate on round.status, not session.status, so nothing there needed to
-- change). 'tiebreaker' is a session status distinct from 'live' purely so
-- the host/player UIs can tell "still going, could still tie again" apart
-- from a genuinely finished main game.

alter table public.feud_round_questions
  add column is_tiebreaker boolean not null default false;

alter table public.feud_sessions
  drop constraint if exists feud_sessions_status_check;

alter table public.feud_sessions
  add constraint feud_sessions_status_check
  check (status in ('lobby', 'live', 'main_ended', 'tiebreaker', 'fastmoney_setup', 'fastmoney_p1', 'fastmoney_p2', 'fastmoney_reveal', 'ended'));
