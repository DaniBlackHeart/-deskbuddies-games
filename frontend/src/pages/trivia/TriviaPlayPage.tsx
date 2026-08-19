import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import Timer from "../../components/Timer";
import { recordServerTime, correctedNow } from "../../lib/clockSync";
import Leaderboard from "../../components/Leaderboard";
import AnswerInput from "../../components/AnswerInput";
import { lobbyMusic, sounds } from "../../lib/sounds";
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
  const [timeExpired, setTimeExpired] = useState(false);
  const [mode, setMode] = useState<"chill" | "hard">("chill");
  const [wasNoShow, setWasNoShow] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const questionStartRef = useRef<number>(0);
  const currentQuestionIdRef = useRef<string | null>(null);

  async function hydrate() {
    const { data, error } = await supabase.functions.invoke("get-current-question", {
      body: { session_id: sessionId },
    });
    if (error) {
      console.error(error);
      return;
    }
    recordServerTime(data.server_now_ms);
    setMode(data.mode === "hard" ? "hard" : "chill");
    if (data.status === "ended") {
      setLeaderboard(data.leaderboard ?? []);
      setSessionCompleted(Boolean(data.completed));
      setPhase("ended");
      return;
    }
    setLeaderboard(data.leaderboard ?? []);
    if (!data.question) {
      setPhase("waiting");
      return;
    }
    setQuestion(data.question);
    currentQuestionIdRef.current = data.question.id;
    setDeadlineMs(data.deadline_ms);
    questionStartRef.current = data.deadline_ms - data.question.time_limit_seconds * 1000;
    if (data.existing_answer) {
      setMyChoice(data.existing_answer.choice_index ?? undefined);
      setMyText(data.existing_answer.answer_text ?? undefined);
      setMyResult({
        isCorrect: data.existing_answer.is_correct,
        points: data.existing_answer.points_awarded,
      });
      setWasNoShow(Boolean(data.existing_answer.was_no_show));
    } else {
      setMyChoice(undefined);
      setMyText(undefined);
      setMyResult(null);
      setWasNoShow(false);
    }
    setTimeExpired(data.status === "grading" || (data.deadline_ms ? correctedNow() > data.deadline_ms : false));
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
        currentQuestionIdRef.current = payload.question.id;
        setDeadlineMs(payload.deadline_ms);
        questionStartRef.current = payload.deadline_ms - payload.question.time_limit_seconds * 1000;
        setMyChoice(undefined);
        setMyText(undefined);
        setMyResult(null);
        setWasNoShow(false);
        setRevealed(null);
        setSubmitError(null);
        setTimeExpired(false);
        setPhase("question");
        sounds.questionFlash();
      })
      .on("broadcast", { event: "question_ended" }, ({ payload }: { payload: SessionEvent & { type: "question_ended" } }) => {
        setRevealed({ correctChoice: payload.correct_choice, acceptedAnswers: payload.accepted_answers });
        setLeaderboard(payload.leaderboard);
      })
      .on("broadcast", { event: "leaderboard_update" }, ({ payload }: { payload: SessionEvent & { type: "leaderboard_update" } }) => {
        setLeaderboard(payload.leaderboard);
      })
      .on("broadcast", { event: "answer_graded" }, ({ payload }: { payload: SessionEvent & { type: "answer_graded" } }) => {
        // Only react if this is a verdict on OUR OWN answer to the question
        // currently on screen — a MOD grading someone else's answer, or an
        // old question's pending answer, shouldn't touch our current state.
        // Uses a ref (not the `question` state) because this listener closure
        // is set up once and would otherwise only ever see its initial value.
        if (payload.user_id === profile?.id && payload.question_id === currentQuestionIdRef.current) {
          setMyResult({ isCorrect: payload.is_correct, points: payload.points_awarded });
        }
      })
      .on("broadcast", { event: "session_ended" }, ({ payload }: { payload: SessionEvent & { type: "session_ended" } }) => {
        setLeaderboard(payload.leaderboard);
        setSessionCompleted(payload.completed);
        setPhase("ended");
      })
      .on("broadcast", { event: "lobby_update" }, ({ payload }: { payload: SessionEvent & { type: "lobby_update" } }) => {
        if (payload.started) sounds.sessionStart();
        hydrate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Lobby BGM — plays only while sitting on the "waiting for the host"
  // screen, stops the instant the first question starts (or on unmount).
  useEffect(() => {
    if (phase === "waiting") {
      lobbyMusic.start();
    } else {
      lobbyMusic.stop();
    }
    return () => lobbyMusic.stop();
  }, [phase]);

  // Correct/wrong/no-answer sound — fires once per question, right as the
  // reveal (correct answer + standings) appears. A typed answer still
  // pending a MOD's manual grade has isCorrect === null and gets no sound
  // until it's actually graded.
  const playedResultForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!revealed || !question) return;
    if (playedResultForRef.current === question.id) return;
    if (wasNoShow || myResult == null) {
      playedResultForRef.current = question.id;
      sounds.noAnswer();
      return;
    }
    if (myResult.isCorrect === null) return; // pending manual grade — no sound yet
    playedResultForRef.current = question.id;
    if (myResult.isCorrect) sounds.correct();
    else sounds.wrong();
  }, [revealed, myResult, question, wasNoShow]);

  // Session-end sound on the final results screen — a "set finished" or
  // "ended early" intro, then top 3 get the winner sound, everyone else
  // gets the loser sound.
  const playedEndSoundRef = useRef(false);
  const latestEndDataRef = useRef({ leaderboard, myId: profile?.id });
  latestEndDataRef.current = { leaderboard, myId: profile?.id };
  useEffect(() => {
    if (phase !== "ended" || playedEndSoundRef.current) return;
    playedEndSoundRef.current = true;
    // The intro (finished vs. cut short) always plays. The winner/loser
    // follow-up only plays if we can actually tell — read from a ref
    // rather than closing over `leaderboard` directly, since this runs
    // after playSessionEnd's delay and the leaderboard may have arrived
    // after this effect fired.
    sounds.playSessionEnd(sessionCompleted, () => {
      const { leaderboard: lb, myId } = latestEndDataRef.current;
      const mine = lb.find((e) => e.user_id === myId);
      if (!mine) return; // no scored answers — no personal outcome to announce
      if (mine.rank <= 3) sounds.winner();
      else sounds.loser();
    });
  }, [phase, sessionCompleted]);

  async function handleSubmit(payload: { choiceIndex?: number; answerText?: string }) {
    if (!question || !sessionId) return;
    setSubmitError(null);
    setMyChoice(payload.choiceIndex);
    setMyText(payload.answerText);
    setWasNoShow(false);

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

        {mode === "hard" && (
          <p className="text-center hint" style={{ marginBottom: "8px" }}>
            ✅ +{question.points} · ❌ −{question.penalty_points} · ⌛ −
            {Math.round(question.points * 0.25)}
          </p>
        )}

        {!revealed && deadlineMs && <Timer deadline={deadlineMs} onExpire={() => setTimeExpired(true)} />}

        {!revealed && (
          <div style={{ marginTop: "16px" }}>
            <AnswerInput
              question={question}
              disabled={timeExpired}
              onSubmit={handleSubmit}
              submittedChoice={myChoice}
              submittedText={myText}
            />
            {(myChoice !== undefined || myText !== undefined) && !submitError && (
              <p className="text-muted text-center" style={{ marginTop: "12px" }}>
                Answer locked in! Waiting for the reveal…
              </p>
            )}
            {timeExpired && myChoice === undefined && myText === undefined && (
              <p className="text-muted text-center" style={{ marginTop: "12px" }}>
                ⏰ Time's up! Waiting for the host…
              </p>
            )}
            {submitError && <p className="error-text text-center">{submitError}</p>}
          </div>
        )}

        {revealed && (
          <div className="stack" style={{ marginTop: "16px" }}>
            {(myResult === null || wasNoShow) && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-text-muted)" }}>
                ⌛ You didn't answer in time.
                {mode === "hard" && (
                  <> −{myResult ? Math.abs(myResult.points) : Math.round(question.points * 0.25)} pts</>
                )}
              </p>
            )}
            {!wasNoShow && myResult?.isCorrect === true && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-success)" }}>
                ✅ Correct! +{myResult.points} pts
              </p>
            )}
            {!wasNoShow && myResult?.isCorrect === false && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                ❌ Not quite — that wasn't the answer.
                {mode === "hard" && <> {myResult.points} pts</>}
              </p>
            )}
            {!wasNoShow && myResult?.isCorrect === null && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-warning)" }}>
                ⏳ Your answer is being reviewed by a MOD.
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
