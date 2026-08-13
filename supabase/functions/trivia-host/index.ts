// trivia-host
// All MOD-driven session control lives here behind one endpoint,
// dispatched by `action`. Every action re-verifies the caller is a
// MOD server-side (never trusts a client-side flag) and every state
// change that affects players is broadcast over the session's
// realtime channel.

import {
  corsHeaders,
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMod,
  computeLeaderboard,
  resolveWrongPenalty,
  resolveTimeoutPenalty,
  claimSessionLock,
  releaseSessionLock,
  forceReleaseSessionLock,
  claimSpectatorSeat,
  releaseSpectatorSeat,
} from "../_shared/utils.ts";

function randomJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function toPublicQuestion(question: any, totalQuestions: number, mode: string) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    choices: question.choices,
    points: question.points,
    penalty_points: mode === "hard" ? resolveWrongPenalty(question) : 0,
    time_limit_seconds: question.time_limit_seconds,
    order_index: question.order_index,
    total_questions: totalQuestions,
  };
}

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`trivia-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
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
    const { action } = body;

    switch (action) {
      case "create_session": {
        const { question_set_id, mode } = body;
        const resolvedMode = mode === "hard" ? "hard" : "chill";

        const { count } = await admin
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("question_set_id", question_set_id)
          .is("archived_at", null);

        if (!count || count === 0) {
          return jsonResponse({ error: "This question set has no questions yet" }, 400);
        }

        // Pre-generate the id so the lock (which must exist first, to keep
        // the claim atomic) can reference the session before it's created.
        const sessionId = crypto.randomUUID();
        const lockError = await claimSessionLock(admin, { game: "trivia", sessionId, hostId: user.id });
        if (lockError) return lockError;

        let joinCode = randomJoinCode();
        for (let i = 0; i < 5; i++) {
          const { data: clash } = await admin
            .from("trivia_sessions")
            .select("id")
            .eq("join_code", joinCode)
            .maybeSingle();
          if (!clash) break;
          joinCode = randomJoinCode();
        }

        const { data: session, error } = await admin
          .from("trivia_sessions")
          .insert({
            id: sessionId,
            question_set_id,
            host_id: user.id,
            status: "lobby",
            mode: resolvedMode,
            current_question_index: -1,
            join_code: joinCode,
          })
          .select()
          .single();

        if (error) {
          await releaseSessionLock(admin, sessionId); // don't strand the lock if session creation failed
          return jsonResponse({ error: "Could not create session" }, 500);
        }
        return jsonResponse({ session });
      }

      case "start_session": {
        const { session_id } = body;
        const { data: session } = await admin
          .from("trivia_sessions")
          .select("*")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") {
          return jsonResponse({ error: "Session already started" }, 409);
        }

        const { data: updated } = await admin
          .from("trivia_sessions")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("id", session_id)
          .select()
          .single();

        await broadcast(admin, session_id, "lobby_update", { started: true });
        return jsonResponse({ session: updated });
      }

      case "next_question": {
        const { session_id } = body;
        const { data: session } = await admin
          .from("trivia_sessions")
          .select("*")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (!["live", "grading"].includes(session.status)) {
          return jsonResponse({ error: `Can't advance a session that's ${session.status}` }, 409);
        }

        const { data: questions } = await admin
          .from("questions")
          .select("*")
          .eq("question_set_id", session.question_set_id)
          .is("archived_at", null)
          .order("order_index", { ascending: true });

        const nextIndex = session.current_question_index + 1;
        if (!questions || nextIndex >= questions.length) {
          return jsonResponse({ done: true, message: "No more questions — end the session when ready." });
        }

        const nextQuestion = questions[nextIndex];
        const startedAt = new Date().toISOString();

        await admin
          .from("trivia_sessions")
          .update({
            current_question_index: nextIndex,
            current_question_started_at: startedAt,
            status: "live",
          })
          .eq("id", session_id);

        const publicQuestion = toPublicQuestion(nextQuestion, questions.length, session.mode);
        const deadline_ms = new Date(startedAt).getTime() + nextQuestion.time_limit_seconds * 1000;

        await broadcast(admin, session_id, "question_started", {
          question: publicQuestion,
          deadline_ms,
        });

        return jsonResponse({ question: nextQuestion, deadline_ms, total_questions: questions.length });
      }

      case "end_question": {
        const { session_id } = body;
        const { data: session } = await admin
          .from("trivia_sessions")
          .select("*")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live" || session.current_question_index < 0) {
          return jsonResponse({ error: "No live question to end" }, 409);
        }

        const { data: question } = await admin
          .from("questions")
          .select("*")
          .eq("question_set_id", session.question_set_id)
          .eq("order_index", session.current_question_index)
          .is("archived_at", null)
          .single();

        await admin.from("trivia_sessions").update({ status: "grading" }).eq("id", session_id);

        if (question && session.mode === "hard") {
          // No-show sweep (Hard mode only): anyone who joined the session but
          // never submitted an answer to this question gets an automatic
          // penalty row. Uses upsert + ignoreDuplicates so a last-instant real
          // submission that arrives around the same moment this runs is never
          // overwritten — the unique (session_id, question_id, user_id)
          // constraint means an existing row always wins over this sweep.
          const [{ data: participants }, { data: answered }] = await Promise.all([
            admin.from("session_participants").select("user_id").eq("session_id", session_id),
            admin.from("answers").select("user_id").eq("session_id", session_id).eq("question_id", question.id),
          ]);

          const answeredIds = new Set((answered ?? []).map((a) => a.user_id));
          const noShows = (participants ?? []).filter((p) => !answeredIds.has(p.user_id));

          if (noShows.length > 0) {
            const timeoutPenalty = resolveTimeoutPenalty(question);
            await admin.from("answers").upsert(
              noShows.map((p) => ({
                session_id,
                question_id: question.id,
                user_id: p.user_id,
                choice_index: null,
                answer_text: null,
                is_correct: false,
                points_awarded: -timeoutPenalty,
                response_ms: question.time_limit_seconds * 1000,
              })),
              { onConflict: "session_id,question_id,user_id", ignoreDuplicates: true }
            );
          }
        }

        const { count: pendingCount } = await admin
          .from("answers")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session_id)
          .eq("question_id", question?.id)
          .is("is_correct", null);

        const leaderboard = await computeLeaderboard(admin, session_id);

        await broadcast(admin, session_id, "question_ended", {
          question_id: question?.id,
          correct_choice: question?.correct_choice ?? null,
          accepted_answers: question?.accepted_answers ?? null,
          leaderboard,
          pending_manual_grades: pendingCount ?? 0,
        });

        return jsonResponse({ leaderboard, pending_manual_grades: pendingCount ?? 0 });
      }

      case "grade_answer": {
        const { session_id, answer_id, is_correct } = body;
        const { data: answerRow } = await admin
          .from("answers")
          .select("*, questions(points, penalty_points)")
          .eq("id", answer_id)
          .single();

        if (!answerRow) return jsonResponse({ error: "Answer not found" }, 404);

        const { data: session } = await admin
          .from("trivia_sessions")
          .select("status, mode")
          .eq("id", session_id)
          .single();

        const pointsAwarded = is_correct
          ? answerRow.questions?.points ?? 0
          : session?.mode === "hard"
          ? -resolveWrongPenalty(answerRow.questions ?? { points: 0, penalty_points: null })
          : 0;

        await admin
          .from("answers")
          .update({ is_correct, points_awarded: pointsAwarded, graded_by: user.id })
          .eq("id", answer_id);

        await broadcast(admin, session_id, "answer_graded", {
          user_id: answerRow.user_id,
          question_id: answerRow.question_id,
          is_correct,
          points_awarded: pointsAwarded,
        });

        const leaderboard = await computeLeaderboard(admin, session_id);
        await broadcast(admin, session_id, "leaderboard_update", { leaderboard });

        if (session?.status === "ended") {
          await broadcast(admin, session_id, "session_ended", { leaderboard });
        }

        return jsonResponse({ leaderboard });
      }

      case "end_session": {
        const { session_id } = body;
        const { data: session } = await admin
          .from("trivia_sessions")
          .select("*")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (!["lobby", "live", "grading"].includes(session.status)) {
          return jsonResponse({ error: "Session isn't running" }, 409);
        }

        await admin
          .from("trivia_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), spectator_id: null })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);

        const leaderboard = await computeLeaderboard(admin, session_id);
        await broadcast(admin, session_id, "session_ended", { leaderboard });

        return jsonResponse({ leaderboard });
      }

      case "claim_spectator": {
        const { session_id } = body;
        const claimError = await claimSpectatorSeat(admin, { table: "trivia_sessions", sessionId: session_id, userId: user.id });
        if (claimError) return claimError;
        return jsonResponse({ ok: true });
      }

      case "release_spectator": {
        const { session_id } = body;
        // Any mod can release the seat, not just whoever holds it — avoids
        // it getting permanently stuck if someone forgets to click "stop
        // watching" (e.g. closes their laptop mid-stream).
        await releaseSpectatorSeat(admin, "trivia_sessions", session_id);
        return jsonResponse({ ok: true });
      }

      case "force_release_lock": {
        // Same reasoning as release_spectator above, but for the cross-game
        // "only one session anywhere" lock: if a session ended abnormally
        // (crash, dropped connection) between marking itself ended and
        // releasing the lock, nothing else can start until this runs. Any
        // mod can call it, not just whoever was hosting.
        const released = await forceReleaseSessionLock(admin);
        return jsonResponse({ ok: true, released });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("trivia-host crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
