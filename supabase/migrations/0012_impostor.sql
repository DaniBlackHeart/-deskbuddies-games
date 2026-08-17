-- DeskBuddies Games — Impostor WHO?
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
--
-- Everyone gets a card with the secret word + its category, except one
-- random member (the Impostor), who only sees "You're the Impostor" plus
-- the category name — that's their only clue to bluff a convincing clue
-- about a word they don't actually know. Play alternates typed clues in
-- turn order, then a multiple-choice vote on who the impostor is.
--
-- Anti-cheat boundaries needed here (three separate secrets, three
-- separate tables — RLS is row-level, not column-level, same reasoning
-- as uno_hands/uno_deck_state in 0011):
--   1. WHO the impostor is — nobody's client should be able to read this
--      off any row until the reveal. Lives in impostor_secrets, RLS
--      enabled with ZERO policies (defense in depth, same pattern as
--      active_session_lock/uno_deck_state) until the session row's own
--      revealed_impostor_user_id is deliberately set at game end.
--   2. WHAT the secret word is — same table, same reasoning. The
--      impostor's own card must never contain it.
--   3. WHO voted for WHOM — impostor_votes is "read own vote only"
--      (mirrors feud_fastmoney_answers), so nobody can see the emerging
--      tally by peeking at other rows; only the resolution broadcast
--      reveals aggregate counts once voting closes.
--
-- impostor_cards is the "read own row only" pattern (mirrors uno_hands):
-- each player's own card (their word + category, or "impostor" + category)
-- and nothing else's.
--
-- impostor_clues is the opposite: it's deliberately PUBLIC (any verified
-- member can read the whole session's clue history) — that's the "board
-- at the top" every player uses to reason about who the impostor is. No
-- secret lives in this table.
--
-- No join_code column — confirmed dead weight on trivia_sessions/
-- feud_sessions (see PROJECT_CONTEXT.md), not worth copying into a new
-- table. Same reasoning UNO's migration (0011) used.

-- =========================================================
-- impostor_categories / impostor_words
-- MOD-authored content, same "mods manage" + archive-not-delete shape
-- as question_sets/questions (0001, 0010). Words have no order_index —
-- unlike trivia questions, nothing ever indexes into this list
-- positionally (the word actually used is picked at random at
-- start_game), so removing/archiving one never requires renumbering
-- anything else. That makes the archive-or-delete helper for this game
-- meaningfully simpler than trivia's.
-- =========================================================
create table public.impostor_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.impostor_categories enable row level security;

create policy "impostor_categories: mods manage"
  on public.impostor_categories for all
  using (public.is_mod())
  with check (public.is_mod());

create table public.impostor_words (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.impostor_categories (id) on delete cascade,
  word text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.impostor_words enable row level security;

create policy "impostor_words: mods manage"
  on public.impostor_words for all
  using (public.is_mod())
  with check (public.is_mod());

-- =========================================================
-- impostor_sessions
-- The live game's PUBLIC state only. category_id/category_name are
-- intentionally denormalized here (not just joined from
-- impostor_categories, which is mod-only-readable) because EVERY player
-- needs to see the category — crew members get it alongside their word,
-- and it's the impostor's entire clue. winner/completed mirrors the
-- established Trivia/Feud "completed vs. cut short by a mod" split.
-- revealed_impostor_user_id/revealed_secret_word stay null for the whole
-- game and are only ever set by impostor-play's resolution step once a
-- real outcome (crew_win or impostor_win) is reached — safe to expose via
-- the normal members-read policy precisely because they're null until
-- that point, same reasoning as uno_sessions.winner_id.
--
-- status flow: lobby -> clue_giving -> voting -> (inconclusive: back to
-- clue_giving for the next round-set) -> voting -> ended.
--
-- round_number counts 1-4 across the whole game (rounds 1-2 = the first
-- 2-round set, rounds 3-4 = the second). turn_index is how many players
-- have gone THIS round (0..N-1); round_set_starter_user_id is who opened
-- the current 2-round set — round 2 of a set repeats the SAME starter
-- rather than continuing the rotation, so both rounds of a set give every
-- player exactly one clue each starting from the same point. A fresh
-- random (non-impostor) starter is picked for round-set 2 if the game
-- gets that far, per the spec ("again with a random member starting
-- instead of continuing from the previous one").
-- =========================================================
create table public.impostor_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id),
  status text not null default 'lobby'
    check (status in ('lobby', 'clue_giving', 'voting', 'ended')),

  category_id uuid not null references public.impostor_categories (id),
  category_name text not null,

  round_number int not null default 0, -- 0 in lobby; 1-4 once live
  turn_index int not null default 0,
  round_set_starter_user_id uuid references public.profiles (id),
  current_turn_user_id uuid references public.profiles (id),
  clue_deadline timestamptz,

  vote_round int check (vote_round in (1, 2)),
  vote_deadline timestamptz,

  winner text check (winner in ('crew', 'impostor')),
  completed boolean not null default false,
  revealed_impostor_user_id uuid references public.profiles (id),
  revealed_secret_word text,

  -- Optimistic-concurrency guard, same purpose as uno_sessions.state_version:
  -- guards a stray timeout call that fires after the round already moved on.
  state_version int not null default 0,

  spectator_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.impostor_sessions enable row level security;

create policy "impostor_sessions: members read"
  on public.impostor_sessions for select
  using (public.is_verified_member());
-- No insert/update/delete for authenticated — impostor-host/impostor-play (service role) only.

-- =========================================================
-- impostor_secrets
-- WHO the impostor is + WHAT the secret word is. RLS enabled with ZERO
-- policies — same "defense in depth" pattern as active_session_lock
-- (0008) and uno_deck_state (0011). Never queried by the frontend at all,
-- at any role; only impostor-host (to write it at start_game) and
-- impostor-play (to read it when resolving a vote) ever touch this,
-- both via the service-role client.
-- =========================================================
create table public.impostor_secrets (
  session_id uuid primary key references public.impostor_sessions (id) on delete cascade,
  impostor_user_id uuid not null references public.profiles (id),
  secret_word text not null
);

alter table public.impostor_secrets enable row level security;
-- No policies on purpose — not client-facing.

-- =========================================================
-- impostor_cards
-- Each player's own card. Anti-cheat boundary: "read own row only",
-- mirrors uno_hands (0011) and feud_fastmoney_answers (0007). `word` is
-- null for the impostor's row — their card shows category_name only,
-- exactly like the design calls for ("You're the Impostor" + the clue).
-- =========================================================
create table public.impostor_cards (
  session_id uuid not null references public.impostor_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  is_impostor boolean not null,
  word text, -- null for the impostor
  category_name text not null,
  primary key (session_id, user_id)
);

alter table public.impostor_cards enable row level security;

create policy "impostor_cards: read own card only"
  on public.impostor_cards for select
  using (user_id = auth.uid());

-- =========================================================
-- impostor_participants
-- Roster + seat order (shuffled once at start_game, same idea as UNO's
-- deal order) — purely public, no secrets on this table.
-- =========================================================
create table public.impostor_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.impostor_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  seat_order int not null,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, seat_order)
);

