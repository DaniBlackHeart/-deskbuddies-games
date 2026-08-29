import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Leaderboard from "../../components/Leaderboard";
import Timer from "../../components/Timer";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { Answer, LeaderboardEntry, TriviaSession, TriviaSessionQuestion } from "../../types";

type PendingAnswer = Answer & { profiles: { username: string } | null; questions: { prompt: string; order_index: number } | null };

export default function HostSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<TriviaSession | null>(null);
  const [setName, setSetName] = useState("");
  const [questions, setQuestions] = useState<TriviaSessionQuestion[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pending, setPending] = useState<PendingAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const autoEndedIndexRef = useRef<number | null>(null);

  const currentQuestion = session
    ? questions.find((q) => q.order_index === session.current_question_index) ?? null
    : null;
  const isLastQuestion = currentQuestion ? currentQuestion.order_index + 1 >= questions.length : false;

  async function loadSession() {
    const { data } = await supabase.from("trivia_sessions").select("*").eq("id", sessionId).single();
    setSession(data);
  }

  async function loadPending() {
    const { data, error } = await supabase
      .from("answers")
      .select("*, profiles!user_id(username), questions:trivia_session_questions(prompt, order_index)")
      .eq("session_id", sessionId)
      .is("is_correct", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("loadPending failed:", error);
      return;
    }
    setPending((data as unknown as PendingAnswer[]) ?? []);
  }

  async function loadLeaderboard() {
    const { data: participants } = await supabase
      .from("session_participants")
      .select("user_id, profiles(username, avatar_url)")
      .eq("session_id", sessionId);
    const { data: answers } = await supabase
      .from("answers")
      .select("user_id, points_awarded")
      .eq("session_id", sessionId);

    const totals = new Map<string, number>();
    for (const p of participants ?? []) totals.set(p.user_id, 0);
    for (const a of answers ?? []) totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + a.points_awarded);

    const board = Array.from(totals.entries())
      .map(([user_id, total_points]) => {
        const p = (participants ?? []).find((x: any) => x.user_id === user_id);
        return {
          user_id,
          username: (p as any)?.profiles?.username ?? "Unknown",
          avatar_url: (p as any)?.profiles?.avatar_url ?? null,
          total_points,
        };
      })
      .sort((a, b) => b.total_points - a.total_points)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    setLeaderboard(board);
    setParticipantCount(participants?.length ?? 0);
  }

  async function init() {
    setLoading(true);
    const { data: sessionData } = await supabase.from("trivia_sessions").select("*").eq("id", sessionId).single();
    setSession(sessionData);
    if (sessionData) {
      // null question_set_id = a mixed session (random questions from
      // every set) — nothing to look up. Non-null = started from one
      // specific set, so show its name like before.
      if (sessionData.question_set_id) {
        const { data: setData } = await supabase
          .from("question_sets")
          .select("name")
          .eq("id", sessionData.question_set_id)
          .single();
        setSetName(setData?.name ?? "");
      } else {
        setSetName("");
      }
      const { data: qs } = await supabase
        .from("trivia_session_questions")
        .select("*")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true });
      setQuestions(qs ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    init();

    const sessionChannel = supabase
      .channel(`host-session-watch-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trivia_sessions", filter: `id=eq.${sessionId}` },
        () => loadSession()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` },
        () => {
          loadPending();
          loadLeaderboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${sessionId}` },
        () => loadLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    loadLeaderboard();
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.current_question_index]);

  async function callHost(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const { data, error } = await invokeFunction("trivia-host", { action, session_id: sessionId, ...extra });
    setBusy(false);
    if (error) {
      alert(error);
      return null;
    }
    return data;
  }

  async function handleStart() {
    await callHost("start_session");
    loadSession();
  }

  async function handleNext() {
    const data = await callHost("next_question");
    if (data?.done) {
      alert(data.message);
    }
    loadSession();
  }

  async function handleEndQuestion() {
    await callHost("end_question");
    loadSession();
  }

  async function handleTimerExpire() {
    // Guard: Timer can re-fire its onExpire if the component re-renders
    // near the boundary, and multiple mods could theoretically have this
    // page open at once — only the first to reach here for this question
    // index should actually trigger the end.
    if (!currentQuestion || autoEndedIndexRef.current === currentQuestion.order_index) return;
    autoEndedIndexRef.current = currentQuestion.order_index;
    await handleEndQuestion();
  }

  async function handleGrade(answerId: string, isCorrect: boolean) {
    await callHost("grade_answer", { answer_id: answerId, is_correct: isCorrect });
  }

  async function handleEndSession() {
    const message =
      session?.status === "lobby" ? "Cancel this session before it starts?" : "End the session for everyone?";
    if (!confirm(message)) return;
    await callHost("end_session");
    loadSession();
  }

  if (loading || !session) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const deadlineMs = session.current_question_started_at && currentQuestion
    ? new Date(session.current_question_started_at).getTime() + currentQuestion.time_limit_seconds * 1000
    : null;

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between">
          <div>
            <h1>{setName || "🧠 Trivia Night — Random Mix"}</h1>
            <p className="text-muted" style={{ marginTop: "-8px" }}>
              Join code <strong>{session.join_code}</strong> · {participantCount} joined
            </p>
          </div>
          <div className="row">
            <span className="badge badge-neutral">{session.mode === "hard" ? "🔥 HARD" : "😌 CHILL"}</span>
            <span className="badge badge-live">{session.status.toUpperCase()}</span>
          </div>
        </div>

        {session.status === "lobby" && (
          <div className="card text-center">
            <p>Members can join now from the Trivia Night tab. Start when you're ready.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={handleStart} disabled={busy}>
                {busy ? <span className="spinner" /> : "▶ Start Session"}
              </button>
              <button className="btn btn-ghost" onClick={handleEndSession} disabled={busy}>
                Cancel session
              </button>
            </div>
          </div>
        )}

        {session.status === "live" && !currentQuestion && (
          <div className="card text-center">
            <p>Session is live — members can join, but no question has started yet.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={handleNext} disabled={busy}>
                {busy ? <span className="spinner" /> : "▶ Start First Question"}
              </button>
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        {(session.status === "live" || session.status === "grading") && currentQuestion && (
          <div className="card">
            <div className="row-between">
              <span className="badge badge-neutral">
                Question {currentQuestion.order_index + 1} / {questions.length}
              </span>
              {session.status === "live" && deadlineMs && (
                <Timer deadline={deadlineMs} onExpire={handleTimerExpire} />
              )}
            </div>
            <h2 style={{ marginTop: "12px" }}>{currentQuestion.prompt}</h2>
            <p className="hint">
              {currentQuestion.points} pts
              {session.mode === "hard" && (
                <>
                  {" "}
                  · −{currentQuestion.penalty_points ?? Math.round(currentQuestion.points / 2)} if wrong · −
                  {Math.round(currentQuestion.points * 0.25)} if no answer
                </>
              )}
            </p>

            {currentQuestion.type === "multiple_choice" && currentQuestion.choices && (
              <div className="stack">
                {currentQuestion.choices.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      background:
                        i === currentQuestion.correct_choice ? "var(--color-success-soft)" : "var(--color-bg-alt)",
                      fontWeight: i === currentQuestion.correct_choice ? 700 : 400,
                    }}
                  >
                    {String.fromCharCode(65 + i)}) {c} {i === currentQuestion.correct_choice && "✓"}
                  </div>
                ))}
              </div>
            )}
            {currentQuestion.type === "typed" && (
              <p className="text-muted">Accepted answers: {currentQuestion.accepted_answers?.join(", ")}</p>
            )}

            {session.status === "grading" && isLastQuestion && (
              <p className="text-muted" style={{ marginTop: "12px" }}>
                That was the last question — end the session to reveal final results.
              </p>
            )}

            <div className="row" style={{ marginTop: "16px" }}>
              {session.status === "live" && (
                <button className="btn btn-secondary" onClick={handleEndQuestion} disabled={busy}>
                  End question now
                </button>
              )}
              {session.status === "grading" && !isLastQuestion && (
                <button className="btn btn-primary" onClick={handleNext} disabled={busy}>
                  Next question →
                </button>
              )}
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h3>Needs your review ({pending.length})</h3>
            <p className="hint" style={{ marginTop: "-8px", marginBottom: "12px" }}>
              These stay here until graded, even after you've moved on to later questions.
            </p>
            <div className="stack">
              {pending.map((a) => (
                <div key={a.id} className="row-between">
                  <span>
                    <strong>{a.profiles?.username ?? "Unknown"}</strong> answered "{a.answer_text}" on{" "}
                    <em>
                      Q{(a.questions?.order_index ?? 0) + 1}: {a.questions?.prompt ?? "Unknown question"}
                    </em>
                  </span>
                  <div className="row">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleGrade(a.id, true)}>
                      ✓ Correct
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleGrade(a.id, false)}>
                      ✕ Incorrect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: "16px" }}>
          <h3>Standings</h3>
          <Leaderboard entries={leaderboard} />
        </div>

        {session.status === "ended" && (
          <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => navigate("/mod")}>
            Back to MOD dashboard
          </button>
        )}
      </div>
    </div>
  );
}
