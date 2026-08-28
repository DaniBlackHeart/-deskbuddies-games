// get-rebus-state
// Hydrates a member's (or spectator's) "Type What You See" play page on
// load/refresh — realtime broadcasts from rebus-host/rebus-play handle
// live updates after that. One function covers every phase of the format
// (rounds 1-3, the Sprint, the Final Round) since they all share a single
// session row and a single realtime channel.
//
// Anti-cheat notes:
//  - Rounds 1-3 / Final Round: answer_text/accepted_answers are only ever
//    included once the puzzle is in "reveal" (or "final_reveal").
//  - Sprint: puzzle content is only ever included for the ACTIVE sprint
//    player, on their own request — never broadcast, never sent to the
//    other sprint player, a spectator, or the MOD host page.
//  - Final Round is the one deliberate exception to "keep it hidden": with
//    a single entrant and no rival who benefits from seeing it, everyone
//    gets the puzzle text once it's live, so it plays as a shared moment.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  computeRebusLeaderboard,
  computeRebusTeamLeaderboard,
  resolveWrongPenalty,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json();
    const { session_id, spectator } = body;
    if (!session_id) return jsonResponse({ error: "session_id is required" }, 400);

    const admin = getAdminClient();

    const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
    if (!session) return jsonResponse({ error: "Session not found" }, 404);

    if (!spectator) {
      await admin.from("rebus_participants").upsert({ session_id, user_id: user.id }, { onConflict: "session_id,user_id" });
    }

    const leaderboard = await computeRebusLeaderboard(admin, session_id);
    const team_leaderboard = session.game_mode === "team" ? await computeRebusTeamLeaderboard(admin, session_id) : null;

    const base = {
      status: session.status,
      mode: session.mode,
      game_mode: session.game_mode,
      server_now_ms: Date.now(),
      leaderboard,
      team_leaderboard,
    };

    if (session.status === "lobby" || session.status === "round_ended") {
      return jsonResponse(base);
    }

    if (session.status === "ended") {
      return jsonResponse({ ...base, completed: session.completed });
    }

    if (session.status === "live" || session.status === "reveal") {
      const { data: puzzles } = await admin
        .from("rebus_session_puzzles")
        .select("*")
        .eq("session_id", session_id)
        .neq("round", "final")
        .order("order_index", { ascending: true });

      const puzzle = (puzzles ?? [])[session.current_puzzle_index] ?? null;
      if (!puzzle) return jsonResponse({ ...base, puzzle: null });

      const { data: existingAnswer } = await admin
        .from("rebus_answers")
        .select("answer_text, is_correct, points_awarded")
        .eq("session_id", session_id)
        .eq("puzzle_id", puzzle.id)
        .eq("user_id", user.id)
        .maybeSingle();

      const deadline_ms = session.puzzle_started_at
        ? new Date(session.puzzle_started_at).getTime() + puzzle.time_limit_seconds * 1000
        : null;

      return jsonResponse({
        ...base,
        puzzle: {
          id: puzzle.id,
          round: puzzle.round,
          puzzle_type: puzzle.puzzle_type,
          display_text: puzzle.display_text,
          points: puzzle.points,
          penalty_points: session.mode === "hard" ? resolveWrongPenalty(puzzle) : 0,
          time_limit_seconds: puzzle.time_limit_seconds,
          order_index: puzzle.order_index,
          total_puzzles: (puzzles ?? []).length,
        },
        deadline_ms,
        existing_answer: existingAnswer ?? null,
        revealed: session.status === "reveal" ? { answer_text: puzzle.answer_text, accepted_answers: puzzle.accepted_answers } : null,
      });
    }

    if (["sprint_setup", "sprint_p1", "sprint_p2", "sprint_done"].includes(session.status)) {
      const { data: playerProfiles } = await admin
        .from("profiles")
        .select("id, username")
        .in("id", [session.sprint_player1_id, session.sprint_player2_id].filter(Boolean));
      const p1 = playerProfiles?.find((p) => p.id === session.sprint_player1_id) ?? null;
      const p2 = playerProfiles?.find((p) => p.id === session.sprint_player2_id) ?? null;

      const activeSlot = session.status === "sprint_p1" ? 1 : session.status === "sprint_p2" ? 2 : null;
      const mySlot = user.id === session.sprint_player1_id ? 1 : user.id === session.sprint_player2_id ? 2 : null;

      const payload: Record<string, unknown> = {
        ...base,
        sprint_player1: p1 ? { user_id: p1.id, username: p1.username } : null,
        sprint_player2: p2 ? { user_id: p2.id, username: p2.username } : null,
        sprint_p1_points: session.sprint_p1_points,
        sprint_p2_points: session.sprint_p2_points,
        active_slot: activeSlot,
        my_slot: mySlot,
        deadline_ms: activeSlot === 1
          ? session.sprint_p1_deadline
            ? new Date(session.sprint_p1_deadline).getTime()
            : null
          : activeSlot === 2
          ? session.sprint_p2_deadline
            ? new Date(session.sprint_p2_deadline).getTime()
            : null
          : null,
      };

      // Only the active sprint player, hydrating their own screen, ever
      // gets a puzzle's actual text — see anti-cheat note at the top.
      if (mySlot && mySlot === activeSlot) {
        const currentIndex = mySlot === 1 ? session.sprint_p1_index : session.sprint_p2_index;
        const { data: puzzle } = await admin
          .from("rebus_session_sprint_puzzles")
          .select("display_text")
          .eq("session_id", session_id)
          .eq("order_index", currentIndex)
          .maybeSingle();
        payload.my_current_puzzle = puzzle ? { display_text: puzzle.display_text } : null;
        payload.my_attempted = currentIndex;
      }

      return jsonResponse(payload);
    }

    if (session.status === "final_live" || session.status === "final_reveal") {
      const { data: puzzle } = await admin.from("rebus_session_puzzles").select("*").eq("id", session.final_puzzle_id).single();
      const { data: finalistProfile } = await admin.from("profiles").select("username").eq("id", session.final_player_id).single();

      const deadline_ms = session.puzzle_started_at
        ? new Date(session.puzzle_started_at).getTime() + (puzzle?.time_limit_seconds ?? 0) * 1000
        : null;

      const { data: existingAnswer } = await admin
        .from("rebus_answers")
        .select("answer_text, is_correct, points_awarded")
        .eq("session_id", session_id)
        .eq("puzzle_id", session.final_puzzle_id)
        .eq("user_id", session.final_player_id)
        .maybeSingle();

      return jsonResponse({
        ...base,
        finalist: { user_id: session.final_player_id, username: finalistProfile?.username ?? "Unknown" },
        is_finalist: user.id === session.final_player_id,
        puzzle: puzzle
          ? {
              id: puzzle.id,
              display_text: puzzle.display_text,
              points: puzzle.points,
              time_limit_seconds: puzzle.time_limit_seconds,
            }
          : null,
        deadline_ms,
        existing_answer: existingAnswer ?? null,
        revealed:
          session.status === "final_reveal"
            ? { answer_text: puzzle?.answer_text ?? null, accepted_answers: puzzle?.accepted_answers ?? [] }
            : null,
      });
    }

    return jsonResponse(base);
  } catch (err) {
    console.error("get-rebus-state crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
