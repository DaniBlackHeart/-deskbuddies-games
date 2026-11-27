// daily-word-search
// Debbie's Daily Word Search ("Word Hunt" on screen): one 10x10 grid a day, the same for everyone, 8 hidden
// words, five minutes from Start, one attempt, ranked later by fastest solve.
//   { action: "status" }                                      -> where the caller's grid stands
//   { action: "start",   search_date }                        -> press Start: the five-minute clock begins
//   { action: "find",    search_date, start, end }            -> the member picked the first and last cell (0-99)
//   { action: "give_up", search_date }                        -> end the attempt as unsolved
//
// The grid is released only after Start, and where the words are only after the attempt is over. Each pick is
// checked in the database (see 0058). The browser never says how long it took.
//
// Rewards: once an attempt is finished this function asks grant_reward() for
//   daily_word_search_finished  (source key daily:wordsearch:<date>:finished)  every finished attempt
//   daily_word_search_solved    (source key daily:wordsearch:<date>:solved)    only if solved
// grant_reward is idempotent per source key, so asking again on every status call also repairs a payout
// that failed the first time. A payout failure never loses the result.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
type RewardResult = { status: string; xp: number; deskbits: number; payout?: string };
type SearchState = { search_date: string; status: string; [k: string]: unknown };

async function grant(admin: Admin, userId: string, eventType: string, date: string, suffix: string): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_event_type: eventType,
    p_source_key: `daily:wordsearch:${date}:${suffix}`,
    p_meta: { game: "daily_word_search", search_date: date },
  });
  if (error) {
    console.error(`daily-word-search: grant_reward ${eventType} failed:`, error);
    return null;
  }
  return data as RewardResult;
}

async function withReward(admin: Admin, userId: string, state: SearchState) {
  if (state.status !== "solved" && state.status !== "unsolved") return state;
  const finished = await grant(admin, userId, "daily_word_search_finished", state.search_date, "finished");
  const solved = state.status === "solved" ? await grant(admin, userId, "daily_word_search_solved", state.search_date, "solved") : null;
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

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "status" && action !== "start" && action !== "find" && action !== "give_up") {
      return jsonResponse({ error: "action must be 'status', 'start', 'find' or 'give_up'" }, 400);
    }
    const admin = getAdminClient();

    if (action === "status") {
      const { data, error } = await admin.rpc("daily_word_search_state", { p_user_id: user.id });
      if (error) throw error;
      return jsonResponse(await withReward(admin, user.id, data as SearchState));
    }

    const date = typeof body?.search_date === "string" ? body.search_date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: "search_date must be YYYY-MM-DD" }, 400);

    // Another tab may already have finished it: show the truth.
    const stateNow = async (result: string) => {
      const { data, error } = await admin.rpc("daily_word_search_state", { p_user_id: user.id });
      if (error) throw error;
      return jsonResponse({ result, ...(await withReward(admin, user.id, data as SearchState)) });
    };

    if (action === "start") {
      const { data, error } = await admin.rpc("daily_word_search_start", { p_user_id: user.id, p_date: date });
      if (error) throw error;
      const out = data as { result: string } & SearchState;
      if (out.result !== "ok") return jsonResponse({ result: out.result });
      return jsonResponse(await withReward(admin, user.id, out));
    }

    if (action === "give_up") {
      const { data, error } = await admin.rpc("daily_word_search_give_up", { p_user_id: user.id, p_date: date });
      if (error) throw error;
      const out = data as { result: string } & SearchState;
      if (out.result === "ok") return jsonResponse(await withReward(admin, user.id, out));
      if (out.result === "finished" || out.result === "not_started") return await stateNow(out.result);
      return jsonResponse({ result: out.result }); // closed
    }

    // find
    const start = body?.start;
    const end = body?.end;
    if (!Number.isInteger(start) || start < 0 || start > 99 || !Number.isInteger(end) || end < 0 || end > 99) {
      return jsonResponse({ result: "invalid" });
    }
    const { data, error } = await admin.rpc("daily_word_search_find", { p_user_id: user.id, p_date: date, p_start: start, p_end: end });
    if (error) throw error;
    const out = data as { result: string } & Partial<SearchState>;
    if ((out.result === "found" || out.result === "time_up") && out.status) {
      return jsonResponse(await withReward(admin, user.id, out as SearchState));
    }
    if (out.result === "finished" || out.result === "not_started") return await stateNow(out.result);
    return jsonResponse(out); // miss | already | invalid | closed
  } catch (err) {
    console.error("daily-word-search failed:", err);
    return jsonResponse({ error: "Could not process the daily word search" }, 500);
  }
});
