// Shared types mirroring the Supabase Postgres schema.
// Keep in sync with supabase/migrations/0001_init.sql

export type Profile = {
  id: string; // auth.users.id
  discord_id: string;
  username: string;
  avatar_url: string | null;
  is_member: boolean;
  is_mod: boolean;
  created_at: string;
};

export type QuestionType = "multiple_choice" | "typed";

export type QuestionSet = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
  question_count?: number;
};

export type Question = {
  id: string;
  question_set_id: string;
  order_index: number;
  type: QuestionType;
  prompt: string;
  choices: string[] | null; // multiple_choice only
  correct_choice: number | null; // index into choices, multiple_choice only
  accepted_answers: string[] | null; // typed only
  points: number;
  penalty_points: number | null; // deduction if wrong; null = half of points, rounded
  time_limit_seconds: number;
  archived_at: string | null;
};

// Public-safe question shape sent to players during a live question —
// NEVER includes correct_choice or accepted_answers.
export type PublicQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: string[] | null;
  points: number;
  penalty_points: number; // always resolved (never null) — the actual deduction if wrong
  time_limit_seconds: number;
  order_index: number;
  total_questions: number;
};

export type SessionStatus = "draft" | "lobby" | "live" | "grading" | "ended";
export type SessionMode = "chill" | "hard";

export type TriviaSession = {
  id: string;
  question_set_id: string;
  host_id: string;
  status: SessionStatus;
  mode: SessionMode;
  spectator_id: string | null;
  current_question_index: number;
  current_question_started_at: string | null;
  join_code: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type Answer = {
  id: string;
  session_id: string;
  question_id: string;
  user_id: string;
  choice_index: number | null;
  answer_text: string | null;
  is_correct: boolean | null; // null = pending manual grade
  points_awarded: number;
  response_ms: number;
  graded_by: string | null;
  created_at: string;
};

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  rank: number;
};

// --- Realtime broadcast payload shapes (trivia-session-{id} channel) ---

export type SessionEvent =
  | { type: "lobby_update"; started: true }
  | { type: "question_started"; question: PublicQuestion; deadline_ms: number }
  | {
      type: "question_ended";
      question_id: string;
      correct_choice: number | null;
      accepted_answers: string[] | null;
      leaderboard: LeaderboardEntry[];
      pending_manual_grades: number;
    }
  | { type: "leaderboard_update"; leaderboard: LeaderboardEntry[] }
  | { type: "session_ended"; leaderboard: LeaderboardEntry[]; completed: boolean }
  | {
      type: "answer_graded";
      user_id: string;
      question_id: string;
      is_correct: boolean;
      points_awarded: number;
    };

// =========================================================
// Family Feud
// Keep in sync with supabase/migrations/0007_feud_game.sql
// =========================================================

export type FeudAnswer = { text: string; points: number; alt_answers?: string[] };

export type FeudSet = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  round_count?: number;
  fastmoney_count?: number;
};

export type FeudRoundQuestion = {
  id: string;
  feud_set_id: string;
  order_index: number;
  prompt: string;
  answers: FeudAnswer[];
};

export type FeudFastMoneyQuestion = {
  id: string;
  feud_set_id: string;
  order_index: number; // 0-4
  prompt: string;
  answers: FeudAnswer[];
};

export type Team = "A" | "B";

export type FeudSessionStatus =
  | "lobby"
  | "live"
  | "main_ended"
  | "fastmoney_setup"
  | "fastmoney_p1"
  | "fastmoney_p2"
  | "fastmoney_reveal"
  | "ended";

