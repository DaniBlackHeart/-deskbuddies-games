-- DeskBuddies Games — Wheel of Fortune
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Turn model (this is the one genuinely new mechanic vs. every other game
-- in this repo, so it's worth spelling out up front): unlike UNO's seat
-- rotation or Feud's line-position rotation, whose turn it is here is
-- decided by a BUZZER race, same primitive as Feud's face-off buzz-lock
-- (atomic conditional update, first claim wins). Whoever wins the buzz
-- spins, calls a consonant (or buys a vowel, or attempts to solve), and
-- keeps going as long as they keep guessing correctly. A wrong guess (or
-- Bankrupt/Lose a Turn) ends their turn and puts them in a "locked out"
-- list until ANYONE gets a correct consonant guess, at which point the
-- lockout clears for everyone and the buzzer reopens. If every remaining
-- eligible player is locked out at once, the round can't continue, so it
-- auto-reveals — see wheel-play's resolveTurnEnd for the exact logic.
--
-- Categories + randomizer, mirroring Impostor WHO?'s categories/words
-- shape exactly (wheel_categories -> wheel_phrases, same "mods manage" +
-- archive-not-delete pattern as impostor_categories/impostor_words in
-- 0012_impostor.sql) rather than introducing a separate "Sets" grouping
-- table like Trivia/Feud have. At start_game and at every round advance,
-- the server randomly picks a category (preferring one not already used
-- this session) and a random phrase within it — this is what satisfies
-- both "phrases organized like Feud" (a category IS the grouping) and
-- "categories with a randomizer like Impostor" in one structure, without
-- a redundant second grouping concept. Flagging this decision explicitly
-- in case a hand-curated "Wheel Set" (like Feud's) turns out to be wanted
-- instead once this gets played.
--
-- Anti-cheat boundary, same idea as every other game's secret-answer
-- split (questions.correct_choice, feud's unrevealed board text, uno's
-- deck order, impostor's secret word): the actual phrase text must never
-- reach a browser before its letters are revealed by guesses. RLS is
-- ROW-level not column-level, so — same reasoning as uno_deck_state /
-- impostor_secrets — the real phrase text lives in its own table with
-- RLS enabled and ZERO policies, never queried by the frontend at any
-- role, only read server-side (service role) by wheel-host/wheel-play/
-- get-wheel-state to compute the masked public display.
--
-- No join_code column — confirmed dead weight on trivia_sessions/
-- feud_sessions (see PROJECT_CONTEXT.md), not copied into new tables
-- since UNO (0011) and Impostor (0012).

-- =========================================================
-- wheel_categories / wheel_phrases
-- MOD-authored content. Same shape as impostor_categories/impostor_words:
-- phrases have no order_index — nothing indexes into this list
-- positionally (a phrase is picked at random per round), so archiving one
-- never requires renumbering anything else.
-- =========================================================
create table public.wheel_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.wheel_categories enable row level security;

create policy "wheel_categories: mods manage"
  on public.wheel_categories for all
  using (public.is_mod())
  with check (public.is_mod());

create table public.wheel_phrases (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.wheel_categories (id) on delete cascade,
  phrase text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.wheel_phrases enable row level security;

create policy "wheel_phrases: mods manage"
  on public.wheel_phrases for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- wheel_sessions
-- The live game's PUBLIC state. Bonus-round fields live directly on this
-- row rather than a separate table — there's only ever one bonus attempt
-- per session, so a join would be pure overhead. bonus_solved_phrase and
-- bonus_won/bonus_points_awarded stay null until the bonus round is
-- actually resolved, same "safe because it's null until a real outcome"
-- reasoning as uno_sessions.winner_id / impostor_sessions.revealed_*.
--
-- status flow: lobby -> live (rounds 0-4) -> [tiebreaker (round 5+), only
-- if tied after round 4] -> bonus_category_choice -> bonus_letter_choice
-- -> bonus_solving -> ended.
-- =========================================================
create table public.wheel_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id),
  status text not null default 'lobby'
    check (status in ('lobby', 'live', 'tiebreaker', 'bonus_category_choice', 'bonus_letter_choice', 'bonus_solving', 'ended')),

  current_round_index int not null default 0, -- 0-4 across the 5 main rounds
  used_category_ids uuid[] not null default '{}',
  used_phrase_ids uuid[] not null default '{}',

  -- Only populated while status = 'tiebreaker': who's still in contention
  -- for the lead, and how many Do-or-Die attempts have been made (capped
  -- defensively — see wheel-host's advance_round — so a content-starved
  -- category pool can't loop forever without ever producing a winner).
  tiebreak_eligible_user_ids uuid[] not null default '{}',
  tiebreak_attempt int not null default 0,

  winner_user_id uuid references public.profiles (id), -- who's playing the Bonus Round
  bonus_category_choices jsonb, -- [{id, name}] x3, set once the winner is known
  bonus_category_id uuid references public.wheel_categories (id),
  bonus_category_name text,
  bonus_given_letters text[] not null default '{}', -- always R S T L N E once chosen
  bonus_chosen_consonants text[] not null default '{}', -- the winner's 3 extra consonants
  bonus_chosen_vowel text, -- the winner's 1 extra vowel
  bonus_deadline timestamptz,
  bonus_won boolean,
  bonus_points_awarded int,
  bonus_solved_phrase text, -- revealed only once the bonus round is actually over

  -- Optimistic-concurrency guard, same purpose as uno_sessions.state_version.
  state_version int not null default 0,

  spectator_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.wheel_sessions enable row level security;

create policy "wheel_sessions: members read"
  on public.wheel_sessions for select
  using (public.is_verified_member());
-- No insert/update/delete for authenticated — wheel-host/wheel-play (service role) only.

-- The real Bonus Round phrase + its hidden prize amount. RLS enabled with
-- ZERO policies, same "defense in depth" pattern as wheel_round_secrets
-- below / uno_deck_state / impostor_secrets / active_session_lock.
create table public.wheel_bonus_secrets (
  session_id uuid primary key references public.wheel_sessions (id) on delete cascade,
  phrase_text text not null,
  prize_points int not null
);

alter table public.wheel_bonus_secrets enable row level security;
-- No policies on purpose — not client-facing.

-- =========================================================
-- wheel_participants
-- Roster + running total across banked rounds. Purely public — no
-- secrets on this table (round-by-round in-progress points live on
-- wheel_rounds.round_scores, also public — see below for why that's safe).
-- =========================================================
create table public.wheel_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wheel_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  seat_order int not null,
  total_points int not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, seat_order)
);

alter table public.wheel_participants enable row level security;

create policy "wheel_participants: members read"
  on public.wheel_participants for select
  using (public.is_verified_member());

-- =========================================================
-- wheel_rounds
-- One row per round (main rounds 0-4, then Do-or-Die tiebreaker rounds
-- continuing the same index sequence with is_tiebreaker = true). Holds
-- everything genuinely safe to broadcast to everyone: which letters have
-- been tried, whose turn it is and what phase of their turn, the pending
-- wedge they just landed on, and each player's in-progress round score.
-- round_scores is deliberately public (not anti-cheat-sensitive like the
-- phrase itself) — it's the "who's built up how much this round" board
-- everyone watches live, same spirit as Feud's points_pot.
-- =========================================================
create table public.wheel_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wheel_sessions (id) on delete cascade,
  round_index int not null,
  is_tiebreaker boolean not null default false,

  category_id uuid not null references public.wheel_categories (id),
  category_name text not null,
  phrase_length int not null,

  status text not null default 'active' check (status in ('active', 'solved', 'revealed')),
  solved_by_user_id uuid references public.profiles (id),

  guessed_letters text[] not null default '{}', -- every consonant called or vowel bought this round, uppercase
  locked_out_user_ids uuid[] not null default '{}',
  active_user_id uuid references public.profiles (id), -- who currently holds the turn; null while status = 'active' and turn_phase = 'buzz_open'
  turn_phase text not null default 'buzz_open'
    check (turn_phase in ('buzz_open', 'awaiting_action', 'awaiting_consonant', 'awaiting_mystery_choice', 'awaiting_solve_guess')),
  turn_deadline timestamptz,
  pending_wedge jsonb, -- {type, value?, calls_remaining?} — the wedge just landed on, while a consonant call or Mystery choice is pending
  free_play_active boolean not null default false, -- protects the NEXT consonant miss this turn from ending it

  round_scores jsonb not null default '{}'::jsonb, -- {user_id: points_this_round}

  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (session_id, round_index)
);

alter table public.wheel_rounds enable row level security;

create policy "wheel_rounds: members read"
  on public.wheel_rounds for select
  using (public.is_verified_member());

-- The real phrase text for a round. RLS enabled with ZERO policies — see
-- the anti-cheat note at the top of this file.
create table public.wheel_round_secrets (
  round_id uuid primary key references public.wheel_rounds (id) on delete cascade,
  phrase_text text not null
);

alter table public.wheel_round_secrets enable row level security;
-- No policies on purpose — not client-facing.

-- =========================================================
-- Realtime — same pattern as every other game. wheel_round_secrets and
-- wheel_bonus_secrets are deliberately excluded (never client-facing at
-- all), same reasoning as uno_deck_state/impostor_secrets.
-- =========================================================
alter publication supabase_realtime add table public.wheel_sessions;
alter publication supabase_realtime add table public.wheel_participants;
alter publication supabase_realtime add table public.wheel_rounds;

-- Helpful indexes
create index idx_wheel_phrases_category on public.wheel_phrases (category_id, archived_at);
create index idx_wheel_categories_archived on public.wheel_categories (archived_at);
create index idx_wheel_sessions_status on public.wheel_sessions (status);
create index idx_wheel_participants_session on public.wheel_participants (session_id, seat_order);
create index idx_wheel_rounds_session on public.wheel_rounds (session_id, round_index);
