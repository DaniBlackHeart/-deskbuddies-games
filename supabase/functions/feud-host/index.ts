// feud-host
// All MOD-driven Family Feud control lives here behind one endpoint,
// dispatched by `action` — same shape as trivia-host. Every action
// re-verifies the caller is a MOD server-side and every state change
// that affects players is broadcast over the session's realtime channel
// (`feud-session-{id}`).
//
// Timing is intentionally hardcoded rather than made per-question
// configurable, to keep the schema (and the set editor) simple:
//   face-off answer window   8s   (per attempt: buzz-winner, then fallback rep)
//   board turn window       15s   (per teammate, one-by-one down the line)
//   steal window            45s   (huddle + the captain's final answer)
//   Fast Money — Player 1    20s total for all 5 questions (per the rules)
//   Fast Money — Player 2    25s total for all 5 questions

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMod,
  feudReveaLeastToMostIndices,
  claimSessionLock,
  releaseSessionLock,
  forceReleaseSessionLock,
  claimSpectatorSeat,
  releaseSpectatorSeat,
  type FeudAnswer,
} from "../_shared/utils.ts";

const FASTMONEY_P1_MS = 20_000;
const FASTMONEY_P2_MS = 25_000;

function randomJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`feud-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

/** Ordered roster for a team, as an array (index 0 = first in line). Ignores gaps in line_position. */
async function getTeamRoster(admin: ReturnType<typeof getAdminClient>, sessionId: string, team: "A" | "B") {
  const { data } = await admin
    .from("feud_participants")
    .select("user_id, profiles(username, avatar_url)")
    .eq("session_id", sessionId)
    .eq("team", team)
    .order("line_position", { ascending: true });
  return data ?? [];
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
        const { feud_set_id, team_a_name, team_b_name } = body;

        const { count } = await admin
          .from("feud_round_questions")
          .select("id", { count: "exact", head: true })
          .eq("feud_set_id", feud_set_id);
        if (!count || count === 0) {
          return jsonResponse({ error: "This set has no board questions yet" }, 400);
        }

        const sessionId = crypto.randomUUID();
        const lockError = await claimSessionLock(admin, { game: "feud", sessionId, hostId: user.id });
        if (lockError) return lockError;

        let joinCode = randomJoinCode();
        for (let i = 0; i < 5; i++) {
          const { data: clash } = await admin.from("feud_sessions").select("id").eq("join_code", joinCode).maybeSingle();
          if (!clash) break;
          joinCode = randomJoinCode();
        }

        const { data: session, error } = await admin
          .from("feud_sessions")
          .insert({
            id: sessionId,
            feud_set_id,
            host_id: user.id,
            status: "lobby",
            team_a_name: team_a_name?.trim() || "Team A",
            team_b_name: team_b_name?.trim() || "Team B",
            join_code: joinCode,
          })
          .select()
          .single();

        if (error) {
          await releaseSessionLock(admin, sessionId);
          return jsonResponse({ error: "Could not create session" }, 500);
        }
        return jsonResponse({ session });
      }

      case "set_team_names": {
        const { team_a_name, team_b_name } = body;
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Team names can only change in the lobby" }, 409);

        await admin
          .from("feud_sessions")
          .update({ team_a_name: team_a_name?.trim() || "Team A", team_b_name: team_b_name?.trim() || "Team B" })
          .eq("id", session_id);
        return jsonResponse({ ok: true });
      }

      case "assign_team": {
        // MOD override — usually players self-assign via feud-play's join_team,
        // but the host may need to correct/place someone (e.g. joined late).
        const { user_id, team } = body;
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Teams are locked once the game starts" }, 409);

        const { data: teamMembers } = await admin
          .from("feud_participants")
          .select("line_position")
          .eq("session_id", session_id)
          .eq("team", team)
          .order("line_position", { ascending: false })
          .limit(1);
        const nextPosition = (teamMembers?.[0]?.line_position ?? -1) + 1;

        await admin
          .from("feud_participants")
          .upsert(
            { session_id, user_id, team, line_position: nextPosition },
            { onConflict: "session_id,user_id" }
          );
        return jsonResponse({ ok: true });
      }

      case "set_line_order": {
        const { team, ordered_user_ids } = body as { team: "A" | "B"; ordered_user_ids: string[] };
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Line order is locked once the game starts" }, 409);

        await Promise.all(
          ordered_user_ids.map((uid, i) =>
            admin.from("feud_participants").update({ line_position: i }).eq("session_id", session_id).eq("team", team).eq("user_id", uid)
          )
        );
        return jsonResponse({ ok: true });
      }

      case "remove_player": {
        const { user_id } = body;
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't remove players once the game has started" }, 409);
        await admin.from("feud_participants").delete().eq("session_id", session_id).eq("user_id", user_id);
        return jsonResponse({ ok: true });
      }

      case "start_game": {
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Game already started" }, 409);

        const [rosterA, rosterB] = await Promise.all([
          getTeamRoster(admin, session_id, "A"),
          getTeamRoster(admin, session_id, "B"),
        ]);
        if (rosterA.length === 0 || rosterB.length === 0) {
          return jsonResponse({ error: "Both teams need at least one player" }, 400);
        }

        await admin.from("feud_sessions").update({ status: "live", started_at: new Date().toISOString() }).eq("id", session_id);
        await broadcast(admin, session_id, "game_started", {});
        return jsonResponse({ ok: true });
      }

      case "start_round": {
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live") return jsonResponse({ error: `Can't start a round while session is ${session.status}` }, 409);

        // Guard: previous round (if any) must be finished before starting the next one.
        const { data: openRound } = await admin
          .from("feud_rounds")
          .select("id, status")
          .eq("session_id", session_id)
          .neq("status", "complete")
          .maybeSingle();
        if (openRound) return jsonResponse({ error: "Finish the current round before starting the next one" }, 409);

        // Search forward (not an exact-index match) so a tiebreaker
        // question sitting at a lower order_index than expected — e.g. a
        // MOD added a normal round after already adding a tiebreaker one —
        // gets skipped rather than prematurely ending the main game.
        const searchFrom = session.current_round_index + 1;
        const { data: roundQuestion } = await admin
          .from("feud_round_questions")
          .select("*")
          .eq("feud_set_id", session.feud_set_id)
          .eq("is_tiebreaker", false)
          .gte("order_index", searchFrom)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!roundQuestion) {
          return jsonResponse({ done: true, message: "No more board questions — end the main game when ready." });
        }
        const nextIndex = roundQuestion.order_index;

        const [rosterA, rosterB] = await Promise.all([
          getTeamRoster(admin, session_id, "A"),
          getTeamRoster(admin, session_id, "B"),
        ]);
        const pairIndex = 0;
        const activeA = rosterA[pairIndex % rosterA.length];
        const activeB = rosterB[pairIndex % rosterB.length];

        await admin.from("feud_sessions").update({ current_round_index: nextIndex }).eq("id", session_id);

        const { data: round, error } = await admin
          .from("feud_rounds")
          .insert({
            session_id,
            round_index: nextIndex,
            status: "faceoff",
            pair_index: pairIndex,
            face_off_active_a_user_id: activeA.user_id,
            face_off_active_b_user_id: activeB.user_id,
          })
          .select()
          .single();

        if (error) return jsonResponse({ error: "Could not start the round" }, 500);

        await broadcast(admin, session_id, "round_started", {
          round_index: nextIndex,
          prompt: roundQuestion.prompt,
          answer_count: (roundQuestion.answers as FeudAnswer[]).length,
          active_a: { user_id: activeA.user_id, username: (activeA as any).profiles?.username },
          active_b: { user_id: activeB.user_id, username: (activeB as any).profiles?.username },
        });

        return jsonResponse({ round, prompt: roundQuestion.prompt });
      }

      case "reveal_next_lost_answer": {
        const { data: round } = await admin.from("feud_rounds").select("*").eq("session_id", session_id).neq("status", "complete").maybeSingle();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "lost_reveal") return jsonResponse({ error: "This round wasn't lost without control" }, 409);

        const { data: session } = await admin.from("feud_sessions").select("feud_set_id").eq("id", session_id).single();
        const { data: roundQuestion } = await admin
          .from("feud_round_questions")
          .select("answers")
          .eq("feud_set_id", session!.feud_set_id)
          .eq("order_index", round.round_index)
          .single();

        const answers = (roundQuestion?.answers ?? []) as FeudAnswer[];
        const order = feudReveaLeastToMostIndices(answers);
        const nextIdx = order[round.reveal_count];
        if (nextIdx === undefined) return jsonResponse({ error: "Nothing left to reveal" }, 409);

        const newRevealCount = round.reveal_count + 1;
        const done = newRevealCount >= answers.length;

        await admin
          .from("feud_rounds")
          .update({
            reveal_count: newRevealCount,
            revealed_indices: [...round.revealed_indices, nextIdx],
            status: done ? "complete" : "lost_reveal",
            outcome: done ? "lost_no_control" : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", round.id);

        await broadcast(admin, session_id, "lost_reveal_answer", {
          index: nextIdx,
          text: answers[nextIdx].text,
          points: answers[nextIdx].points,
          revealed_count: newRevealCount,
          total: answers.length,
          done,
        });

        return jsonResponse({ done, text: answers[nextIdx].text, points: answers[nextIdx].points });
      }

      case "end_main_game": {
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live" && session.status !== "tiebreaker") {
          return jsonResponse({ error: "Main game isn't in progress" }, 409);
        }

        await admin.from("feud_sessions").update({ status: "main_ended" }).eq("id", session_id);
        await broadcast(admin, session_id, "main_game_ended", {
          team_a_score: session.team_a_score,
          team_b_score: session.team_b_score,
        });
        return jsonResponse({ team_a_score: session.team_a_score, team_b_score: session.team_b_score });
      }

      // A tie after the main game: pulls the next tiebreaker-flagged round
      // question (order_index continues right where the normal rounds left
      // off — see 0016_feud_tiebreaker.sql) and plays it out through the
      // exact same face-off/board/steal round machinery as any other round.
      // If the scores are STILL tied afterward, the host can call this
      // again — it'll pick up the next tiebreaker question, if the MOD
      // added more than one.
      case "start_tiebreaker_round": {
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "main_ended") {
          return jsonResponse({ error: "A tiebreaker only makes sense right after the main game ends" }, 409);
        }
        if (session.team_a_score !== session.team_b_score) {
          return jsonResponse({ error: "Scores aren't tied — no tiebreaker needed" }, 409);
        }

        const searchFrom = session.current_round_index + 1;
        const { data: roundQuestion } = await admin
          .from("feud_round_questions")
          .select("*")
          .eq("feud_set_id", session.feud_set_id)
          .eq("is_tiebreaker", true)
          .gte("order_index", searchFrom)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!roundQuestion) {
          return jsonResponse(
            { error: "No tiebreaker round was added to this set — pick a team for Fast Money manually below" },
            404
          );
        }
        const nextIndex = roundQuestion.order_index;

        const [rosterA, rosterB] = await Promise.all([
          getTeamRoster(admin, session_id, "A"),
          getTeamRoster(admin, session_id, "B"),
        ]);
        const pairIndex = 0;
        const activeA = rosterA[pairIndex % rosterA.length];
        const activeB = rosterB[pairIndex % rosterB.length];

        await admin.from("feud_sessions").update({ status: "tiebreaker", current_round_index: nextIndex }).eq("id", session_id);

        const { data: round, error } = await admin
          .from("feud_rounds")
          .insert({
            session_id,
            round_index: nextIndex,
            status: "faceoff",
            pair_index: pairIndex,
            face_off_active_a_user_id: activeA.user_id,
            face_off_active_b_user_id: activeB.user_id,
          })
          .select()
          .single();

        if (error) return jsonResponse({ error: "Could not start the tiebreaker round" }, 500);

        await broadcast(admin, session_id, "round_started", {
          round_index: nextIndex,
          prompt: roundQuestion.prompt,
          answer_count: (roundQuestion.answers as FeudAnswer[]).length,
          active_a: { user_id: activeA.user_id, username: (activeA as any).profiles?.username },
          active_b: { user_id: activeB.user_id, username: (activeB as any).profiles?.username },
        });
        // Separate from round_started so player/spectator UIs can flash
        // something more specific than the generic "Round N — face-off!".
        await broadcast(admin, session_id, "tiebreaker_started", {});

        return jsonResponse({ round, prompt: roundQuestion.prompt });
      }

      case "select_fastmoney_players": {
        const { team, player1_id, player2_id } = body as { team: "A" | "B"; player1_id: string; player2_id: string };
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "main_ended") return jsonResponse({ error: "Pick Fast Money players after the main game ends" }, 409);
        if (player1_id === player2_id) return jsonResponse({ error: "Pick two different players" }, 400);

        const { data: members } = await admin
          .from("feud_participants")
          .select("user_id")
          .eq("session_id", session_id)
          .eq("team", team)
          .in("user_id", [player1_id, player2_id]);
        if (!members || members.length !== 2) {
          return jsonResponse({ error: "Both players must be on the chosen team" }, 400);
        }

        const { data: p1 } = await admin.from("profiles").select("username").eq("id", player1_id).single();
        const { data: p2 } = await admin.from("profiles").select("username").eq("id", player2_id).single();

        await admin
          .from("feud_sessions")
          .update({
            status: "fastmoney_setup",
            fastmoney_team: team,
            fastmoney_player1_id: player1_id,
            fastmoney_player2_id: player2_id,
            fastmoney_total_points: 0,
            fastmoney_revealed_indices: [],
          })
          .eq("id", session_id);

        await broadcast(admin, session_id, "fastmoney_setup", {
          team,
          player1: { user_id: player1_id, username: p1?.username },
          player2: { user_id: player2_id, username: p2?.username },
        });
        return jsonResponse({ ok: true });
      }

      case "start_fastmoney_player": {
        const { player_slot } = body as { player_slot: 1 | 2 };
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);

        if (player_slot === 1) {
          if (session.status !== "fastmoney_setup") return jsonResponse({ error: "Fast Money players aren't set up yet" }, 409);
          const deadline = new Date(Date.now() + FASTMONEY_P1_MS).toISOString();
          await admin.from("feud_sessions").update({ status: "fastmoney_p1", fastmoney_p1_deadline: deadline }).eq("id", session_id);
          await broadcast(admin, session_id, "fastmoney_player_started", { player_slot: 1, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ deadline_ms: new Date(deadline).getTime() });
        } else {
          if (session.status !== "fastmoney_p1") return jsonResponse({ error: "Player 1 hasn't played yet" }, 409);
          const deadline = new Date(Date.now() + FASTMONEY_P2_MS).toISOString();
          await admin.from("feud_sessions").update({ status: "fastmoney_p2", fastmoney_p2_deadline: deadline }).eq("id", session_id);
          await broadcast(admin, session_id, "fastmoney_player_started", { player_slot: 2, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ deadline_ms: new Date(deadline).getTime() });
        }
      }

      case "end_fastmoney_play": {
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "fastmoney_p2") return jsonResponse({ error: "Player 2 hasn't played yet" }, 409);

        await admin.from("feud_sessions").update({ status: "fastmoney_reveal" }).eq("id", session_id);
        await broadcast(admin, session_id, "fastmoney_reveal_ready", {});
        return jsonResponse({ ok: true });
      }

      case "reveal_fastmoney_answer": {
        const { question_index } = body;
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "fastmoney_reveal") return jsonResponse({ error: "Not in the reveal phase" }, 409);
        if ((session.fastmoney_revealed_indices ?? []).includes(question_index)) {
          return jsonResponse({ error: "Already revealed" }, 409);
        }

        const { data: fmQuestion } = await admin
          .from("feud_fastmoney_questions")
          .select("prompt, answers")
          .eq("feud_set_id", session.feud_set_id)
          .eq("order_index", question_index)
          .single();

        const [{ data: p1Row }, { data: p2Row }] = await Promise.all([
          admin
            .from("feud_fastmoney_answers")
            .select("answer_text, points_awarded")
            .eq("session_id", session_id)
            .eq("player_slot", 1)
            .eq("question_index", question_index)
            .maybeSingle(),
          admin
            .from("feud_fastmoney_answers")
            .select("answer_text, points_awarded")
            .eq("session_id", session_id)
            .eq("player_slot", 2)
            .eq("question_index", question_index)
            .maybeSingle(),
        ]);

        const roundPoints = (p1Row?.points_awarded ?? 0) + (p2Row?.points_awarded ?? 0);
        const newTotal = session.fastmoney_total_points + roundPoints;
        const newRevealed = [...(session.fastmoney_revealed_indices ?? []), question_index];

        await admin
          .from("feud_sessions")
          .update({ fastmoney_total_points: newTotal, fastmoney_revealed_indices: newRevealed })
          .eq("id", session_id);

        const payload = {
          question_index,
          prompt: fmQuestion?.prompt,
          player1_answer: p1Row?.answer_text ?? null,
          player1_points: p1Row?.points_awarded ?? 0,
          player2_answer: p2Row?.answer_text ?? null,
          player2_points: p2Row?.points_awarded ?? 0,
          round_points: roundPoints,
          running_total: newTotal,
          revealed_count: newRevealed.length,
        };
        await broadcast(admin, session_id, "fastmoney_answer_revealed", payload);
        return jsonResponse(payload);
      }

      case "end_session": {
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status === "ended") return jsonResponse({ error: "Session already ended" }, 409);

        const wonGrandPrize = session.status === "fastmoney_reveal" || session.fastmoney_total_points > 0
          ? session.fastmoney_total_points >= 200
          : null;

        // Distinguish "Fast Money was fully revealed" from "a MOD cut it
        // short" so the frontend can play the right sound on game-over.
        const { count: totalFastMoneyQuestions } = await admin
          .from("feud_fastmoney_questions")
          .select("id", { count: "exact", head: true })
          .eq("feud_set_id", session.feud_set_id);
        const revealedCount = (session.fastmoney_revealed_indices ?? []).length;
        const completed = (totalFastMoneyQuestions ?? 0) > 0 && revealedCount >= (totalFastMoneyQuestions ?? 0);

        await admin
          .from("feud_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), spectator_id: null })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);
        await broadcast(admin, session_id, "session_ended", {
          team_a_score: session.team_a_score,
          team_b_score: session.team_b_score,
          fastmoney_team: session.fastmoney_team,
          fastmoney_total_points: session.fastmoney_total_points,
          won_grand_prize: wonGrandPrize,
          completed,
        });
        return jsonResponse({ ok: true, completed });
      }

      case "claim_spectator": {
        const claimError = await claimSpectatorSeat(admin, { table: "feud_sessions", sessionId: session_id, userId: user.id });
        if (claimError) return claimError;
        return jsonResponse({ ok: true });
      }

      case "release_spectator": {
        // Any mod can release the seat, not just whoever holds it — same
        // reasoning as trivia-host's.
        await releaseSpectatorSeat(admin, "feud_sessions", session_id);
        return jsonResponse({ ok: true });
      }

      case "force_release_lock": {
        // Same escape hatch as trivia-host's — any mod can clear a stuck
        // global lock, not just whoever was hosting when it got stranded.
        const released = await forceReleaseSessionLock(admin);
        return jsonResponse({ ok: true, released });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("feud-host crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
