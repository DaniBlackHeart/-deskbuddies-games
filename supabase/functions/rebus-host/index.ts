// rebus-host
// All MOD-driven "Type What You See" session control lives here behind one
// endpoint, dispatched by `action` — same shape as trivia-host/feud-host.
// Every action re-verifies the caller is a MOD server-side and every state
// change that affects players is broadcast over the session's realtime
// channel.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMod,
  computeRebusLeaderboard,
  computeRebusTeamLeaderboard,
  resolveWrongPenalty,
  resolveTimeoutPenalty,
  claimSessionLock,
  releaseSessionLock,
  forceReleaseSessionLock,
  claimSpectatorSeat,
  releaseSpectatorSeat,
  pickRebusSessionPuzzles,
  pickRebusSessionSprintPuzzles,
  REBUS_SPRINT_SECONDS,
} from "../_shared/utils.ts";

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`rebus-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

function toPublicPuzzle(puzzle: any, totalPuzzles: number) {
  return {
    id: puzzle.id,
    round: puzzle.round,
    puzzle_type: puzzle.puzzle_type,
    display_text: puzzle.display_text,
    points: puzzle.points,
    time_limit_seconds: puzzle.time_limit_seconds,
    order_index: puzzle.order_index,
    total_puzzles: totalPuzzles,
  };
}

// Reads a SESSION's own puzzle snapshot (rebus_session_puzzles), not the
// authoring tables — every session's Rounds 1-3 + Final Round content was
// fixed once, at create_session, by pickRebusSessionPuzzles. See
// 0023_rebus_mixed_sessions.sql for why a snapshot instead of an FK.
async function fetchSessionMainPuzzles(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const { data } = await admin
    .from("rebus_session_puzzles")
    .select("*")
    .eq("session_id", sessionId)
    .neq("round", "final")
    .order("order_index", { ascending: true });
  return data ?? [];
}

async function fetchSessionFinalPuzzle(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const { data } = await admin
    .from("rebus_session_puzzles")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round", "final")
    .maybeSingle();
  return data ?? null;
}

/** Inserts penalty rows (Hard mode only) for anyone who never answered `puzzle` — same sweep trivia-host's end_question runs. */
async function sweepNoShows(
  admin: ReturnType<typeof getAdminClient>,
  sessionId: string,
  puzzle: any,
  mode: string,
  eligibleUserIds: string[]
) {
  if (mode !== "hard" || !puzzle) return;

  const { data: answered } = await admin
    .from("rebus_answers")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("puzzle_id", puzzle.id);

  const answeredIds = new Set((answered ?? []).map((a) => a.user_id));
  const noShows = eligibleUserIds.filter((id) => !answeredIds.has(id));
  if (noShows.length === 0) return;

  const timeoutPenalty = resolveTimeoutPenalty(puzzle);
  await admin.from("rebus_answers").upsert(
    noShows.map((userId) => ({
      session_id: sessionId,
      puzzle_id: puzzle.id,
      user_id: userId,
      answer_text: null,
      is_correct: false,
      points_awarded: -timeoutPenalty,
      response_ms: puzzle.time_limit_seconds * 1000,
    })),
    { onConflict: "session_id,puzzle_id,user_id", ignoreDuplicates: true }
  );
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMod(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const admin = getAdminClient();

  try {
    const body = await req.json();
    const { action, session_id } = body;

    switch (action) {
      case "create_session": {
        const { mode, game_mode } = body;
        const resolvedMode = mode === "hard" ? "hard" : "chill";
        const resolvedGameMode = game_mode === "team" ? "team" : "solo";

        // Mixed across every set now — see 0023_rebus_mixed_sessions.sql
        // and pickRebusSessionPuzzles for the "automatic rounds" design.
        const mainPool = await pickRebusSessionPuzzles(admin);
        if (!mainPool.some((p) => p.round !== "final")) {
          return jsonResponse({ error: "Add some puzzles to a set (Rounds 1-3) before starting a session" }, 400);
        }
        const sprintPool = await pickRebusSessionSprintPuzzles(admin);

        const sessionId = crypto.randomUUID();
        const lockError = await claimSessionLock(admin, { game: "rebus", sessionId, hostId: user.id });
        if (lockError) return lockError;

        const { data: session, error } = await admin
          .from("rebus_sessions")
          .insert({
            id: sessionId,
            host_id: user.id,
            status: "lobby",
            mode: resolvedMode,
            game_mode: resolvedGameMode,
            current_puzzle_index: -1,
          })
          .select()
          .single();

        if (error) {
          await releaseSessionLock(admin, sessionId);
          return jsonResponse({ error: "Could not create session" }, 500);
        }

        const { error: puzzlesError } = await admin
          .from("rebus_session_puzzles")
          .insert(mainPool.map((p) => ({ ...p, session_id: sessionId })));
        const { error: sprintError } =
          sprintPool.length > 0
            ? await admin.from("rebus_session_sprint_puzzles").insert(sprintPool.map((p) => ({ ...p, session_id: sessionId })))
            : { error: null };

        if (puzzlesError || sprintError) {
          console.error("rebus session pool insert failed", puzzlesError, sprintError);
          await admin.from("rebus_sessions").delete().eq("id", sessionId);
          await releaseSessionLock(admin, sessionId);
          return jsonResponse({ error: "Could not build this session's puzzle pool" }, 500);
        }

        return jsonResponse({ session });
      }

      case "start_session": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Session already started" }, 409);

        if (session.game_mode === "team") {
          const { data: teamedParticipants } = await admin
            .from("rebus_participants")
            .select("team_id")
            .eq("session_id", session_id)
            .not("team_id", "is", null);
          const teamsWithMembers = new Set((teamedParticipants ?? []).map((p) => p.team_id));
          if (teamsWithMembers.size < 2) {
            return jsonResponse({ error: "Team mode needs at least 2 teams with a member each before starting" }, 400);
          }
        }

        const { data: updated } = await admin
          .from("rebus_sessions")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("id", session_id)
          .select()
          .single();

        await broadcast(admin, session_id, "lobby_update", { started: true });
        return jsonResponse({ session: updated });
      }

      case "next_puzzle": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (!["live", "reveal"].includes(session.status)) {
          return jsonResponse({ error: `Can't advance a session that's ${session.status}` }, 409);
        }

        const puzzles = await fetchSessionMainPuzzles(admin, session_id);
        const nextIndex = session.current_puzzle_index + 1;

        if (nextIndex >= puzzles.length) {
          const leaderboard = await computeRebusLeaderboard(admin, session_id);
          const teamLeaderboard =
            session.game_mode === "team" ? await computeRebusTeamLeaderboard(admin, session_id) : null;
          await admin.from("rebus_sessions").update({ status: "round_ended" }).eq("id", session_id);
          await broadcast(admin, session_id, "round_ended", { leaderboard, team_leaderboard: teamLeaderboard });
          return jsonResponse({ round_ended: true, leaderboard, team_leaderboard: teamLeaderboard });
        }

        const nextPuzzle = puzzles[nextIndex];
        const startedAt = new Date().toISOString();

        await admin
          .from("rebus_sessions")
          .update({ current_puzzle_index: nextIndex, puzzle_started_at: startedAt, status: "live" })
          .eq("id", session_id);

        const publicPuzzle = toPublicPuzzle(nextPuzzle, puzzles.length);
        const deadline_ms = new Date(startedAt).getTime() + nextPuzzle.time_limit_seconds * 1000;

        await broadcast(admin, session_id, "puzzle_started", { puzzle: publicPuzzle, deadline_ms });
        return jsonResponse({ puzzle: nextPuzzle, deadline_ms, total_puzzles: puzzles.length });
      }

      case "end_puzzle": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live" || session.current_puzzle_index < 0) {
          return jsonResponse({ error: "No live puzzle to end" }, 409);
        }

        const puzzles = await fetchSessionMainPuzzles(admin, session_id);
        const puzzle = puzzles[session.current_puzzle_index];

        await admin.from("rebus_sessions").update({ status: "reveal" }).eq("id", session_id);

        const { data: participants } = await admin
          .from("rebus_participants")
          .select("user_id")
          .eq("session_id", session_id);
        await sweepNoShows(admin, session_id, puzzle, session.mode, (participants ?? []).map((p) => p.user_id));

        const leaderboard = await computeRebusLeaderboard(admin, session_id);
        const teamLeaderboard =
          session.game_mode === "team" ? await computeRebusTeamLeaderboard(admin, session_id) : null;

        await broadcast(admin, session_id, "puzzle_ended", {
          puzzle_id: puzzle?.id,
          answer_text: puzzle?.answer_text ?? null,
          accepted_answers: puzzle?.accepted_answers ?? [],
          leaderboard,
          team_leaderboard: teamLeaderboard,
        });

        return jsonResponse({ leaderboard, team_leaderboard: teamLeaderboard });
      }

      case "setup_sprint": {
        const { player1_id, player2_id } = body;
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "round_ended") {
          return jsonResponse({ error: "Rounds 1-3 need to finish before setting up the Sprint" }, 409);
        }
        if (!player1_id || !player2_id || player1_id === player2_id) {
          return jsonResponse({ error: "Pick two different players for the Sprint" }, 400);
        }

        const { count: poolCount } = await admin
          .from("rebus_session_sprint_puzzles")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session_id);
        if (!poolCount || poolCount === 0) {
          return jsonResponse({ error: "No set has any Sprint puzzles yet — add some before starting Round 4" }, 400);
        }

        const { data: eligible } = await admin
          .from("rebus_participants")
          .select("user_id, profiles(id, username)")
          .eq("session_id", session_id)
          .in("user_id", [player1_id, player2_id]);
        const p1 = (eligible ?? []).find((p: any) => p.user_id === player1_id)?.profiles as { id: string; username: string } | undefined;
        const p2 = (eligible ?? []).find((p: any) => p.user_id === player2_id)?.profiles as { id: string; username: string } | undefined;
        if (!p1 || !p2) return jsonResponse({ error: "Both players need to have joined this session" }, 400);

        await admin
          .from("rebus_sessions")
          .update({
            status: "sprint_setup",
            sprint_player1_id: player1_id,
            sprint_player2_id: player2_id,
            sprint_p1_index: 0,
            sprint_p2_index: 0,
            sprint_p1_points: 0,
            sprint_p2_points: 0,
            sprint_p1_deadline: null,
            sprint_p2_deadline: null,
          })
          .eq("id", session_id);

        await broadcast(admin, session_id, "sprint_setup", {
          player1: { user_id: p1.id, username: p1.username },
          player2: { user_id: p2.id, username: p2.username },
        });

        return jsonResponse({ ok: true });
      }

      case "start_sprint_player": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);

        if (session.status === "sprint_setup") {
          const deadline = new Date(Date.now() + REBUS_SPRINT_SECONDS * 1000).toISOString();
          await admin
            .from("rebus_sessions")
            .update({ status: "sprint_p1", sprint_p1_deadline: deadline })
            .eq("id", session_id);
          await broadcast(admin, session_id, "sprint_player_started", {
            player_slot: 1,
            deadline_ms: new Date(deadline).getTime(),
          });
          return jsonResponse({ ok: true, player_slot: 1 });
        }

        if (session.status === "sprint_p1") {
          const deadline = new Date(Date.now() + REBUS_SPRINT_SECONDS * 1000).toISOString();
          await admin
            .from("rebus_sessions")
            .update({ status: "sprint_p2", sprint_p2_deadline: deadline })
            .eq("id", session_id);
          await broadcast(admin, session_id, "sprint_player_started", {
            player_slot: 2,
            deadline_ms: new Date(deadline).getTime(),
          });
          return jsonResponse({ ok: true, player_slot: 2 });
        }

        return jsonResponse({ error: `Can't start the next Sprint player from ${session.status}` }, 409);
      }

      case "end_sprint": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (!["sprint_p1", "sprint_p2"].includes(session.status)) {
          return jsonResponse({ error: "The Sprint isn't running" }, 409);
        }

        await admin.from("rebus_sessions").update({ status: "sprint_done" }).eq("id", session_id);
        await broadcast(admin, session_id, "sprint_done", {
          p1_points: session.sprint_p1_points,
          p2_points: session.sprint_p2_points,
        });
        return jsonResponse({ p1_points: session.sprint_p1_points, p2_points: session.sprint_p2_points });
      }

      case "start_final": {
        const { finalist_user_id } = body;
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "sprint_done") {
          return jsonResponse({ error: "The Sprint needs to finish before the Final Round" }, 409);
        }

        let finalist: string;
        if (finalist_user_id) {
          if (![session.sprint_player1_id, session.sprint_player2_id].includes(finalist_user_id)) {
            return jsonResponse({ error: "The finalist has to be one of the two Sprint players" }, 400);
          }
          finalist = finalist_user_id;
        } else if (session.sprint_p1_points !== session.sprint_p2_points) {
          finalist = session.sprint_p1_points > session.sprint_p2_points ? session.sprint_player1_id : session.sprint_player2_id;
        } else {
          return jsonResponse({ error: "The Sprint ended in a tie — pick who goes to the Final Round" }, 409);
        }

        const finalPuzzle = await fetchSessionFinalPuzzle(admin, session_id);
        if (!finalPuzzle) {
          return jsonResponse({ error: "No set has a Final Round puzzle yet" }, 400);
        }

        const { data: finalistProfile } = await admin.from("profiles").select("username").eq("id", finalist).single();
        const startedAt = new Date().toISOString();

        await admin
          .from("rebus_sessions")
          .update({
            status: "final_live",
            final_player_id: finalist,
            final_puzzle_id: finalPuzzle.id,
            puzzle_started_at: startedAt,
          })
          .eq("id", session_id);

        const deadline_ms = new Date(startedAt).getTime() + finalPuzzle.time_limit_seconds * 1000;

        await broadcast(admin, session_id, "final_started", {
          finalist: { user_id: finalist, username: finalistProfile?.username ?? "Unknown" },
          puzzle: {
            id: finalPuzzle.id,
            display_text: finalPuzzle.display_text,
            points: finalPuzzle.points,
            time_limit_seconds: finalPuzzle.time_limit_seconds,
          },
          deadline_ms,
        });

        return jsonResponse({ puzzle: finalPuzzle, deadline_ms });
      }

      case "end_final": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "final_live") return jsonResponse({ error: "The Final Round isn't live" }, 409);

        const { data: puzzle } = await admin
          .from("rebus_puzzles")
          .select("*")
          .eq("id", session.final_puzzle_id)
          .single();

        await admin.from("rebus_sessions").update({ status: "final_reveal" }).eq("id", session_id);
        await sweepNoShows(admin, session_id, puzzle, session.mode, [session.final_player_id]);

        const { data: finalAnswer } = await admin
          .from("rebus_answers")
          .select("is_correct, points_awarded, answer_text")
          .eq("session_id", session_id)
          .eq("puzzle_id", session.final_puzzle_id)
          .eq("user_id", session.final_player_id)
          .maybeSingle();

        const leaderboard = await computeRebusLeaderboard(admin, session_id);
        const teamLeaderboard =
          session.game_mode === "team" ? await computeRebusTeamLeaderboard(admin, session_id) : null;

        await broadcast(admin, session_id, "final_ended", {
          answer_text: puzzle?.answer_text ?? null,
          accepted_answers: puzzle?.accepted_answers ?? [],
          finalist_result: finalAnswer ?? null,
          leaderboard,
          team_leaderboard: teamLeaderboard,
        });

        return jsonResponse({ leaderboard, team_leaderboard: teamLeaderboard, finalist_result: finalAnswer ?? null });
      }

      case "end_session": {
        const { data: session } = await admin.from("rebus_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status === "ended") return jsonResponse({ error: "Session already ended" }, 409);

        const finalPuzzleExists = Boolean(await fetchSessionFinalPuzzle(admin, session_id));
        const completed = finalPuzzleExists
          ? session.status === "final_reveal"
          : ["round_ended", "sprint_setup", "sprint_p1", "sprint_p2", "sprint_done"].includes(session.status);

        await admin
          .from("rebus_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), spectator_id: null, completed })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);

        const leaderboard = await computeRebusLeaderboard(admin, session_id);
        const teamLeaderboard =
          session.game_mode === "team" ? await computeRebusTeamLeaderboard(admin, session_id) : null;

        await broadcast(admin, session_id, "session_ended", {
          leaderboard,
          team_leaderboard: teamLeaderboard,
          completed,
        });

        return jsonResponse({ leaderboard, team_leaderboard: teamLeaderboard, completed });
      }

      case "claim_spectator": {
        const claimError = await claimSpectatorSeat(admin, { table: "rebus_sessions", sessionId: session_id, userId: user.id });
        if (claimError) return claimError;
        return jsonResponse({ ok: true });
      }

      case "release_spectator": {
        await releaseSpectatorSeat(admin, "rebus_sessions", session_id);
        return jsonResponse({ ok: true });
      }

      case "force_release_lock": {
        const released = await forceReleaseSessionLock(admin);
        return jsonResponse({ ok: true, released });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("rebus-host crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
