// rebus-play
// Member-facing actions for "Type What You See": self-service team
// management (mirrors wheel-play's create_team/join_team/leave_team) plus
// answer submission for rounds 1-3, the Final Round, and the Sprint.
// Grading always happens here, server-side, with the service-role client —
// the browser never sees answer_text/accepted_answers before a puzzle is
// revealed.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  typedAnswerMatches,
  resolveWrongPenalty,
  REBUS_SPEED_BONUS,
  REBUS_SPRINT_POINTS,
} from "../_shared/utils.ts";

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`rebus-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const admin = getAdminClient();

  try {
    const body = await req.json();
    const { action, session_id } = body;

    switch (action) {
      case "create_team": {
        const { name } = body;
        if (!name || !String(name).trim()) return jsonResponse({ error: "Give the team a name" }, 400);

        const { data: session } = await admin.from("rebus_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.game_mode !== "team") return jsonResponse({ error: "This session isn't in team mode" }, 409);
        if (session.status !== "lobby") return jsonResponse({ error: "Teams can only be set up before the game starts" }, 409);

        const { data: team, error } = await admin
          .from("rebus_teams")
          .insert({ session_id, name: String(name).trim() })
          .select()
          .single();

        if (error) {
          return jsonResponse({ error: error.code === "23505" ? "A team with that name already exists" : "Could not create the team" }, 400);
        }

        await admin
          .from("rebus_participants")
          .upsert({ session_id, user_id: user.id, team_id: team.id }, { onConflict: "session_id,user_id" });

        return jsonResponse({ team });
      }

      case "join_team": {
        const { team_id } = body;
        const { data: session } = await admin.from("rebus_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.game_mode !== "team") return jsonResponse({ error: "This session isn't in team mode" }, 409);
        if (session.status !== "lobby") return jsonResponse({ error: "Teams can only be changed before the game starts" }, 409);

        const { data: team } = await admin.from("rebus_teams").select("id").eq("id", team_id).eq("session_id", session_id).maybeSingle();
        if (!team) return jsonResponse({ error: "That team doesn't exist" }, 404);

        await admin
          .from("rebus_participants")
          .upsert({ session_id, user_id: user.id, team_id }, { onConflict: "session_id,user_id" });

        return jsonResponse({ ok: true });
      }

      case "leave_team": {
        await admin
          .from("rebus_participants")
          .update({ team_id: null })
          .eq("session_id", session_id)
          .eq("user_id", user.id);
        return jsonResponse({ ok: true });
      }

      case "submit_answer": {
        const { puzzle_id, answer_text, response_ms } = body;
        if (!puzzle_id || typeof answer_text !== "string" || !answer_text.trim()) {
          return jsonResponse({ error: "puzzle_id and answer_text are required" }, 400);
        }

        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);

        const isMainRound = session.status === "live";
        const isFinalRound = session.status === "final_live";
        if (!isMainRound && !isFinalRound) {
          return jsonResponse({ error: "This puzzle isn't accepting answers right now" }, 409);
        }

        if (isFinalRound) {
          if (puzzle_id !== session.final_puzzle_id) return jsonResponse({ error: "That's not the current puzzle" }, 400);
          if (user.id !== session.final_player_id) return jsonResponse({ error: "Only the finalist can answer this one" }, 403);
        }

        const { data: puzzle } = await admin
          .from("rebus_session_puzzles")
          .select("*")
          .eq("id", puzzle_id)
          .eq("session_id", session_id)
          .single();
        if (!puzzle) return jsonResponse({ error: "Puzzle not found" }, 404);

        if (isMainRound) {
          const puzzles = await admin
            .from("rebus_session_puzzles")
            .select("id")
            .eq("session_id", session_id)
            .neq("round", "final")
            .order("order_index", { ascending: true });
          const currentPuzzleId = (puzzles.data ?? [])[session.current_puzzle_index]?.id;
          if (currentPuzzleId !== puzzle_id) return jsonResponse({ error: "That's not the current puzzle" }, 400);
        }

        if (session.puzzle_started_at) {
          const deadline = new Date(session.puzzle_started_at).getTime() + puzzle.time_limit_seconds * 1000;
          if (Date.now() > deadline + 1500) {
            return jsonResponse({ error: "Time's up for this puzzle" }, 409);
          }
        }

        const { data: existing } = await admin
          .from("rebus_answers")
          .select("id")
          .eq("session_id", session_id)
          .eq("puzzle_id", puzzle_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) return jsonResponse({ error: "You already answered this puzzle" }, 409);

        if (isMainRound) {
          await admin.from("rebus_participants").upsert({ session_id, user_id: user.id }, { onConflict: "session_id,user_id" });
        }

        const accepted = [puzzle.answer_text, ...((puzzle.accepted_answers as string[]) ?? [])];
        const isCorrect = typedAnswerMatches(answer_text, accepted);
        const pointsAwarded = isCorrect
          ? puzzle.points + REBUS_SPEED_BONUS
          : session.mode === "hard"
          ? -resolveWrongPenalty(puzzle)
          : 0;

        const { error: insertError } = await admin.from("rebus_answers").insert({
          session_id,
          puzzle_id,
          user_id: user.id,
          answer_text: answer_text.trim(),
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
          response_ms: response_ms ?? 0,
        });

        if (insertError) {
          console.error("rebus answer insert failed", insertError);
          return jsonResponse({ error: "Could not save your answer" }, 500);
        }

        return jsonResponse({ is_correct: isCorrect, points_awarded: pointsAwarded });
      }

      case "submit_sprint_answer": {
        const { answer_text } = body;
        if (typeof answer_text !== "string" || !answer_text.trim()) {
          return jsonResponse({ error: "answer_text is required" }, 400);
        }

        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);

        let slot: 1 | 2;
        if (session.status === "sprint_p1" && user.id === session.sprint_player1_id) slot = 1;
        else if (session.status === "sprint_p2" && user.id === session.sprint_player2_id) slot = 2;
        else return jsonResponse({ error: "It's not your turn to sprint right now" }, 409);

        const deadline = slot === 1 ? session.sprint_p1_deadline : session.sprint_p2_deadline;
        if (deadline && Date.now() > new Date(deadline).getTime() + 500) {
          return jsonResponse({ error: "Time's up!" }, 409);
        }

        const currentIndex = slot === 1 ? session.sprint_p1_index : session.sprint_p2_index;

        const { data: puzzle } = await admin
          .from("rebus_session_sprint_puzzles")
          .select("*")
          .eq("session_id", session_id)
          .eq("order_index", currentIndex)
          .maybeSingle();

        if (!puzzle) {
          return jsonResponse({ done: true, message: "You've cleared the whole pool — nice work!" });
        }

        const accepted = [puzzle.answer_text, ...((puzzle.accepted_answers as string[]) ?? [])];
        const isCorrect = typedAnswerMatches(answer_text, accepted);
        const pointsAwarded = isCorrect ? REBUS_SPRINT_POINTS : 0;

        await admin.from("rebus_sprint_answers").insert({
          session_id,
          user_id: user.id,
          player_slot: slot,
          puzzle_index: currentIndex,
          answer_text: answer_text.trim(),
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
        });

        const pointsField = slot === 1 ? "sprint_p1_points" : "sprint_p2_points";
        const indexField = slot === 1 ? "sprint_p1_index" : "sprint_p2_index";
        const newPoints = (slot === 1 ? session.sprint_p1_points : session.sprint_p2_points) + pointsAwarded;
        const newIndex = currentIndex + 1;

        await admin
          .from("rebus_sessions")
          .update({ [pointsField]: newPoints, [indexField]: newIndex })
          .eq("id", session_id);

        await broadcast(admin, session_id, "sprint_progress", { player_slot: slot, points: newPoints, attempted: newIndex });

        const { data: nextPuzzle } = await admin
          .from("rebus_session_sprint_puzzles")
          .select("display_text")
          .eq("session_id", session_id)
          .eq("order_index", newIndex)
          .maybeSingle();

        return jsonResponse({
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
          total_points: newPoints,
          next_puzzle: nextPuzzle ? { display_text: nextPuzzle.display_text } : null,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("rebus-play crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
