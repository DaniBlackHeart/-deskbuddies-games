// daily-trivia
// Debbie's Daily Trivia: one question a day, the same for everyone, one minute, one attempt.
//   { action: "status" }                                         -> where the caller's question stands
//   { action: "start",  trivia_date }                            -> press Start: the one-minute clock begins
//   { action: "answer", trivia_date, choice_index? | answer_text? } -> submit the answer
//
// The question text is released only after Start, and the right answer only after the attempt
// is over. The clock is the database's (see 0052): leaving the page does not pause it, and an
// answer that arrives too late counts as timed out. Typed answers are matched exactly like
// Trivia Night (case, accents and punctuation ignored).
//
// Rewards: once an attempt is finished this function asks grant_reward() for
//   daily_trivia_finished  (source key daily:trivia:<date>:finished)  every finished attempt
//   daily_trivia_correct   (source key daily:trivia:<date>:correct)   only if correct
// Amounts and the on/off switch live in reward_rules / earning_settings. grant_reward is
// idempotent per source key, so asking again on every status call also repairs a payout that
// failed the first time. A payout failure never loses the result.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  typedAnswerMatches,
} from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

type RewardResult = { status: string; xp: number; deskbits: number; payout?: string };
type TriviaState = { trivia_date: string; status: string; [k: string]: unknown };

const FINISHED = new Set(["correct", "incorrect", "timed_out"]);

async function grant(admin: Admin, userId: string, eventType: string, date: string, suffix: string): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_event_type: eventType,
    p_source_key: `daily:trivia:${date}:${suffix}`,
    p_meta: { game: "daily_trivia", trivia_date: date },
  });
  if (error) {
    console.error(`daily-trivia: grant_reward ${eventType} failed:`, error);
    return null;
  }
  return data as RewardResult;
}

async function payFinished(admin: Admin, userId: string, date: string, correct: boolean) {
  const finished = await grant(admin, userId, "daily_trivia_finished", date, "finished");
  const right = correct ? await grant(admin, userId, "daily_trivia_correct", date, "correct") : null;
  const parts = [finished, right].filter((r): r is RewardResult => r !== null);
  if (parts.length === 0) return null;
  return {
    xp: parts.reduce((n, r) => n + (r.xp ?? 0), 0),
    deskbits: parts.reduce((n, r) => n + (r.deskbits ?? 0), 0),
    statuses: parts.map((r) => r.status),
  };
}

/** Adds the reward (and repairs a missed payout) when the state is a finished one. */
async function withReward(admin: Admin, userId: string, state: TriviaState) {
  if (!FINISHED.has(state.status)) return state;
  const reward = await payFinished(admin, userId, state.trivia_date, state.status === "correct");
  return { ...state, reward };
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
    if (action !== "status" && action !== "start" && action !== "answer") {
      return jsonResponse({ error: "action must be 'status', 'start' or 'answer'" }, 400);
    }
    const admin = getAdminClient();

    if (action === "status") {
      const { data, error } = await admin.rpc("daily_trivia_state", { p_user_id: user.id });
      if (error) throw error;
      return jsonResponse(await withReward(admin, user.id, data as TriviaState));
    }

    const date = typeof body?.trivia_date === "string" ? body.trivia_date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: "trivia_date must be YYYY-MM-DD" }, 400);

    if (action === "start") {
      const { data, error } = await admin.rpc("daily_trivia_start", { p_user_id: user.id, p_date: date });
      if (error) throw error;
      const out = data as { result: string } & TriviaState;
      if (out.result !== "ok") return jsonResponse({ result: out.result });
      return jsonResponse(await withReward(admin, user.id, out));
    }

    // answer
    const { data: keyData, error: keyErr } = await admin.rpc("daily_trivia_answer_key", { p_user_id: user.id, p_date: date });
    if (keyErr) throw keyErr;
    const key = keyData as {
      result: string;
      type?: string;
      choice_count?: number;
      correct_choice?: number;
      accepted_answers?: string[];
    };

    if (key.result !== "ok") {
      // closed / not started / already finished (or time ran out): show the truth, never grade.
      if (key.result === "closed") return jsonResponse({ result: "closed" });
      const { data, error } = await admin.rpc("daily_trivia_state", { p_user_id: user.id });
      if (error) throw error;
      return jsonResponse({ result: key.result, ...(await withReward(admin, user.id, data as TriviaState)) });
    }

    let outcome: "correct" | "incorrect";
    let choice: number | null = null;
    let text: string | null = null;
    if (key.type === "multiple_choice") {
      const idx = body?.choice_index;
      if (!Number.isInteger(idx) || idx < 0 || idx >= (key.choice_count ?? 0)) {
        return jsonResponse({ error: "choice_index is not one of the choices" }, 400);
      }
      choice = idx;
      outcome = idx === key.correct_choice ? "correct" : "incorrect";
    } else {
      const t = body?.answer_text;
      if (typeof t !== "string" || t.trim() === "" || t.length > 200) {
        return jsonResponse({ error: "answer_text is required (up to 200 characters)" }, 400);
      }
      text = t.trim();
      outcome = typedAnswerMatches(text, key.accepted_answers ?? []) ? "correct" : "incorrect";
    }

    const { data, error } = await admin.rpc("daily_trivia_finish", {
      p_user_id: user.id,
      p_date: date,
      p_outcome: outcome,
      p_choice: choice,
      p_text: text,
    });
    if (error) throw error;
    const out = data as { result: string } & TriviaState;
    if (out.result === "closed") return jsonResponse({ result: "closed" });
    if (out.result !== "ok") {
      // someone else (another tab) finished it first
      const { data: s, error: e2 } = await admin.rpc("daily_trivia_state", { p_user_id: user.id });
      if (e2) throw e2;
      return jsonResponse({ result: "finished", ...(await withReward(admin, user.id, s as TriviaState)) });
    }
    return jsonResponse(await withReward(admin, user.id, out));
  } catch (err) {
    console.error("daily-trivia failed:", err);
    return jsonResponse({ error: "Could not process the daily trivia" }, 500);
  }
});
