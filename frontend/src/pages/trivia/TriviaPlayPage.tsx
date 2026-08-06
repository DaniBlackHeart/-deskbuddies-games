import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import Timer from "../../components/Timer";
import Leaderboard from "../../components/Leaderboard";
import AnswerInput from "../../components/AnswerInput";
import type { LeaderboardEntry, PublicQuestion, SessionEvent } from "../../types";

type Phase = "loading" | "waiting" | "question" | "ended";

export default function TriviaPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{
    correctChoice: number | null;
    acceptedAnswers: string[] | null;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myChoice, setMyChoice] = useState<number | undefined>(undefined);
  const [myText, setMyText] = useState<string | undefined>(undefined);
  const [myResult, setMyResult] = useState<{ isCorrect: boolean | null; points: number } | null>(
    null
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const questionStartRef = useRef<number>(0);

  async function hydrate() {
    const { data, error } = await supabase.functions.invoke("get-current-question", {
      body: { session_id: sessionId },
    });
    if (error) {
      console.error(error);
      return;
    }
    if (data.status === "ended") {
      setLeaderboard(data.leaderboard ?? []);
      setPhase("ended");
      return;
    }
    setLeaderboard(data.leaderboard ?? []);
    if (!data.question) {
      setPhase("waiting");
      return;
    }
    setQuestion(data.question);
    setDeadlineMs(data.deadline_ms);
    questionStartRef.current = data.deadline_ms - data.question.time_limit_seconds * 1000;
    if (data.existing_answer) {
      setMyChoice(data.existing_answer.choice_index ?? undefined);
      setMyText(data.existing_answer.answer_text ?? undefined);
      setMyResult({
        isCorrect: data.existing_answer.is_correct,
        points: data.existing_answer.points_awarded,
      });
    } else {
      setMyChoice(undefined);
      setMyText(undefined);
      setMyResult(null);
    }
    setPhase(data.status === "grading" ? "question" : "question");
    setRevealed(null);
    if (data.status === "grading") {
      // We reconnected mid-reveal; we don't have the reveal payload from a
      // fresh fetch, so just show the leaderboard-only state until next question.
      setRevealed({ correctChoice: null, acceptedAnswers: null });
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    hydrate();

    const channel = supabase
      .channel(`trivia-session-${sessionId}`)
      .on("broadcast", { event: "question_started" }, ({ payload }: { payload: SessionEvent & { type: "question_started" } }) => {
        setQuestion(payload.question);
        setDeadlineMs(payload.deadline_ms);
        questionStartRef.current = payload.deadline_ms - payload.question.time_limit_seconds * 1000;
        setMyChoice(undefined);
        setMyText(undefined);
        setMyResult(null);
        setRevealed(null);
        setSubmitError(null);
        setPhase("question");
      })
      .on("broadcast", { event: "question_ended" }, ({ payload }: { payload: SessionEvent & { type: "question_ended" } }) => {
        setRevealed({ correctChoice: payload.correct_choice, acceptedAnswers: payload.accepted_answers });
        setLeaderboard(payload.leaderboard);
      })
      .on("broadcast", { event: "leaderboard_update" }, ({ payload }: { payload: SessionEvent & { type: "leaderboard_update" } }) => {
        setLeaderboard(payload.leaderboard);
      })
      .on("broadcast", { event: "session_ended" }, ({ payload }: { payload: SessionEvent & { type: "session_ended" } }) => {
        setLeaderboard(payload.leaderboard);
        setPhase("ended");
      })
      .on("broadcast", { event: "lobby_update" }, () => {
        hydrate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSubmit(payload: { choiceIndex?: number; answerText?: string }) {
    if (!question || !sessionId) return;
    setSubmitError(null);
    setMyChoice(payload.choiceIndex);
    setMyText(payload.answerText);

    const responseMs = Math.max(0, Date.now() - questionStartRef.current);

    const { data, error } = await supabase.functions.invoke("trivia-answer", {
      body: {
        session_id: sessionId,
        question_id: question.id,
        choice_index: payload.choiceIndex,
        answer_text: payload.answerText,
        response_ms: responseMs,
      },
    });

    if (error || data?.error) {
      setSubmitError(data?.error ?? "Couldn't submit your answer. It may be too late.");
      return;
    }

    setMyResult({ isCorrect: data.is_correct, points: data.points_awarded });
  }

  if (phase === "loading") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="center-screen">
        <div className="card container--narrow text-center">
          <div style={{ fontSize: "2.5rem" }}>🍿</div>
          <h1>Get comfy!</h1>
          <p className="text-muted">Waiting for the host to start the first question…</p>
        </div>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="center-screen">
        <div className="card container--narrow">
          <h1 className="text-center">🎉 Final Results</h1>
          <Leaderboard entries={leaderboard} highlightUserId={profile?.id} />
          <button className="btn btn-primary btn-block" style={{ marginTop: "20px" }} onClick={() => navigate("/")}>
            Back to games
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="center-screen">
      <div className="card container--narrow">
        <div className="row-between">
          <span className="badge badge-neutral">
            Question {question.order_index + 1} / {question.total_questions}
          </span>
          <span className="badge badge-live">🔴 Live</span>
        </div>

        <h2 style={{ marginTop: "16px" }}>{question.prompt}</h2>

        {!revealed && deadlineMs && <Timer deadline={deadlineMs} />}

        {!revealed && (
          <div style={{ marginTop: "16px" }}>
            <AnswerInput
              question={question}
              disabled={false}
              onSubmit={handleSubmit}
              submittedChoice={myChoice}
              submittedText={myText}
            />
            {(myChoice !== undefined || myText !== undefined) && !submitError && (
              <p className="text-muted text-center" style={{ marginTop: "12px" }}>
                Answer locked in! Waiting for the reveal…
              </p>
            )}
            {submitError && <p className="error-text text-center">{submitError}</p>}
          </div>
        )}

        {revealed && (
          <div className="stack" style={{ marginTop: "16px" }}>
            {myResult === null && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-text-muted)" }}>
                ⌛ You didn't answer in time.
              </p>
            )}
            {myResult?.isCorrect === true && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-success)" }}>
                ✅ Correct! +{myResult.points} pts
              </p>
            )}
            {myResult?.isCorrect === false && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                ❌ Not quite.
              </p>
            )}
            {myResult?.isCorrect === null && myResult !== undefined && myChoice === undefined && myText !== undefined && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-warning)" }}>
                ⏳ Waiting on a MOD to review your answer.
              </p>
            )}

            {question.type === "multiple_choice" && revealed.correctChoice !== null && question.choices && (
              <p className="text-muted text-center">
                Correct answer: <strong>{question.choices[revealed.correctChoice]}</strong>
              </p>
            )}
            {question.type === "typed" && revealed.acceptedAnswers && (
              <p className="text-muted text-center">
                Accepted answers: <strong>{revealed.acceptedAnswers.join(", ")}</strong>
              </p>
            )}

            <h3 className="text-center" style={{ marginTop: "8px" }}>
              Standings
            </h3>
            <Leaderboard entries={leaderboard} highlightUserId={profile?.id} />
            <p className="text-muted text-center">Waiting for the host to continue…</p>
          </div>
        )}
      </div>
    </div>
  );
}