alter table public.impostor_participants enable row level security;

create policy "impostor_participants: members read"
  on public.impostor_participants for select
  using (public.is_verified_member());

-- =========================================================
-- impostor_clues
-- The public "clue board" every player sees at the top of the screen —
-- this table IS the feature, so unlike almost everything else in this
-- schema it's fully member-readable with no anti-cheat concern at all.
-- One row per player per round (unique constraint enforces this), so the
-- board can always be rendered grouped by round_number.
-- =========================================================
create table public.impostor_clues (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.impostor_sessions (id) on delete cascade,
  round_number int not null,
  user_id uuid not null references public.profiles (id),
  clue_text text not null default '',
  timed_out boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, round_number, user_id)
);

alter table public.impostor_clues enable row level security;

create policy "impostor_clues: members read"
  on public.impostor_clues for select
  using (public.is_verified_member());

-- =========================================================
-- impostor_votes
-- Anti-cheat boundary for the accusation vote: a player may only read
-- their OWN cast vote, same "read own row only" idea as
-- feud_fastmoney_answers — nobody's client can peek at the emerging
-- tally by querying other players' rows. impostor-play (service role)
-- computes and broadcasts the aggregate result once voting closes.
-- =========================================================
create table public.impostor_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.impostor_sessions (id) on delete cascade,
  vote_round int not null check (vote_round in (1, 2)),
  voter_user_id uuid not null references public.profiles (id),
  suspect_user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (session_id, vote_round, voter_user_id)
);

alter table public.impostor_votes enable row level security;

create policy "impostor_votes: read own vote"
  on public.impostor_votes for select
  using (voter_user_id = auth.uid());

create policy "impostor_votes: mods read all"
  on public.impostor_votes for select
  using (public.is_mod());

-- =========================================================
-- Realtime — same three-table-ish pattern as trivia/feud/uno. Notably
-- impostor_clues IS included (unlike uno_hands/feud_fastmoney_answers) —
-- it's the one "secret-shaped" table in this game that's actually meant
-- to broadcast to everyone. impostor_cards, impostor_secrets, and
-- impostor_votes are all deliberately excluded.
-- =========================================================
alter publication supabase_realtime add table public.impostor_sessions;
alter publication supabase_realtime add table public.impostor_participants;
alter publication supabase_realtime add table public.impostor_clues;

-- Helpful indexes
create index idx_impostor_words_category on public.impostor_words (category_id, archived_at);
create index idx_impostor_categories_archived on public.impostor_categories (archived_at);
create index idx_impostor_sessions_status on public.impostor_sessions (status);
create index idx_impostor_participants_session on public.impostor_participants (session_id, seat_order);
create index idx_impostor_clues_session on public.impostor_clues (session_id, round_number);
create index idx_impostor_votes_session on public.impostor_votes (session_id, vote_round);
