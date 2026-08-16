-- DeskBuddies Games — UNO
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Ruleset: official rules + popular house rules (draw-stacking, jump-in,
-- 7-0), plus the Wild Draw Four challenge. See uno-play/index.ts for the
-- exact mechanics — this file only needs to hold the state those rules
-- read and write.
--
-- Unlike Trivia/Feud, UNO has no MOD-authored content (no "sets" table —
-- it's just the standard 108-card deck), so this migration is shorter
-- than 0007_feud_game.sql despite the game itself having more live state.
--
-- Anti-cheat split, same idea as feud_fastmoney_answers (0007) but for a
-- different secret: nobody's *hand* should be readable by anyone but
-- them, and the *draw pile order* shouldn't be readable by anyone at
-- all from the client — not even in aggregate. Note RLS is ROW-level,
-- not column-level, so the piles can't just be "a column nobody's
-- allowed to select" on a table that otherwise has a blanket member-read
-- policy (uno_sessions needs exactly that kind of policy so the frontend
-- can read status/turn/discard-top directly). So, three tables:
--   - uno_sessions holds only the genuinely public live state (status,
--     turn, direction, discard TOP only, etc.) — safe for the existing
--     "members read" policy shape used everywhere else in this schema.
--   - uno_deck_state holds the draw pile and discard history, in its own
--     table with RLS enabled and ZERO policies — same "defense in depth"
--     pattern as active_session_lock (0008): if it's ever queried with
--     the anon/authenticated role, it returns nothing rather than
--     leaking future draws. Never read by the frontend directly, only by
--     uno-host/uno-play via the service role.
--   - uno_hands is split out so RLS can restrict it to "read own row
--     only" (mirrors feud_fastmoney_answers).
--   - uno_participants is the public roster (safe: seat order, hand
--     COUNT, not hand contents).
-- All writes to every uno_* table go through uno-host/uno-play (service
-- role) only — no insert/update policy for authenticated, same reasoning
-- as trivia_sessions/feud_sessions: turn order, legality, and scoring
-- must be enforced server-side, not trusted from the client.
--
-- Note: no `join_code` column here. trivia_sessions/feud_sessions both
-- have one and PROJECT_CONTEXT.md flags it as confirmed dead code on
-- both — generated and displayed but never read by any join flow. Not
-- worth copying a known-dead pattern into a new table.

create table public.uno_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id),
  status text not null default 'lobby'
    check (status in ('lobby', 'live', 'ended')),

  -- Turn state
  direction int not null default 1 check (direction in (1, -1)),
  current_turn_user_id uuid references public.profiles (id),
  current_color text check (current_color in ('red', 'yellow', 'green', 'blue')),
  drawn_this_turn boolean not null default false, -- have they already taken their one draw this turn?

  -- Draw-stacking (+2/+4 house rule) — the obligation currently owed by
  -- current_turn_user_id, and who they'd be challenging if it's a
  -- Wild Draw Four (see uno-play's challenge_wild_draw_four).
  pending_draw int not null default 0,
  pending_draw_type text check (pending_draw_type in ('draw_two', 'draw_four')),
  pending_draw_from_user_id uuid references public.profiles (id),
  pending_draw_prev_color text check (pending_draw_prev_color in ('red', 'yellow', 'green', 'blue')),

  discard_top jsonb, -- {color, value} of the literal top card only — safe to expose as-is. The rest of the discard pile and the whole draw pile live in uno_deck_state, see below.

  -- Optimistic-concurrency guard. Every state-mutating uno-play action
  -- (play_card, draw_card, jump_in, ...) is submitted with the version it
  -- was reacting to; the update is conditioned on it matching, so a stale
  -- jump-in or a timeout firing after the round already moved on loses
  -- cleanly instead of corrupting state. Same defensive spirit as
  -- trivia-answer's double-submission guard, generalized into a counter
  -- because UNO (unlike trivia) has actions that can legitimately race
  -- (jump-in) rather than just double-fire.
  state_version int not null default 0,

  winner_id uuid references public.profiles (id),
  spectator_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.uno_sessions enable row level security;

create policy "uno_sessions: members read"
  on public.uno_sessions for select
  using (public.is_verified_member());
-- No insert/update/delete for authenticated — uno-host/uno-play (service role) only.

-- The draw pile and the discard history (everything under the top card).
-- RLS enabled with ZERO policies, same as active_session_lock (0008) —
-- not client-facing at all, at any role. Only uno-host/uno-play (service
-- role) ever touch this table.
create table public.uno_deck_state (
  session_id uuid primary key references public.uno_sessions (id) on delete cascade,
  draw_pile jsonb not null default '[]'::jsonb,
  discard_pile jsonb not null default '[]'::jsonb
);

alter table public.uno_deck_state enable row level security;
-- No policies on purpose — not client-facing.

create table public.uno_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.uno_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  seat_order int not null,
  hand_count int not null default 0, -- public — doesn't reveal contents
  has_called_uno boolean not null default false,
  finished_at timestamptz, -- set for the winner when the game ends
  finish_rank int, -- winner = 1; everyone else ranked by hand_count ascending at game-end, for the results screen only (not gameplay-affecting)
  joined_at timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, seat_order)
);

alter table public.uno_participants enable row level security;

create policy "uno_participants: members read roster"
  on public.uno_participants for select
  using (public.is_verified_member());

-- Anti-cheat boundary: a player may only read their OWN hand. Same
-- pattern as feud_fastmoney_answers (0007).
create table public.uno_hands (
  session_id uuid not null references public.uno_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  hand jsonb not null default '[]'::jsonb,
  primary key (session_id, user_id)
);

alter table public.uno_hands enable row level security;

create policy "uno_hands: read own hand only"
  on public.uno_hands for select
  using (user_id = auth.uid());

-- Realtime — same three-table pattern as trivia/feud (0002/0007).
-- uno_hands is deliberately excluded, same reasoning as
-- feud_fastmoney_answers: it must never broadcast to everyone.
alter publication supabase_realtime add table public.uno_sessions;
alter publication supabase_realtime add table public.uno_participants;

-- Helpful indexes
create index idx_uno_participants_session on public.uno_participants (session_id, seat_order);
create index idx_uno_sessions_status on public.uno_sessions (status);
