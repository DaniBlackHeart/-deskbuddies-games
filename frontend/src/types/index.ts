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
  time_limit_seconds: number;
};

// Public-safe question shape sent to players during a live question —
// NEVER includes correct_choice or accepted_answers.
export type PublicQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: string[] | null;
  points: number;
  time_limit_seconds: number;
  order_index: number;
  total_questions: number;
};

export type SessionStatus = "draft" | "lobby" | "live" | "grading" | "ended";

export type TriviaSession = {
  id: string;
  question_set_id: string;
  host_id: string;
  status: SessionStatus;
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
  | { type: "lobby_update"; participant_count: number }
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
  | { type: "session_ended"; leaderboard: LeaderboardEntry[] };
