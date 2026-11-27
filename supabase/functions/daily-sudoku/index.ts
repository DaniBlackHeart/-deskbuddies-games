// daily-sudoku
// Debbie's Daily Sudoku ("Number Nook" on screen): one 9x9 grid a day, the same for everyone, one attempt,
// five mistakes allowed, ranked later by fastest solve.
//   { action: "status" }                                     -> where the caller's grid stands
//   { action: "start",   sudoku_date }                       -> press Start: the clock begins
//   { action: "place",   sudoku_date, cell (0-80), digit }   -> put a number in a cell
//   { action: "give_up", sudoku_date }                       -> end the attempt as unsolved
//
// The grid is released only after Start and the solution only after the attempt is over. Every number is
// checked against the real solution in the database (see 0056). The browser never says how long it took.
//
// Rewards: once an attempt is finished this function asks grant_reward() for
//   daily_sudoku_finished  (source key daily:sudoku:<date>:finished)  every finished attempt
//   daily_sudoku_solved    (source key daily:sudoku:<date>:solved)    only if solved
// grant_reward is idempotent per source key, so asking again on every status call also repairs a payout
// that failed the first time. A payout failure never loses the result.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
type RewardResult = { status: string; xp: number; deskbits: number; payout?: string };
type SudokuState = { sudoku_date: string; status: string; [k: string]: unknown };

async function grant(admin: Admin, userId: string, eventType: string, date: string, suffix: string): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_event_type: eventType,
    p_source_key: `daily:sudoku:${date}:${suffix}`,
    p_meta: { game: "daily_sudoku", sudoku_date: date },
  });
  if (error) {
    console.error(`daily-sudoku: grant_reward ${eventType} failed:`, error);
    return null;
  }
  return data as RewardResult;
}

async function withReward(admin: Admin, userId: string, state: SudokuState) {
  if (state.status !== "solved" && state.status !== "unsolved") return state;
  const finished = await grant(admin, userId, "daily_sudoku_finished", state.sudoku_date, "finished");
  const solved = state.status === "solved" ? await grant(admin, userId, "daily_sudoku_solved", state.sudoku_date, "solved") : null;
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
    if (action !== "status" && action !== "start" && action !== "place" && action !== "give_up") {
      return jsonResponse({ error: "action must be 'status', 'start', 'place' or 'give_up'" }, 400);
    }
    const admin = getAdminClient();

    if (action === "status") {
      const { data, error } = await admin.rpc("daily_sudoku_state", { p_user_id: user.id });
      if (error) throw error;
      return jsonResponse(await withReward(admin, user.id, data as SudokuState));
    }

    const date = typeof body?.sudoku_date === "string" ? body.sudoku_date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: "sudoku_date must be YYYY-MM-DD" }, 400);

    // Another tab may already have finished it: show the truth.
    const stateNow = async (result: string) => {
      const { data, error } = await admin.rpc("daily_sudoku_state", { p_user_id: user.id });
      if (error) throw error;
      return jsonResponse({ result, ...(await withReward(admin, user.id, data as SudokuState)) });
    };

    if (action === "start") {
      const { data, error } = await admin.rpc("daily_sudoku_start", { p_user_id: user.id, p_date: date });
      if (error) throw error;
      const out = data as { result: string } & SudokuState;
      if (out.result !== "ok") return jsonResponse({ result: out.result });
      return jsonResponse(await withReward(admin, user.id, out));
    }

    if (action === "give_up") {
      const { data, error } = await admin.rpc("daily_sudoku_give_up", { p_user_id: user.id, p_date: date });
      if (error) throw error;
      const out = data as { result: string } & SudokuState;
      if (out.result === "ok") return jsonResponse(await withReward(admin, user.id, out));
      if (out.result === "finished" || out.result === "not_started") return await stateNow(out.result);
      return jsonResponse({ result: out.result }); // closed
    }

    // place
    const cell = body?.cell;
    const digit = body?.digit;
    if (!Number.isInteger(cell) || cell < 0 || cell > 80 || !Number.isInteger(digit) || digit < 1 || digit > 9) {
      return jsonResponse({ result: "invalid" });
    }
    const { data, error } = await admin.rpc("daily_sudoku_place", { p_user_id: user.id, p_date: date, p_cell: cell, p_digit: digit });
    if (error) throw error;
    const out = data as { result: string } & Partial<SudokuState>;
    if ((out.result === "ok" || out.result === "wrong") && out.status) {
      return jsonResponse(await withReward(admin, user.id, out as SudokuState));
    }
    if (out.result === "finished" || out.result === "not_started") return await stateNow(out.result);
    return jsonResponse(out); // wrong (still playing, with mistakes) | given | filled | invalid | closed
  } catch (err) {
    console.error("daily-sudoku failed:", err);
    return jsonResponse({ error: "Could not process the daily sudoku" }, 500);
  }
});
