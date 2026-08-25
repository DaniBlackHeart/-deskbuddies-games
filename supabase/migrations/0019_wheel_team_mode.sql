-- Wheel of Fortune — Team mode
--
-- Adds a second mode alongside the existing "solo" free-for-all: 3-12
-- teams of 2-3 members each, self-selected at join time (not MOD-
-- assigned). The turn model gets a second layer as a result:
--
--   - TEAM-level control works exactly like solo's individual control
--     did — a buzz-off opens each round, a miss (once opened) passes
--     control to the next team in seat_order, wrapping around.
--   - WITHIN a team's held control, individual teammates act one at a
--     time in strict line order (mirroring Family Feud's line_position),
--     advancing to the next teammate after EVERY resolved action —
--     spin+call, buying a vowel, or a solve attempt — regardless of
--     whether that action hit or missed. This is a genuine departure
--     from solo mode's "same player keeps going while they're hot": in
--     team mode the TEAM keeps control while hot, but a different
--     teammate gets to be the one actually spinning each time.
--
-- wheel_teams.current_rep_index tracks whose turn it is within a team —
-- it advances every time that team completes one full action, and never
-- resets between rounds, so everyone gets roughly equal turns across a
-- whole game rather than always starting from the front of the line.
--
-- Scoring keys off team_id instead of user_id in team mode: round_scores
-- (on wheel_rounds, already a public jsonb blob) and the persisted total
-- (now on wheel_teams.total_points, parallel to
-- wheel_participants.total_points for solo mode) both track the TEAM's
-- points, not any one member's.
--
-- See PROJECT_CONTEXT.md §6c-iii for the full design writeup, including
-- the specific answers this was built against (3-12 teams, self-picked,
-- strict per-teammate rotation).

alter table public.wheel_sessions
  add column game_mode text not null default 'solo' check (game_mode in ('solo', 'team'));

-- Team-mode analogs of the existing solo-mode tiebreak/winner columns.
-- Kept as separate columns rather than repurposing the solo ones so a
-- uuid[] of team ids can never be confused with one of user ids.
alter table public.wheel_sessions
  add column tiebreak_eligible_team_ids uuid[] not null default '{}',
  add column winner_team_id uuid; -- FK added below, once wheel_teams exists

-- =========================================================
-- wheel_teams
-- One row per team in a team-mode session. seat_order is the team-level
-- rotation order (parallel to wheel_participants.seat_order for solo
-- mode's individual rotation); current_rep_index is which line_position
-- within the team is up next to actually act.
-- =========================================================
create table public.wheel_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wheel_sessions (id) on delete cascade,
  name text not null,
  seat_order int not null,
  current_rep_index int not null default 0,
  total_points int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, seat_order),
  unique (session_id, name)
);

alter table public.wheel_teams enable row level security;

create policy "wheel_teams: members read"
  on public.wheel_teams for select
  using (public.is_verified_member());

alter table public.wheel_sessions
  add constraint wheel_sessions_winner_team_id_fkey foreign key (winner_team_id) references public.wheel_teams (id);

-- =========================================================
-- wheel_participants — team-mode columns
-- Both nullable: stay null for every solo-mode participant. line_position
-- is 0-indexed within the team (0 = front of the line), same convention
-- as feud_participants.line_position.
-- =========================================================
alter table public.wheel_participants
  add column team_id uuid references public.wheel_teams (id) on delete set null,
  add column line_position int;

-- =========================================================
-- wheel_rounds — team-mode turn state
-- active_team_id is which team currently holds control (team mode only);
-- active_user_id keeps meaning exactly what it always did — the one
-- specific person who's actually allowed to act right now — which in
-- team mode is simply that team's current representative. No change was
-- needed to how existing code authorizes actions against active_user_id.
-- locked_out_team_ids mirrors locked_out_user_ids, scoped to teams, for
-- the pre-opening buzz-lockout mechanic.
-- =========================================================
alter table public.wheel_rounds
  add column active_team_id uuid references public.wheel_teams (id),
  add column locked_out_team_ids uuid[] not null default '{}';

create index idx_wheel_teams_session on public.wheel_teams (session_id, seat_order);
create index idx_wheel_participants_team on public.wheel_participants (team_id, line_position);
