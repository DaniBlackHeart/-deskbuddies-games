// buddy-boards
// Buddy Boards (Debbie Buddy Boards design, 26-27 Nov 2026). First version: the Overall board only.
//   { action: "overall", period: "this" | "last" }
//     -> { period, month_start, hidden, rows: [{ rank, name, avatar_url, value, is_you }], you: { rank, value } | null }
// Members only (requireMember). The ranking is done in the database (buddy_board_overall), from the
// reward ledger, in Philippine time. The answer carries ONLY member-visible fields: a name, a Discord
// avatar, a Buddy XP total, a rank and a "you" flag. No user ids, balances or history. Members who
// turned off "Show me on Buddy Boards" are left out and everyone below them moves up.
//   { action: "boards", tab: "brain" | "habits" | "community", period }
//     -> { boards: [{ board, month_start, hidden, rows: [{ rank, name, avatar_url, value, value2, is_you }], you, tag }] }
//   { action: "overview", period }
//     -> { month_start, hidden, places: [{ board, rank }], stats: { focus_blocks, check_ins, quests, stickies, events } }
//   Boards live in 0067 (buddy_board_one / buddy_boards_overview), same rules as Overall.
// This function pays nothing. Placing rewards are not built (they still need Rika's yes).

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

const TABS: Record<string, string[]> = {
  brain: ["five_tiles", "minute_quiz", "letter_shuffle", "number_nook", "word_hunt"],
  habits: ["focus_days", "streaks", "quests"],
  community: ["stickies_left", "events_joined", "buddies"],
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const period = body.period === "last" ? "last" : body.period === "this" ? "this" : null;
    if (!period) return jsonResponse({ error: "bad period" }, 400);
    const admin = getAdminClient();

    if (body?.action === "boards") {
      const list = TABS[String(body.tab)];
      if (!list) return jsonResponse({ error: "bad tab" }, 400);
      const results = await Promise.all(
        list.map((b) => admin.rpc("buddy_board_one", { p_user_id: user.id, p_board: b, p_period: period })),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      return jsonResponse({ boards: results.map((r) => r.data) });
    }
    if (body?.action === "overview") {
      const { data, error } = await admin.rpc("buddy_boards_overview", { p_user_id: user.id, p_period: period });
      if (error) throw error;
      return jsonResponse(data);
    }
    if (body?.action !== "overall") return jsonResponse({ error: "unknown action" }, 400);

    const { data, error } = await admin.rpc("buddy_board_overall", { p_user_id: user.id, p_period: period });
    if (error) throw error;
    return jsonResponse(data);
  } catch {
    console.error("buddy-boards failed");
    return jsonResponse({ error: "Something went wrong." }, 500);
  }
});
