// get-current-question
// Used when a member opens/refreshes the play page — hydrates them
// with the current question (answer-key stripped), the deadline,
// their own existing answer if any, and the current leaderboard.
// Realtime broadcasts handle live updates after that.

import {
  corsHeaders,
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  computeLeaderboard,
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

    const { data: session } = await admin
      .from("trivia_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (!session) return jsonResponse({ error: "Session not found" }, 404);

    // Spectators watch read-only and should never show up in the
    // participant list, "who's answered," or standings.
    if (!spectator) {
      await admin
        .from("session_participants")
        .upsert({ session_id, user_id: user.id }, { onConflict: "session_id,user_id" });
    }

    const leaderboard = await computeLeaderboard(admin, session_id);

    if (session.status === "ended") {
      return jsonResponse({ status: "ended", leaderboard, mode: session.mode });
    }

    if (session.current_question_index < 0 || !session.current_question_started_at) {
      return jsonResponse({ status: session.status, question: null, leaderboard, mode: session.mode });
    }

    const { data: question } = await admin
      .from("questions")
      .select("id, type, prompt, choices, points, penalty_points, time_limit_seconds, order_index")
      .eq("question_set_id", session.question_set_id)
      .eq("order_index", session.current_question_index)
      .single();

    const { count: totalQuestions } = await admin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("question_set_id", session.question_set_id);

    const { data: existingAnswer } = await admin
      .from("answers")
      .select("choice_index, answer_text, is_correct, points_awarded")
      .eq("session_id", session_id)
      .eq("question_id", question?.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const deadline_ms =
      new Date(session.current_question_started_at).getTime() +
      (question?.time_limit_seconds ?? 0) * 1000;

    return jsonResponse({
      status: session.status,
      mode: session.mode,
      question: question
        ? {
            ...question,
            penalty_points: session.mode === "hard" ? resolveWrongPenalty(question) : 0,
            total_questions: totalQuestions ?? 0,
          }
        : null,
      deadline_ms,
      existing_answer: existingAnswer
        ? {
            ...existingAnswer,
            // A no-show (auto-penalized, never actually answered) row has no
            // choice/text at all — flagged so the frontend shows "you didn't
            // answer" rather than "wrong answer" on reconnect.
            was_no_show:
              existingAnswer.choice_index === null &&
              existingAnswer.answer_text === null &&
              existingAnswer.is_correct === false,
          }
        : null,
      leaderboard,
    });
  } catch (err) {
    console.error("get-current-question crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
