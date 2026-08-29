// trivia-answer
// Members call this to submit an answer to the current live question.
// Grading happens entirely here, server-side, using the service role
// client — the browser never sees correct_choice/accepted_answers.

import {
  corsHeaders,
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  typedAnswerMatches,
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
    const { session_id, question_id, choice_index, answer_text, response_ms } = body;

    if (!session_id || !question_id) {
      return jsonResponse({ error: "session_id and question_id are required" }, 400);
    }

    const admin = getAdminClient();

    const { data: session } = await admin
      .from("trivia_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (!session) return jsonResponse({ error: "Session not found" }, 404);
    if (session.status !== "live") {
      return jsonResponse({ error: "This question isn't accepting answers right now" }, 409);
    }

    const { data: question } = await admin
      .from("trivia_session_questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (!question || question.session_id !== session_id) {
      return jsonResponse({ error: "Question does not belong to this session" }, 400);
    }
    if (question.order_index !== session.current_question_index) {
      return jsonResponse({ error: "That question is no longer live" }, 409);
    }

    // Enforce the deadline server-side too, not just in the UI.
    if (session.current_question_started_at) {
      const deadline =
        new Date(session.current_question_started_at).getTime() +
        question.time_limit_seconds * 1000;
      if (Date.now() > deadline + 1500) {
        // small grace window for network latency
        return jsonResponse({ error: "Time's up for this question" }, 409);
      }
    }

    // Prevent double submission.
    const { data: existing } = await admin
      .from("answers")
      .select("id")
      .eq("session_id", session_id)
      .eq("question_id", question_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ error: "You already answered this question" }, 409);
    }

    // Make sure the participant row exists (in case they refreshed/rejoined late).
    await admin
      .from("session_participants")
      .upsert({ session_id, user_id: user.id }, { onConflict: "session_id,user_id" });

    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;

    if (question.type === "multiple_choice") {
      isCorrect = choice_index === question.correct_choice;
      pointsAwarded = isCorrect ? question.points : session.mode === "hard" ? -resolveWrongPenalty(question) : 0;
    } else {
      const accepted: string[] = question.accepted_answers ?? [];
      const matched = typeof answer_text === "string" && typedAnswerMatches(answer_text, accepted);
      if (matched) {
        isCorrect = true;
        pointsAwarded = question.points;
      } else {
        isCorrect = null; // pending manual grade by a MOD
        pointsAwarded = 0;
      }
    }

    const { error: insertError } = await admin.from("answers").insert({
      session_id,
      question_id,
      user_id: user.id,
      choice_index: choice_index ?? null,
      answer_text: answer_text ?? null,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      response_ms: response_ms ?? 0,
    });

    if (insertError) {
      console.error("answer insert failed", insertError);
      return jsonResponse({ error: "Could not save your answer" }, 500);
    }

    return jsonResponse({
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      pending: isCorrect === null,
    });
  } catch (err) {
    console.error("trivia-answer crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