export type FeudSession = {
  id: string;
  feud_set_id: string;
  host_id: string;
  status: FeudSessionStatus;
  team_a_name: string;
  team_b_name: string;
  team_a_score: number;
  team_b_score: number;
  current_round_index: number;
  fastmoney_team: Team | null;
  fastmoney_player1_id: string | null;
  fastmoney_player2_id: string | null;
  fastmoney_total_points: number;
  fastmoney_revealed_indices: number[];
  spectator_id: string | null;
  join_code: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type FeudParticipant = {
  user_id: string;
  line_position: number;
  team?: Team;
  profiles: { username: string; avatar_url: string | null } | null;
};

export type FeudRoundStatus = "faceoff" | "faceoff_decision" | "board" | "steal" | "lost_reveal" | "complete";

// Public-safe board slot — text/points only present once revealed.
export type PublicBoardSlot = { revealed: false } | { revealed: true; text: string; points: number };

export type PublicFeudRound = {
  round_index: number;
  status: FeudRoundStatus;
  prompt: string;
  board: PublicBoardSlot[];
  total_answers: number;
  pair_index: number;
  face_off_active_a_user_id: string | null;
  face_off_active_b_user_id: string | null;
  face_off_buzz_user_id: string | null;
  face_off_singleton_user_id: string | null;
  face_off_deadline_ms: number | null;
  face_off_decision_user_id: string | null;
  controlling_team: Team | null;
  opposing_team: Team | null;
  current_turn_user_id: string | null;
  current_turn_deadline_ms: number | null;
  strikes: number;
  points_pot: number;
  reveal_count: number;
  outcome: "cleared" | "stolen" | "defended" | "lost_no_control" | null;
  awarded_to_team: Team | null;
};

// --- Realtime broadcast payload shapes (feud-session-{id} channel) ---

export type FeudSessionEvent =
  | { type: "game_started" }
  | { type: "round_started"; round_index: number; prompt: string; answer_count: number; active_a: { user_id: string; username: string }; active_b: { user_id: string; username: string } }
  | { type: "buzz_locked"; winner_user_id: string; deadline_ms: number }
  | { type: "faceoff_correct"; user_id: string; team: Team; index: number; text: string; points: number }
  | { type: "faceoff_miss"; missed_user_id: string; next_user_id: string; deadline_ms: number; timed_out: boolean }
  | { type: "faceoff_next_pair"; pair_index: number; active_a: { user_id: string; username: string }; active_b: { user_id: string; username: string } }
  | { type: "faceoff_all_missed"; timed_out: boolean }
  | { type: "board_started"; controlling_team: Team; current_turn_user_id: string; deadline_ms: number }
  | { type: "board_correct"; index: number; text: string; points: number; points_pot: number; next_turn_user_id: string; deadline_ms: number }
  | { type: "board_strike"; strikes: number; next_turn_user_id: string; deadline_ms: number; timed_out: boolean }
  | { type: "board_cleared"; index: number; text: string; points: number; points_pot: number; awarded_to_team: Team }
  | { type: "steal_started"; opposing_team: Team; points_pot: number; deadline_ms: number; timed_out: boolean }
  | { type: "round_complete"; outcome: "stolen" | "defended"; awarded_to_team: Team; points_pot: number; full_board: { text: string; points: number }[]; timed_out: boolean }
  | { type: "lost_reveal_answer"; index: number; text: string; points: number; revealed_count: number; total: number; done: boolean }
  | { type: "main_game_ended"; team_a_score: number; team_b_score: number }
  | { type: "fastmoney_setup"; team: Team; player1: { user_id: string; username: string }; player2: { user_id: string; username: string } }
  | { type: "fastmoney_player_started"; player_slot: 1 | 2; deadline_ms: number }
  | { type: "fastmoney_reveal_ready" }
  | {
      type: "fastmoney_answer_revealed";
      question_index: number;
      prompt: string;
      player1_answer: string | null;
      player1_points: number;
      player2_answer: string | null;
      player2_points: number;
      round_points: number;
      running_total: number;
      revealed_count: number;
    }
  | { type: "session_ended"; team_a_score: number; team_b_score: number; fastmoney_team: Team | null; fastmoney_total_points: number; won_grand_prize: boolean | null; completed: boolean };

// =========================================================
// UNO
// Keep in sync with supabase/migrations/0011_uno.sql
// =========================================================

export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoCardValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "wild4";
export type UnoCard = { color: UnoColor | "wild"; value: UnoCardValue };

export type UnoSessionStatus = "lobby" | "live" | "ended";
export type UnoPendingDrawType = "draw_two" | "draw_four" | null;

// Shape returned by get-uno-state — NOT the raw table row (the raw
// uno_sessions row has no draw_pile/discard_pile at all; those live in
// uno_deck_state, which the frontend never queries directly — see
// 0011_uno.sql for why).
export type UnoSessionPublic = {
  id: string;
  status: UnoSessionStatus;
  direction: 1 | -1;
  current_turn_user_id: string | null;
  current_color: UnoColor | null;
  drawn_this_turn: boolean;
  discard_top: UnoCard | null;
  draw_pile_count: number;
  pending_draw: number;
  pending_draw_type: UnoPendingDrawType;
  pending_draw_from_user_id: string | null;
  state_version: number;
  winner_id: string | null;
};

export type UnoParticipant = {
  user_id: string;
  seat_order: number;
  hand_count: number;
  has_called_uno: boolean;
  finished_at: string | null;
  finish_rank: number | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

// --- Realtime broadcast payload shapes (uno-session-{id} channel) ---

export type UnoSessionEvent =
  | { type: "game_started"; starter: UnoCard; current_turn_user_id: string }
  | {
      type: "card_played";
      user_id: string;
      card: UnoCard;
      jump_in: boolean;
      effect: UnoCardValue;
      next_turn_user_id: string;
      current_color: UnoColor;
      pending_draw: number;
      pending_draw_type: UnoPendingDrawType;
      hand_count: number;
      called_uno: boolean;
    }
  | { type: "card_drawn"; user_id: string; count: number; forced: false; next_turn_user_id: string }
  | { type: "forced_draw"; user_id: string; count: number; forced: true; next_turn_user_id: string }
  | { type: "turn_passed"; user_id: string; next_turn_user_id: string }
  | { type: "uno_caught"; caught_user_id: string; caught_by_user_id: string; penalty: number }
  | { type: "challenge_resolved"; success: boolean; accused_user_id: string; penalty_to: string; penalty: number }
  | { type: "game_ended"; winner_user_id: string; card: UnoCard }
  | { type: "session_ended" };

// =========================================================
// Impostor WHO?
// Keep in sync with supabase/migrations/0012_impostor.sql
// =========================================================

export type ImpostorSessionStatus = "lobby" | "clue_giving" | "voting" | "ended";
export type ImpostorWinner = "crew" | "impostor";

export type ImpostorCategory = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
  word_count?: number;
};

export type ImpostorWord = {
  id: string;
  category_id: string;
  word: string;
  created_at: string;
  archived_at: string | null;
};

// Shape returned by get-impostor-state — NOT the raw table row. Mirrors
// get-uno-state: the raw impostor_sessions row is actually safe to read
// directly (revealed_* stay null until a real outcome), but this shape is
// what every page actually renders against.
export type ImpostorSessionPublic = {
  id: string;
  status: ImpostorSessionStatus;
  category_name: string;
  round_number: number;
  turn_index: number;
  round_set_starter_user_id: string | null;
  current_turn_user_id: string | null;
  clue_deadline_ms: number | null;
  vote_round: 1 | 2 | null;
  vote_deadline_ms: number | null;
  winner: ImpostorWinner | null;
  completed: boolean;
  revealed_impostor_user_id: string | null;
  revealed_secret_word: string | null;
  state_version: number;
};

export type ImpostorParticipant = {
  user_id: string;
  seat_order: number;
  profiles: { username: string; avatar_url: string | null } | null;
};

// A player's own card — never anyone else's (impostor_cards RLS is "read
// own row only"). `word` is null for the impostor.
export type ImpostorCard = {
  is_impostor: boolean;
  word: string | null;
  category_name: string;
};

// One entry on the public clue board.
export type ImpostorClue = {
  round_number: number;
  user_id: string;
  clue_text: string;
  timed_out: boolean;
};

// Final tally for a resolved vote round — broadcast only, not persisted
// beyond the event (the game either moves on to a fresh round-set or ends,
// so there's nothing later that needs to re-read an old tally).
export type ImpostorVoteTally = { user_id: string; count: number };

// --- Realtime broadcast payload shapes (impostor-session-{id} channel) ---

export type ImpostorSessionEvent =
  | { type: "game_started"; round_number: 1; starter_user_id: string; category_name: string }
  | {
      type: "clue_submitted";
      round_number: number;
      user_id: string;
      clue_text: string;
      timed_out: boolean;
      next_turn_user_id: string | null; // null when this clue completed round 2 of a set (voting starts next)
      clue_deadline_ms: number | null;
    }
  | { type: "voting_started"; vote_round: 1 | 2; deadline_ms: number }
  | { type: "vote_cast"; voted_count: number; total_count: number } // never includes who voted for whom
  | {
      type: "vote_resolved";
      vote_round: 1 | 2;
      tally: ImpostorVoteTally[];
      accused_user_id: string | null; // null if the vote was a tie/no plurality
      outcome: "continue" | "crew_win" | "impostor_win";
    }
  | { type: "next_round_set_started"; round_number: 3; starter_user_id: string }
  | { type: "game_ended"; winner: ImpostorWinner; impostor_user_id: string; secret_word: string }
  | { type: "session_ended" };
