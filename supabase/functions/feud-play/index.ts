// feud-play
// Members call this for every player-side action: joining a team, buzzing
// in, submitting board/steal/Fast Money answers. Grading happens entirely
// here using the service-role client — board answer text/points for
// unrevealed slots, and the other Fast Money player's answers, never reach
// a browser that isn't supposed to see them.
//
// Timing constants match feud-host's (kept in sync manually — small enough
// surface area that a shared constants file would be more indirection than
// it's worth right now).

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  matchFeudAnswer,
  type FeudAnswer,
} from "../_shared/utils.ts";

const FACEOFF_ANSWER_WINDOW_MS = 8_000;
const BOARD_TURN_WINDOW_MS = 15_000;
const STEAL_WINDOW_MS = 45_000;

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`feud-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

async function getTeamRoster(admin: ReturnType<typeof getAdminClient>, sessionId: string, team: "A" | "B") {
  const { data } = await admin
    .from("feud_participants")
    .select("user_id, profiles(username)")
    .eq("session_id", sessionId)
    .eq("team", team)
    .order("line_position", { ascending: true });
  return data ?? [];
}

async function getMyTeam(admin: ReturnType<typeof getAdminClient>, sessionId: string, userId: string): Promise<"A" | "B" | null> {
  const { data } = await admin
    .from("feud_participants")
    .select("team")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.team as "A" | "B" | undefined) ?? null;
}

async function getRoundQuestion(admin: ReturnType<typeof getAdminClient>, feudSetId: string, roundIndex: number) {
  const { data } = await admin
    .from("feud_round_questions")
    .select("answers")
    .eq("feud_set_id", feudSetId)
    .eq("order_index", roundIndex)
    .single();
  return (data?.answers ?? []) as FeudAnswer[];
}

/** Reveals every remaining unrevealed index (used at round end so the full board is shown either way). */
function allRemainingIndices(total: number, revealed: number[]) {
  const revealedSet = new Set(revealed);
  const out: number[] = [];
  for (let i = 0; i < total; i++) if (!revealedSet.has(i)) out.push(i);
  return out;
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
      // ---------------------------------------------------------------
      // Lobby
      // ---------------------------------------------------------------
      case "join_team": {
        const { team } = body as { team: "A" | "B" };
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Teams are locked — the game has already started" }, 409);

        const { data: teamMembers } = await admin
          .from("feud_participants")
          .select("line_position")
          .eq("session_id", session_id)
          .eq("team", team)
          .order("line_position", { ascending: false })
          .limit(1);
        const nextPosition = (teamMembers?.[0]?.line_position ?? -1) + 1;

        const { error } = await admin
          .from("feud_participants")
          .upsert({ session_id, user_id: user.id, team, line_position: nextPosition }, { onConflict: "session_id,user_id" });
        if (error) return jsonResponse({ error: "Could not join that team" }, 500);
        return jsonResponse({ ok: true });
      }

      case "leave_lobby": {
        const { data: session } = await admin.from("feud_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't leave once the game has started" }, 409);
        await admin.from("feud_participants").delete().eq("session_id", session_id).eq("user_id", user.id);
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // Face-off
      // ---------------------------------------------------------------
      case "buzz": {
        const { data: round } = await admin.from("feud_rounds").select("*").eq("session_id", session_id).neq("status", "complete").maybeSingle();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "faceoff" || round.face_off_singleton_user_id) {
          return jsonResponse({ error: "The buzzer isn't open right now" }, 409);
        }
        if (user.id !== round.face_off_active_a_user_id && user.id !== round.face_off_active_b_user_id) {
          return jsonResponse({ error: "It's not your turn to face off" }, 403);
        }

        const deadline = new Date(Date.now() + FACEOFF_ANSWER_WINDOW_MS).toISOString();
        // Atomic claim: only succeeds if nobody's buzzed in yet — same
        // pattern as trivia-host's claim_spectator.
        const { data: claimed } = await admin
          .from("feud_rounds")
          .update({ face_off_buzz_user_id: user.id, face_off_buzz_at: new Date().toISOString(), face_off_deadline: deadline })
          .eq("id", round.id)
          .is("face_off_buzz_user_id", null)
          .select()
          .maybeSingle();

        if (!claimed) return jsonResponse({ error: "Too slow — the other rep buzzed first!" }, 409);

        await broadcast(admin, session_id, "buzz_locked", { winner_user_id: user.id, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ ok: true, deadline_ms: new Date(deadline).getTime() });
      }

      case "faceoff_answer":
      case "faceoff_timeout": {
        const isTimeout = action === "faceoff_timeout";
        const { data: round } = await admin.from("feud_rounds").select("*").eq("session_id", session_id).neq("status", "complete").maybeSingle();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "faceoff") return jsonResponse({ error: "The face-off has already been decided" }, 409);

        const expectedUser = round.face_off_singleton_user_id ?? round.face_off_buzz_user_id;
        if (!expectedUser) return jsonResponse({ error: "Nobody has buzzed in yet" }, 409);
        if (!isTimeout && user.id !== expectedUser) return jsonResponse({ error: "It's not your turn to answer" }, 403);
        if (round.face_off_deadline && !isTimeout && Date.now() > new Date(round.face_off_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for that attempt" }, 409);
        }
        // Guard double-processing (e.g. a stray timeout call arriving after
        // a real answer already moved the round on): the deadline must
        // still match what this request expects.
        if (isTimeout) {
          if (!round.face_off_deadline || Date.now() < new Date(round.face_off_deadline).getTime()) {
            return jsonResponse({ error: "Not timed out yet" }, 409);
          }
        }

        const { data: session } = await admin.from("feud_sessions").select("feud_set_id").eq("id", session_id).single();
        const answers = await getRoundQuestion(admin, session!.feud_set_id, round.round_index);
        const answerText = isTimeout ? "" : ((body.answer_text as string) ?? "");
        const matchedIndex = isTimeout ? null : matchFeudAnswer(answerText, answers);

        if (matchedIndex !== null) {
          const myTeam = await getMyTeam(admin, session_id, expectedUser);
          await admin
            .from("feud_rounds")
            .update({
              status: "faceoff_decision",
              face_off_decision_user_id: expectedUser,
              revealed_indices: [matchedIndex],
              points_pot: answers[matchedIndex].points,
              face_off_deadline: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", round.id);

          await broadcast(admin, session_id, "faceoff_correct", {
            user_id: expectedUser,
            team: myTeam,
            index: matchedIndex,
            text: answers[matchedIndex].text,
            points: answers[matchedIndex].points,
          });
          return jsonResponse({ correct: true, index: matchedIndex, points: answers[matchedIndex].points });
        }

        // Wrong (or timed out).
        if (!round.face_off_singleton_user_id) {
          // First attempt missed — open the fallback attempt for the other active rep.
          const otherUser = expectedUser === round.face_off_active_a_user_id ? round.face_off_active_b_user_id : round.face_off_active_a_user_id;
          const deadline = new Date(Date.now() + FACEOFF_ANSWER_WINDOW_MS).toISOString();
          await admin
            .from("feud_rounds")
            .update({ face_off_singleton_user_id: otherUser, face_off_deadline: deadline, updated_at: new Date().toISOString() })
            .eq("id", round.id);

          await broadcast(admin, session_id, "faceoff_miss", { missed_user_id: expectedUser, next_user_id: otherUser, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ correct: false, next_user_id: otherUser });
        }

        // Both reps in this pair missed — advance to the next pair, or lose the round.
        const [rosterA, rosterB] = await Promise.all([getTeamRoster(admin, session_id, "A"), getTeamRoster(admin, session_id, "B")]);
        const nextPairIndex = round.pair_index + 1;
        const exhausted = nextPairIndex >= Math.max(rosterA.length, rosterB.length);

        if (exhausted) {
          await admin
            .from("feud_rounds")
            .update({ status: "lost_reveal", face_off_deadline: null, updated_at: new Date().toISOString() })
            .eq("id", round.id);
          await broadcast(admin, session_id, "faceoff_all_missed", {});
          return jsonResponse({ correct: false, round_lost: true });
        }

        const nextA = rosterA[nextPairIndex % rosterA.length];
        const nextB = rosterB[nextPairIndex % rosterB.length];
        await admin
          .from("feud_rounds")
          .update({
            pair_index: nextPairIndex,
            face_off_active_a_user_id: nextA.user_id,
            face_off_active_b_user_id: nextB.user_id,
            face_off_buzz_user_id: null,
            face_off_buzz_at: null,
            face_off_singleton_user_id: null,
            face_off_deadline: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", round.id);

        await broadcast(admin, session_id, "faceoff_next_pair", {
          pair_index: nextPairIndex,
          active_a: { user_id: nextA.user_id, username: (nextA as any).profiles?.username },
          active_b: { user_id: nextB.user_id, username: (nextB as any).profiles?.username },
        });
        return jsonResponse({ correct: false, next_pair: true });
      }

      case "pass_or_continue": {
        const { choice } = body as { choice: "pass" | "continue" };
        const { data: round } = await admin.from("feud_rounds").select("*").eq("session_id", session_id).neq("status", "complete").maybeSingle();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "faceoff_decision") return jsonResponse({ error: "Nothing to decide right now" }, 409);
        if (user.id !== round.face_off_decision_user_id) return jsonResponse({ error: "Only the player who won the face-off can choose" }, 403);

        const winningTeam = await getMyTeam(admin, session_id, user.id);
        if (!winningTeam) return jsonResponse({ error: "Could not determine your team" }, 500);
        const controllingTeam = choice === "continue" ? winningTeam : winningTeam === "A" ? "B" : "A";
        const opposingTeam = controllingTeam === "A" ? "B" : "A";

        const roster = await getTeamRoster(admin, session_id, controllingTeam);
        if (roster.length === 0) return jsonResponse({ error: "That team has no players" }, 409);

        const deadline = new Date(Date.now() + BOARD_TURN_WINDOW_MS).toISOString();
        await admin
          .from("feud_rounds")
          .update({
            status: "board",
            controlling_team: controllingTeam,
            opposing_team: opposingTeam,
            current_turn_user_id: roster[0].user_id,
            current_turn_deadline: deadline,
            updated_at: new Date().toISOString(),
          })
          .eq("id", round.id);

        await broadcast(admin, session_id, "board_started", {
          controlling_team: controllingTeam,
          current_turn_user_id: roster[0].user_id,
          deadline_ms: new Date(deadline).getTime(),
        });
        return jsonResponse({ ok: true, controlling_team: controllingTeam });
      }

      // ---------------------------------------------------------------
      // Board play
      // ---------------------------------------------------------------
      case "board_answer":
      case "board_timeout": {
        const isTimeout = action === "board_timeout";
        const { data: round } = await admin.from("feud_rounds").select("*").eq("session_id", session_id).neq("status", "complete").maybeSingle();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "board") return jsonResponse({ error: "The board isn't in play right now" }, 409);
        if (!isTimeout && user.id !== round.current_turn_user_id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (isTimeout && (!round.current_turn_deadline || Date.now() < new Date(round.current_turn_deadline).getTime())) {
          return jsonResponse({ error: "Not timed out yet" }, 409);
        }
        if (!isTimeout && round.current_turn_deadline && Date.now() > new Date(round.current_turn_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for your turn" }, 409);
        }

        const { data: session } = await admin.from("feud_sessions").select("feud_set_id").eq("id", session_id).single();
        const answers = await getRoundQuestion(admin, session!.feud_set_id, round.round_index);
        const answerText = isTimeout ? "" : ((body.answer_text as string) ?? "");
        const matchedIndex = isTimeout ? null : matchFeudAnswer(answerText, answers, round.revealed_indices);

        if (matchedIndex !== null) {
          const newRevealed = [...round.revealed_indices, matchedIndex];
          const newPot = round.points_pot + answers[matchedIndex].points;
          const cleared = newRevealed.length >= answers.length;

          if (cleared) {
            const { data: currentSession } = await admin.from("feud_sessions").select("team_a_score, team_b_score").eq("id", session_id).single();
            const scoreField = round.controlling_team === "A" ? "team_a_score" : "team_b_score";
            const newScore = (currentSession as any)[scoreField] + newPot;
            await admin.from("feud_sessions").update({ [scoreField]: newScore }).eq("id", session_id);
            await admin
              .from("feud_rounds")
              .update({ revealed_indices: newRevealed, points_pot: newPot, status: "complete", outcome: "cleared", awarded_to_team: round.controlling_team, updated_at: new Date().toISOString() })
              .eq("id", round.id);

            await broadcast(admin, session_id, "board_cleared", {
              index: matchedIndex,
              text: answers[matchedIndex].text,
              points: answers[matchedIndex].points,
              points_pot: newPot,
              awarded_to_team: round.controlling_team,
            });
            return jsonResponse({ correct: true, cleared: true, points: answers[matchedIndex].points });
          }

          const roster = await getTeamRoster(admin, session_id, round.controlling_team);
          const currentIdx = roster.findIndex((p) => p.user_id === round.current_turn_user_id);
          const nextTurn = roster[(currentIdx + 1) % roster.length].user_id;
          const deadline = new Date(Date.now() + BOARD_TURN_WINDOW_MS).toISOString();

          await admin
            .from("feud_rounds")
            .update({ revealed_indices: newRevealed, points_pot: newPot, current_turn_user_id: nextTurn, current_turn_deadline: deadline, updated_at: new Date().toISOString() })
            .eq("id", round.id);

          await broadcast(admin, session_id, "board_correct", {
            index: matchedIndex,
            text: answers[matchedIndex].text,
            points: answers[matchedIndex].points,
            points_pot: newPot,
            next_turn_user_id: nextTurn,
            deadline_ms: new Date(deadline).getTime(),
          });
          return jsonResponse({ correct: true, points: answers[matchedIndex].points });
        }

        // Strike.
        const newStrikes = round.strikes + 1;
        if (newStrikes >= 3) {
          const stealDeadline = new Date(Date.now() + STEAL_WINDOW_MS).toISOString();
          await admin
            .from("feud_rounds")
            .update({ strikes: newStrikes, status: "steal", current_turn_deadline: stealDeadline, updated_at: new Date().toISOString() })
            .eq("id", round.id);
          await broadcast(admin, session_id, "steal_started", {
            opposing_team: round.opposing_team,
            points_pot: round.points_pot,
            deadline_ms: new Date(stealDeadline).getTime(),
          });
          return jsonResponse({ correct: false, strikes: newStrikes, steal: true });
        }

        const roster = await getTeamRoster(admin, session_id, round.controlling_team);
        const currentIdx = roster.findIndex((p) => p.user_id === round.current_turn_user_id);
        const nextTurn = roster[(currentIdx + 1) % roster.length].user_id;
        const deadline = new Date(Date.now() + BOARD_TURN_WINDOW_MS).toISOString();

        await admin
          .from("feud_rounds")
          .update({ strikes: newStrikes, current_turn_user_id: nextTurn, current_turn_deadline: deadline, updated_at: new Date().toISOString() })
          .eq("id", round.id);

        await broadcast(admin, session_id, "board_strike", { strikes: newStrikes, next_turn_user_id: nextTurn, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ correct: false, strikes: newStrikes });
      }

      // ---------------------------------------------------------------
      // Steal
      // ---------------------------------------------------------------
      case "steal_answer":
      case "steal_timeout": {
        const isTimeout = action === "steal_timeout";
        const { data: round } = await admin.from("feud_rounds").select("*").eq("session_id", session_id).neq("status", "complete").maybeSingle();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "steal") return jsonResponse({ error: "Nobody's stealing right now" }, 409);
        if (isTimeout && (!round.current_turn_deadline || Date.now() < new Date(round.current_turn_deadline).getTime())) {
          return jsonResponse({ error: "Not timed out yet" }, 409);
        }

        if (!isTimeout) {
          const roster = await getTeamRoster(admin, session_id, round.opposing_team);
          if (roster.length === 0 || roster[0].user_id !== user.id) {
            return jsonResponse({ error: "Only your team captain can give the steal answer" }, 403);
          }
          if (round.current_turn_deadline && Date.now() > new Date(round.current_turn_deadline).getTime() + 1000) {
            return jsonResponse({ error: "Time's up" }, 409);
          }
        }

        const { data: session } = await admin.from("feud_sessions").select("feud_set_id").eq("id", session_id).single();
        const answers = await getRoundQuestion(admin, session!.feud_set_id, round.round_index);
        const answerText = isTimeout ? "" : ((body.answer_text as string) ?? "");
        const matchedIndex = isTimeout ? null : matchFeudAnswer(answerText, answers, round.revealed_indices);

        const awardedTo = matchedIndex !== null ? round.opposing_team : round.controlling_team;
        const outcome = matchedIndex !== null ? "stolen" : "defended";
        const fullyRevealed = [...round.revealed_indices, ...allRemainingIndices(answers.length, round.revealed_indices)];

        const { data: currentSession } = await admin.from("feud_sessions").select("team_a_score, team_b_score").eq("id", session_id).single();
        const scoreField = awardedTo === "A" ? "team_a_score" : "team_b_score";
        const newScore = (currentSession as any)[scoreField] + round.points_pot;
        await admin.from("feud_sessions").update({ [scoreField]: newScore }).eq("id", session_id);

        await admin
          .from("feud_rounds")
          .update({ revealed_indices: fullyRevealed, status: "complete", outcome, awarded_to_team: awardedTo, updated_at: new Date().toISOString() })
          .eq("id", round.id);

        await broadcast(admin, session_id, "round_complete", {
          outcome,
          awarded_to_team: awardedTo,
          points_pot: round.points_pot,
          full_board: answers.map((a) => ({ text: a.text, points: a.points })),
        });
        return jsonResponse({ stolen: matchedIndex !== null, awarded_to_team: awardedTo });
      }

      // ---------------------------------------------------------------
      // Fast Money
      // ---------------------------------------------------------------
      case "fastmoney_answer": {
        const { question_index, answer_text } = body as { question_index: number; answer_text: string };
        const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);

        let playerSlot: 1 | 2;
        if (session.status === "fastmoney_p1" && session.fastmoney_player1_id === user.id) {
          playerSlot = 1;
          if (!session.fastmoney_p1_deadline || Date.now() > new Date(session.fastmoney_p1_deadline).getTime() + 500) {
            return jsonResponse({ error: "Time's up!" }, 409);
          }
        } else if (session.status === "fastmoney_p2" && session.fastmoney_player2_id === user.id) {
          playerSlot = 2;
          if (!session.fastmoney_p2_deadline || Date.now() > new Date(session.fastmoney_p2_deadline).getTime() + 500) {
            return jsonResponse({ error: "Time's up!" }, 409);
          }
        } else {
          return jsonResponse({ error: "It's not your turn to play Fast Money" }, 403);
        }

        const { data: fmQuestion } = await admin
          .from("feud_fastmoney_questions")
          .select("answers")
          .eq("feud_set_id", session.feud_set_id)
          .eq("order_index", question_index)
          .single();
        const answers = (fmQuestion?.answers ?? []) as FeudAnswer[];

        // Player 2's buzzer rule: a repeat of Player 1's answer doesn't
        // count and isn't saved — they get to try a different one without
        // ever seeing what Player 1 actually said.
        if (playerSlot === 2) {
          const { data: p1Row } = await admin
            .from("feud_fastmoney_answers")
            .select("answer_text")
            .eq("session_id", session_id)
            .eq("player_slot", 1)
            .eq("question_index", question_index)
            .maybeSingle();
          if (p1Row) {
            const norm = (s: string) => s.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
            if (norm(p1Row.answer_text) === norm(answer_text)) {
              return jsonResponse({ duplicate: true });
            }
          }
        }

        const matchedIndex = matchFeudAnswer(answer_text, answers);
        const points = matchedIndex !== null ? answers[matchedIndex].points : 0;

        const { error } = await admin.from("feud_fastmoney_answers").upsert(
          {
            session_id,
            user_id: user.id,
            player_slot: playerSlot,
            question_index,
            answer_text,
            matched_answer_index: matchedIndex,
            points_awarded: points,
            is_duplicate: false,
          },
          { onConflict: "session_id,player_slot,question_index" }
        );
        if (error) return jsonResponse({ error: "Could not save your answer" }, 500);

        // Points are deliberately withheld here — the big reveal happens
        // later, hosted by the facilitator, same suspense as the show.
        return jsonResponse({ saved: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("feud-play crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
