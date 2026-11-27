// daily-puzzle
// Debbie's Daily Puzzle: one five-letter word a day, the same for everyone, six guesses.
//   { action: "status" }                        -> where the caller's puzzle for today stands
//   { action: "guess", puzzle_date, guess }     -> submit one guess (graded in the database)
//
// The answer and the word list never leave the database. The browser gets the marks for
// its own guesses, and the answer only once its own attempt is over.
//
// Day: community_today() (Asia/Manila). The browser says which day its screen is playing;
// if that day has ended the guess is refused ("closed") and the screen reloads.
//
// Rewards: when an attempt is finished this function asks grant_reward() for
//   puzzle_finished  (source key daily:puzzle:<date>:finished)   every finished attempt
//   puzzle_solved    (source key daily:puzzle:<date>:solved)     only if solved
// Amounts, caps and the on/off switch live in reward_rules / earning_settings. grant_reward
// is idempotent per source key, so asking again on every status call also repairs a finish
// whose payout failed the first time. A payout failure never loses the puzzle result.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
} from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

type RewardResult = {
  status: string; // granted | capped | duplicate | disabled | no_rule | not_member
  xp: number;
  deskbits: number;
  payout?: string;
};

type PuzzleState = {
  puzzle_date: string;
  status: "not_started" | "in_progress" | "solved" | "unsolved";
  guess_count: number;
  max_guesses: number;
  guesses: { guess: string; marks: string }[];
  answer?: string | null;
};

async function grant(admin: Admin, userId: string, eventType: string, date: string, suffix: string): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_event_type: eventType,
    p_source_key: `daily:puzzle:${date}:${suffix}`,
    p_meta: { game: "daily_puzzle", puzzle_date: date },
  });
  if (error) {
    console.error(`daily-puzzle: grant_reward ${eventType} failed:`, error);
    return null;
  }
  return data as RewardResult;
}

/** Pay (or re-confirm) the rewards for a finished attempt and total what was actually paid. */
async function payFinished(admin: Admin, userId: string, date: string, solved: boolean) {
  const finished = await grant(admin, userId, "puzzle_finished", date, "finished");
  const solvedReward = solved ? await grant(admin, userId, "puzzle_solved", date, "solved") : null;
  const parts = [finished, solvedReward].filter((r): r is RewardResult => r !== null);
  if (parts.length === 0) return null;
  return {
    xp: parts.reduce((n, r) => n + (r.xp ?? 0), 0),
    deskbits: parts.reduce((n, r) => n + (r.deskbits ?? 0), 0),
    statuses: parts.map((r) => r.status),
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "status" && action !== "guess") {
      return jsonResponse({ error: "action must be 'status' or 'guess'" }, 400);
    }

    const admin = getAdminClient();

    if (action === "guess") {
      const puzzleDate = typeof body?.puzzle_date === "string" ? body.puzzle_date : "";
      const guess = typeof body?.guess === "string" ? body.guess : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
        return jsonResponse({ error: "puzzle_date must be YYYY-MM-DD" }, 400);
      }
      if (guess.length > 20) return jsonResponse({ result: "invalid" });

      const { data, error } = await admin.rpc("daily_puzzle_guess", {
        p_user_id: user.id,
        p_puzzle_date: puzzleDate,
        p_guess: guess,
      });
      if (error) throw error;

      const out = data as { result: string; status?: string };
      if (out.result === "ok" && (out.status === "solved" || out.status === "unsolved")) {
        const reward = await payFinished(admin, user.id, puzzleDate, out.status === "solved");
        return jsonResponse({ ...out, reward });
      }
      return jsonResponse(out);
    }

    // status
    const { data, error } = await admin.rpc("daily_puzzle_state", { p_user_id: user.id });
    if (error) throw error;
    const state = data as PuzzleState;

    let reward = null;
    if (state.status === "solved" || state.status === "unsolved") {
      // Idempotent: confirms what was paid, or repairs a payout that failed earlier.
      reward = await payFinished(admin, user.id, state.puzzle_date, state.status === "solved");
    }
    return jsonResponse({ ...state, reward });
  } catch (err) {
    console.error("daily-puzzle failed:", err);
    return jsonResponse({ error: "Could not process the daily puzzle" }, 500);
  }
});
