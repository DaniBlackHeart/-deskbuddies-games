// daily-anagram
// Debbie's Daily Anagram ("Letter Shuffle" on screen): one long scrambled word a day, the same for
// everyone, four minutes from Start, one attempt.
//   { action: "status" }                          -> where the caller's word stands
//   { action: "start",  anagram_date }            -> press Start: the four-minute clock begins
//   { action: "guess",  anagram_date, guess }     -> submit a guess (unlimited; only the intended word counts)
//
// The scramble is released only after Start, and the answer only after the attempt is over. The
// clock and the grading are the database's (see 0054). The browser never says how long it took.
//
// Rewards: once an attempt is finished this function asks grant_reward() for
//   daily_anagram_finished  (source key daily:anagram:<date>:finished)  every finished attempt
//   daily_anagram_solved    (source key daily:anagram:<date>:solved)    only if solved
// grant_reward is idempotent per source key, so asking again on every status call also repairs a
// payout that failed the first time. A payout failure never loses the result.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
type RewardResult = { status: string; xp: number; deskbits: number; payout?: string };
type AnagramState = { anagram_date: string; status: string; [k: string]: unknown };

async function grant(admin: Admin, userId: string, eventType: string, date: string, suffix: string): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_event_type: eventType,
    p_source_key: `daily:anagram:${date}:${suffix}`,
    p_meta: { game: "daily_anagram", anagram_date: date },
  });
  if (error) {
    console.error(`daily-anagram: grant_reward ${eventType} failed:`, error);
    return null;
  }
  return data as RewardResult;
}

async function withReward(admin: Admin, userId: string, state: AnagramState) {
  if (state.status !== "solved" && state.status !== "unsolved") return state;
  const finished = await grant(admin, userId, "daily_anagram_finished", state.anagram_date, "finished");
  const solved = state.status === "solved" ? await grant(admin, userId, "daily_anagram_solved", state.anagram_date, "solved") : null;
  const parts = [finished, solved].filter((r): r is RewardResult => r !== null);
  if (parts.length === 0) return state;
  return {
    ...state,
    reward: {
      xp: parts.reduce((n, r) => n + (r.xp ?? 0), 0),
      deskbits: parts.reduce((n, r) => n + (r.deskbits ?? 0), 0),
      statuses: parts.map((r) => r.status),
    },
  };
}


/** The day's level (Easy / Medium / Hard) for the page title. A missing level never blocks play. */
async function withLevel<T extends { [k: string]: unknown }>(admin: Admin, game: string, date: unknown, state: T): Promise<T & { difficulty?: string }> {
  if (typeof date !== "string") return state;
  const { data, error } = await admin.rpc("daily_game_level", { p_game: game, p_date: date });
  if (error || typeof data !== "string") return state;
  return { ...state, difficulty: data };
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
    if (action !== "status" && action !== "start" && action !== "guess") {
      return jsonResponse({ error: "action must be 'status', 'start' or 'guess'" }, 400);
    }
    const admin = getAdminClient();

    if (action === "status") {
      const { data, error } = await admin.rpc("daily_anagram_state", { p_user_id: user.id });
      if (error) throw error;
      { const s = await withReward(admin, user.id, data as AnagramState); return jsonResponse(await withLevel(admin, "anagram", s.anagram_date, s)); }
    }

    const date = typeof body?.anagram_date === "string" ? body.anagram_date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: "anagram_date must be YYYY-MM-DD" }, 400);

    if (action === "start") {
      const { data, error } = await admin.rpc("daily_anagram_start", { p_user_id: user.id, p_date: date });
      if (error) throw error;
      const out = data as { result: string } & AnagramState;
      if (out.result !== "ok") return jsonResponse({ result: out.result });
      { const s = await withReward(admin, user.id, out); return jsonResponse(await withLevel(admin, "anagram", s.anagram_date, s)); }
    }

    // guess
    const guess = typeof body?.guess === "string" ? body.guess : "";
    if (guess.length === 0 || guess.length > 20) return jsonResponse({ result: "wrong_letters" });
    const { data, error } = await admin.rpc("daily_anagram_guess", { p_user_id: user.id, p_date: date, p_guess: guess });
    if (error) throw error;
    const out = data as { result: string } & Partial<AnagramState>;
    if (out.result === "ok") return jsonResponse(await withReward(admin, user.id, out as AnagramState));
    if (out.result === "finished" || out.result === "not_started") {
      // another tab already finished it: show the truth
      const { data: s, error: e2 } = await admin.rpc("daily_anagram_state", { p_user_id: user.id });
      if (e2) throw e2;
      return jsonResponse({ result: out.result, ...(await withReward(admin, user.id, s as AnagramState)) });
    }
    return jsonResponse(out); // closed | wrong | wrong_letters
  } catch (err) {
    console.error("daily-anagram failed:", err);
    return jsonResponse({ error: "Could not process the daily anagram" }, 500);
  }
});
