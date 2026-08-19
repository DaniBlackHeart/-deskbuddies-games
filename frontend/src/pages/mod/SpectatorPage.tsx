import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Leaderboard from "../../components/Leaderboard";
import Timer from "../../components/Timer";
import { supabase } from "../../lib/supabaseClient";
import { recordServerTime } from "../../lib/clockSync";
import type { LeaderboardEntry, PublicQuestion, SessionEvent, SessionMode } from "../../types";

type Phase = "loading" | "claim_failed" | "waiting" | "question" | "ended";

type ParticipantStatus = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  hasAnswered: boolean;
};

export default function SpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [mode, setMode] = useState<SessionMode>("chill");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{
    correctChoice: number | null;
    acceptedAnswers: string[] | null;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const currentQuestionIdRef = useRef<string | null>(null);

  async function loadParticipantStatus(questionId: string | null) {
    const { data: participantRows } = await supabase
      .from("session_participants")
      .select("user_id, profiles(username, avatar_url)")
      .eq("session_id", sessionId);

    let answeredIds = new Set<string>();
    if (questionId) {
      const { data: answerRows } = await supabase
        .from("answers")
        .select("user_id")
        .eq("session_id", sessionId)
        .eq("question_id", questionId);
      answeredIds = new Set((answerRows ?? []).map((a) => a.user_id));
    }

    const list: ParticipantStatus[] = (participantRows ?? []).map((p: any) => ({
      user_id: p.user_id,
      username: p.profiles?.username ?? "Unknown",
      avatar_url: p.profiles?.avatar_url ?? null,
      hasAnswered: answeredIds.has(p.user_id),
    }));
    setParticipants(list);
  }

  async function hydrate() {
    const { data, error } = await supabase.functions.invoke("get-current-question", {
      body: { session_id: sessionId, spectator: true },
    });
    if (error) {
      console.error(error);
      return;
    }
    recordServerTime(data.server_now_ms);
    setMode(data.mode === "hard" ? "hard" : "chill");
    setLeaderboard(data.leaderboard ?? []);

    if (data.status === "ended") {
      setPhase("ended");
      return;
    }
    if (!data.question) {
      setPhase("waiting");
      currentQuestionIdRef.current = null;
      loadParticipantStatus(null);
      return;
    }

    setQuestion(data.question);
    currentQuestionIdRef.current = data.question.id;
    setDeadlineMs(data.deadline_ms);
    setRevealed(data.status === "grading" ? { correctChoice: null, acceptedAnswers: null } : null);
    setPhase("question");
    loadParticipantStatus(data.question.id);
  }

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    async function claimAndStart() {
      const { data, error } = await supabase.functions.invoke("trivia-host", {
        body: { action: "claim_spectator", session_id: sessionId },
      });
      if (!isMounted) return;
      if (error || data?.error) {
        setClaimError(data?.error ?? "Could not claim the spectator seat.");
        setPhase("claim_failed");
        return;
      }
      hydrate();
    }

    claimAndStart();

    const channel = supabase
      .channel(`trivia-session-${sessionId}`)
      .on("broadcast", { event: "question_started" }, ({ payload }: { payload: SessionEvent & { type: "question_started" } }) => {
        setQuestion(payload.question);
        currentQuestionIdRef.current = payload.question.id;
        setDeadlineMs(payload.deadline_ms);
        setRevealed(null);
        setPhase("question");
        loadParticipantStatus(payload.question.id);
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
      .on("broadcast", { event: "lobby_update" }, () => hydrate())
      .subscribe();

    const answersChannel = supabase
      .channel(`spectator-answers-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` },
        () => loadParticipantStatus(currentQuestionIdRef.current)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${sessionId}` },
        () => loadParticipantStatus(currentQuestionIdRef.current)
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(answersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleStopWatching() {
    await supabase.functions.invoke("trivia-host", {
      body: { action: "release_spectator", session_id: sessionId },
    });
    navigate("/mod");
  }

  if (phase === "loading") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (phase === "claim_failed") {
    return (
      <div className="center-screen">
        <div className="card container--narrow text-center">
          <div style={{ fontSize: "2.5rem" }}>👀</div>
          <h1>Seat taken</h1>
          <p className="text-muted">{claimError}</p>
          <button className="btn btn-secondary" onClick={() => navigate("/mod")}>
            Back to MOD dashboard
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = participants.filter((p) => p.hasAnswered).length;

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between">
          <div>
            <h1>👀 Spectator View</h1>
            <p className="text-muted" style={{ marginTop: "-8px" }}>
              Read-only — great for screen-sharing to members who just want to watch.
            </p>
          </div>
          <div className="row">
            <span className="badge badge-neutral">{mode === "hard" ? "🔥 HARD" : "😌 CHILL"}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleStopWatching}>
              Stop watching
            </button>
          </div>
        </div>

        {phase === "waiting" && (
          <div className="card text-center" style={{ marginTop: "16px" }}>
            <p className="text-muted">Waiting for the host to start the first question…</p>
          </div>
        )}

        {phase === "ended" && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h2 className="text-center">🎉 Final Results</h2>
            <Leaderboard entries={leaderboard} />
          </div>
        )}

        {phase === "question" && question && (
          <div className="card" style={{ marginTop: "16px" }}>
            <div className="row-between">
              <span className="badge badge-neutral">
                Question {question.order_index + 1} / {question.total_questions}
              </span>
              {!revealed && deadlineMs && <Timer deadline={deadlineMs} />}
            </div>
            <h2 style={{ marginTop: "12px" }}>{question.prompt}</h2>

            {mode === "hard" && !revealed && (
              <p className="text-center hint">
                ✅ +{question.points} · ❌ −{question.penalty_points} · ⌛ −
                {Math.round(question.points * 0.25)}
              </p>
            )}

            {revealed && (
              <>
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
              </>
            )}

            <p className="text-center text-muted" style={{ marginTop: "8px" }}>
              {answeredCount} / {participants.length} have answered
            </p>
          </div>
        )}

        {(phase === "question" || phase === "waiting") && participants.length > 0 && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h3>Who's answered</h3>
            <div className="stack">
              {participants.map((p) => (
                <div key={p.user_id} className="row-between">
                  <div className="row" style={{ gap: "8px" }}>
                    {p.avatar_url && (
                      <img src={p.avatar_url} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />
                    )}
                    <span>{p.username}</span>
                  </div>
                  <span>{p.hasAnswered ? "✅" : "⏳"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: "16px" }}>
          <h3>Standings</h3>
          <Leaderboard entries={leaderboard} />
        </div>
      </div>
    </div>
  );
}
