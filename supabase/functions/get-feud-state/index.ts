// get-feud-state
// Used when a member opens/refreshes the Family Feud play page — hydrates
// them with everything they're allowed to see right now. Realtime
// broadcasts (channel `feud-session-{id}`) handle live updates after that.
//
// Anti-cheat boundaries enforced here:
//   - Unrevealed board answers never include text/points (toPublicFeudAnswers).
//   - Fast Money: a player only ever sees their OWN answer progress before
//     the reveal phase, never the other player's.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  toPublicFeudAnswers,
  type FeudAnswer,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json();
    const { session_id } = body;
    if (!session_id) return jsonResponse({ error: "session_id is required" }, 400);

    const admin = getAdminClient();

    const { data: session } = await admin.from("feud_sessions").select("*").eq("id", session_id).single();
    if (!session) return jsonResponse({ error: "Session not found" }, 404);

    const [{ data: myParticipant }, { data: rosterA }, { data: rosterB }] = await Promise.all([
      admin.from("feud_participants").select("team, line_position").eq("session_id", session_id).eq("user_id", user.id).maybeSingle(),
      admin.from("feud_participants").select("user_id, line_position, profiles(username, avatar_url)").eq("session_id", session_id).eq("team", "A").order("line_position"),
      admin.from("feud_participants").select("user_id, line_position, profiles(username, avatar_url)").eq("session_id", session_id).eq("team", "B").order("line_position"),
    ]);

    let round: any = null;
    if (session.current_round_index >= 0) {
      const { data: roundRow } = await admin
        .from("feud_rounds")
        .select("*")
        .eq("session_id", session_id)
        .eq("round_index", session.current_round_index)
        .maybeSingle();

      if (roundRow) {
        const { data: roundQuestion } = await admin
          .from("feud_round_questions")
          .select("prompt, answers")
          .eq("feud_set_id", session.feud_set_id)
          .eq("order_index", roundRow.round_index)
          .single();

        const answers = (roundQuestion?.answers ?? []) as FeudAnswer[];

        round = {
          round_index: roundRow.round_index,
          status: roundRow.status,
          prompt: roundQuestion?.prompt,
          board: toPublicFeudAnswers(answers, roundRow.revealed_indices),
          total_answers: answers.length,
          pair_index: roundRow.pair_index,
          face_off_active_a_user_id: roundRow.face_off_active_a_user_id,
          face_off_active_b_user_id: roundRow.face_off_active_b_user_id,
          face_off_buzz_user_id: roundRow.face_off_buzz_user_id,
          face_off_singleton_user_id: roundRow.face_off_singleton_user_id,
          face_off_provisional_user_id: roundRow.face_off_provisional_user_id,
          face_off_provisional_text:
            roundRow.face_off_provisional_index !== null && roundRow.face_off_provisional_index !== undefined
              ? answers[roundRow.face_off_provisional_index]?.text ?? null
              : null,
          face_off_provisional_points: roundRow.face_off_provisional_points,
          face_off_deadline_ms: roundRow.face_off_deadline ? new Date(roundRow.face_off_deadline).getTime() : null,
          face_off_decision_user_id: roundRow.face_off_decision_user_id,
          controlling_team: roundRow.controlling_team,
          opposing_team: roundRow.opposing_team,
          current_turn_user_id: roundRow.current_turn_user_id,
          current_turn_deadline_ms: roundRow.current_turn_deadline ? new Date(roundRow.current_turn_deadline).getTime() : null,
          strikes: roundRow.strikes,
          points_pot: roundRow.points_pot,
          reveal_count: roundRow.reveal_count,
          outcome: roundRow.outcome,
          awarded_to_team: roundRow.awarded_to_team,
        };
      }
    }

    // Fast Money — the active player gets the real question prompts (those
    // aren't secret, they're what you're supposed to answer) plus their own
    // progress, but never any answer text/points before the host's reveal.
    // Once the host reveals a question, both players' text/points become
    // public for that index.
    let fastMoney: any = null;
    if (session.fastmoney_player1_id === user.id || session.fastmoney_player2_id === user.id) {
      const mySlot = session.fastmoney_player1_id === user.id ? 1 : 2;
      const [{ data: myAnswers }, { data: fmQuestions }] = await Promise.all([
        admin
          .from("feud_fastmoney_answers")
          .select("question_index")
          .eq("session_id", session_id)
          .eq("player_slot", mySlot),
        admin
          .from("feud_fastmoney_questions")
          .select("order_index, prompt")
          .eq("feud_set_id", session.feud_set_id)
          .order("order_index", { ascending: true }),
      ]);
      const prompts = (fmQuestions ?? []).map((q) => q.prompt);
      fastMoney = { my_slot: mySlot, answered_indices: (myAnswers ?? []).map((a) => a.question_index), prompts };
    }

    let fastMoneyRevealed: any[] = [];
    if ((session.fastmoney_revealed_indices ?? []).length > 0) {
      const { data: revealedQuestions } = await admin
        .from("feud_fastmoney_questions")
        .select("order_index, prompt")
        .eq("feud_set_id", session.feud_set_id)
        .in("order_index", session.fastmoney_revealed_indices);
      const { data: revealedAnswers } = await admin
        .from("feud_fastmoney_answers")
        .select("player_slot, question_index, answer_text, points_awarded")
        .eq("session_id", session_id)
        .in("question_index", session.fastmoney_revealed_indices);

      fastMoneyRevealed = (revealedQuestions ?? []).map((q) => ({
        question_index: q.order_index,
        prompt: q.prompt,
        player1: (revealedAnswers ?? []).find((a) => a.player_slot === 1 && a.question_index === q.order_index) ?? null,
        player2: (revealedAnswers ?? []).find((a) => a.player_slot === 2 && a.question_index === q.order_index) ?? null,
      }));
    }

    // Same "was Fast Money fully revealed" check as end_session, so a
    // reconnect after the game ended still gets the right game-over sound.
    let completed = false;
    if (session.status === "ended") {
      const { count: totalFastMoneyQuestions } = await admin
        .from("feud_fastmoney_questions")
        .select("id", { count: "exact", head: true })
        .eq("feud_set_id", session.feud_set_id);
      const revealedCount = (session.fastmoney_revealed_indices ?? []).length;
      completed = (totalFastMoneyQuestions ?? 0) > 0 && revealedCount >= (totalFastMoneyQuestions ?? 0);
    }

    return jsonResponse({
      session: {
        id: session.id,
        status: session.status,
        team_a_name: session.team_a_name,
        team_b_name: session.team_b_name,
        team_a_score: session.team_a_score,
        team_b_score: session.team_b_score,
        current_round_index: session.current_round_index,
        fastmoney_team: session.fastmoney_team,
        fastmoney_player1_id: session.fastmoney_player1_id,
        fastmoney_player2_id: session.fastmoney_player2_id,
        fastmoney_total_points: session.fastmoney_total_points,
        fastmoney_p1_deadline_ms: session.fastmoney_p1_deadline ? new Date(session.fastmoney_p1_deadline).getTime() : null,
        fastmoney_p2_deadline_ms: session.fastmoney_p2_deadline ? new Date(session.fastmoney_p2_deadline).getTime() : null,
      },
      my_team: myParticipant?.team ?? null,
      roster_a: rosterA ?? [],
      roster_b: rosterB ?? [],
      round,
      fast_money: fastMoney,
      fast_money_revealed: fastMoneyRevealed,
      completed,
    });
  } catch (err) {
    console.error("get-feud-state crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
