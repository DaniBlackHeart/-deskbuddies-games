import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Leaderboard from "../../components/Leaderboard";
import RebusTeamLeaderboard from "../../components/RebusTeamLeaderboard";
import Timer from "../../components/Timer";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { RebusLeaderboardEntry, RebusParticipant, RebusSession, RebusSessionPuzzle, RebusTeamLeaderboardEntry } from "../../types";

const STATUS_LABELS: Record<string, string> = {
  lobby: "Lobby",
  live: "Live",
  reveal: "Reveal",
  round_ended: "Rounds 1-3 complete",
  sprint_setup: "Sprint — ready to start",
  sprint_p1: "Sprint — Player 1",
  sprint_p2: "Sprint — Player 2",
  sprint_done: "Sprint complete",
  final_live: "Final Round — live",
  final_reveal: "Final Round — reveal",
  ended: "Ended",
};

export default function HostRebusSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<RebusSession | null>(null);
  const [mainPuzzles, setMainPuzzles] = useState<RebusSessionPuzzle[]>([]);
  // A session can snapshot up to REBUS_FINAL_CANDIDATES_PER_SESSION (5) Final
  // Round candidates now, not just one — the backend picks exactly one of
  // them at random when start_final runs and records it as
  // session.final_puzzle_id. So this page has to hold every candidate (to
  // know whether the set has any Final puzzle at all, before Final starts)
  // and separately derive which one is actually being played (below).
  const [finalCandidates, setFinalCandidates] = useState<RebusSessionPuzzle[]>([]);
  const [roster, setRoster] = useState<RebusParticipant[]>([]);
  const [leaderboard, setLeaderboard] = useState<RebusLeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<RebusTeamLeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sprintPlayer1, setSprintPlayer1] = useState("");
  const [sprintPlayer2, setSprintPlayer2] = useState("");
  const [finalistOverride, setFinalistOverride] = useState("");
  const autoEndedIndexRef = useRef<number | null>(null);

  // The realtime subscription below is set up once, in an effect keyed
  // only on [sessionId], so the handler closures it registers keep
  // whichever `session` value was in scope at that first render — forever
  // null, since `session` starts as null and the subscription is wired up
  // before the first loadSession() resolves. Without this ref,
  // loadLeaderboard()'s `if (!session) return` bails out on every single
  // realtime-triggered call for the rest of the page's life, which is
  // exactly why a MOD watching the lobby saw "0 joined" no matter how many
  // members joined, until a full reload re-ran everything from scratch
  // (found via a live playtest, 2026-08-28). Read sessionRef.current
  // instead of the closed-over `session` state anywhere this needs the
  // latest value from inside a callback that isn't guaranteed to be
  // re-created — same pattern RebusPlayPage.tsx already uses for
  // latestEndDataRef.
  const sessionRef = useRef<RebusSession | null>(null);
  sessionRef.current = session;

  const currentPuzzle = session ? mainPuzzles.find((p) => p.order_index === session.current_puzzle_index) ?? null : null;
  const isLastPuzzle = currentPuzzle ? currentPuzzle.order_index + 1 >= mainPuzzles.length : false;
  // Which candidate is actually being played, once start_final has picked
  // one — before that, session.final_puzzle_id is still null, so this stays
  // null too (that's fine: pre-final UI only needs finalCandidates.length).
  const finalPuzzle = session?.final_puzzle_id
    ? finalCandidates.find((p) => p.id === session.final_puzzle_id) ?? null
    : null;

  async function loadSession() {
    const { data } = await supabase.from("rebus_sessions").select("*").eq("id", sessionId).single();
    setSession(data);
  }

  // Deliberately has NO dependency on `session`/`sessionRef` — unlike
  // loadLeaderboard below, which needs the session row for sprint points
  // and can't run until it's loaded. The lobby's "N joined" count doesn't
  // need any of that, just the participant rows, so it's split out as its
  // own always-safe function rather than sharing loadLeaderboard's guard.
  // Wired to both the realtime rebus_participants handler AND a lobby-only
  // poll below — belt-and-suspenders after the sessionRef fix alone didn't
  // resolve a MOD-reported "still stuck on 0 joined" repeat (2026-08-29):
  // matches the pattern HostWheelSessionPage's loadRoster already uses
  // (no session guard there either), which hasn't had this complaint.
  async function loadRoster() {
    const { data } = await supabase
      .from("rebus_participants")
      .select("user_id, team_id, profiles(username, avatar_url)")
      .eq("session_id", sessionId);
    setRoster((data as unknown as RebusParticipant[]) ?? []);
  }

  async function loadLeaderboard() {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const [{ data: participants }, { data: answers }] = await Promise.all([
      supabase.from("rebus_participants").select("user_id, team_id, profiles(username, avatar_url)").eq("session_id", sessionId),
      supabase.from("rebus_answers").select("user_id, points_awarded").eq("session_id", sessionId),
    ]);

    const totals = new Map<string, number>();
    for (const p of participants ?? []) totals.set(p.user_id, 0);
    for (const a of answers ?? []) totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + a.points_awarded);
    if (currentSession.sprint_player1_id) totals.set(currentSession.sprint_player1_id, (totals.get(currentSession.sprint_player1_id) ?? 0) + currentSession.sprint_p1_points);
    if (currentSession.sprint_player2_id) totals.set(currentSession.sprint_player2_id, (totals.get(currentSession.sprint_player2_id) ?? 0) + currentSession.sprint_p2_points);

    const board = Array.from(totals.entries())
      .map(([user_id, total_points]) => {
        const p = (participants ?? []).find((x: any) => x.user_id === user_id);
        return {
          user_id,
          username: (p as any)?.profiles?.username ?? "Unknown",
          avatar_url: (p as any)?.profiles?.avatar_url ?? null,
          team_id: (p as any)?.team_id ?? null,
          total_points,
        };
      })
      .sort((a, b) => b.total_points - a.total_points)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    setLeaderboard(board);
    setRoster((participants as unknown as RebusParticipant[]) ?? []);

    if (currentSession.game_mode === "team") {
      const { data: teams } = await supabase.from("rebus_teams").select("id, name").eq("session_id", sessionId);
      const teamTotals = new Map<string, number>();
      for (const t of teams ?? []) teamTotals.set(t.id, 0);
      for (const entry of board) {
        if (entry.team_id) teamTotals.set(entry.team_id, (teamTotals.get(entry.team_id) ?? 0) + entry.total_points);
      }
      const teamBoard = Array.from(teamTotals.entries())
        .map(([team_id, total_points]) => ({ team_id, name: teams?.find((t) => t.id === team_id)?.name ?? "Unknown", total_points }))
        .sort((a, b) => b.total_points - a.total_points)
        .map((e, i) => ({ ...e, rank: i + 1 }));
      setTeamLeaderboard(teamBoard);
    } else {
      setTeamLeaderboard(null);
    }
  }

  async function init() {
    setLoading(true);
    const { data: sessionData } = await supabase.from("rebus_sessions").select("*").eq("id", sessionId).single();
    setSession(sessionData);
    if (sessionData) {
      const { data: puzzles } = await supabase
        .from("rebus_session_puzzles")
        .select("*")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true });
      setMainPuzzles((puzzles ?? []).filter((p) => p.round !== "final"));
      setFinalCandidates((puzzles ?? []).filter((p) => p.round === "final"));
    }
    setLoading(false);
  }

  useEffect(() => {
    init();

    const sessionChannel = supabase
      .channel(`host-rebus-watch-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_sessions", filter: `id=eq.${sessionId}` }, () => loadSession())
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_answers", filter: `session_id=eq.${sessionId}` }, () => loadLeaderboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_participants", filter: `session_id=eq.${sessionId}` }, () => {
        loadRoster();
        loadLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.current_puzzle_index, session?.sprint_p1_points, session?.sprint_p2_points]);

  // Belt-and-suspenders for the lobby "N joined" count specifically: a MOD
  // still reported it stuck at 0 after the realtime-closure fix above, so
  // rather than keep guessing at what's swallowing the postgres_changes
  // event for this one connection, poll loadRoster() every few seconds
  // while the lobby is open — cheap (one lightweight query), only runs
  // pre-session, and guarantees the count is never more than a few seconds
  // stale regardless of whatever's actually blocking the realtime push.
  useEffect(() => {
    if (session?.status !== "lobby") return;
    const interval = setInterval(loadRoster, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  async function callHost(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const { data, error } = await invokeFunction("rebus-host", { action, session_id: sessionId, ...extra });
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

  async function handleNextPuzzle() {
    await callHost("next_puzzle");
    loadSession();
  }

  async function handleEndPuzzle() {
    await callHost("end_puzzle");
    loadSession();
  }

  async function handleTimerExpire() {
    if (!currentPuzzle || autoEndedIndexRef.current === currentPuzzle.order_index) return;
    autoEndedIndexRef.current = currentPuzzle.order_index;
    await handleEndPuzzle();
  }

  async function handleSetupSprint() {
    await callHost("setup_sprint", { player1_id: sprintPlayer1, player2_id: sprintPlayer2 });
    loadSession();
  }

  async function handleStartSprintPlayer() {
    await callHost("start_sprint_player");
    loadSession();
  }

  async function handleEndSprint() {
    await callHost("end_sprint");
    loadSession();
  }

  async function handleStartFinal() {
    await callHost("start_final", finalistOverride ? { finalist_user_id: finalistOverride } : {});
    loadSession();
  }

  async function handleEndFinal() {
    await callHost("end_final");
    loadSession();
  }

  async function handleEndSession() {
    const message = session?.status === "lobby" ? "Cancel this session before it starts?" : "End the session for everyone?";
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

  const deadlineMs = session.puzzle_started_at && currentPuzzle
    ? new Date(session.puzzle_started_at).getTime() + currentPuzzle.time_limit_seconds * 1000
    : null;
  const finalDeadlineMs = session.puzzle_started_at && finalPuzzle
    ? new Date(session.puzzle_started_at).getTime() + finalPuzzle.time_limit_seconds * 1000
    : null;
  const sprintDeadlineMs =
    session.status === "sprint_p1" && session.sprint_p1_deadline
      ? new Date(session.sprint_p1_deadline).getTime()
      : session.status === "sprint_p2" && session.sprint_p2_deadline
      ? new Date(session.sprint_p2_deadline).getTime()
      : null;

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between">
          <div>
            <h1>Type What You See</h1>
            <p className="text-muted" style={{ marginTop: "-8px" }}>
              {roster.length} joined
            </p>
          </div>
          <div className="row">
            <span className="badge badge-neutral">{session.mode === "hard" ? "🔥 HARD" : "😌 CHILL"}</span>
            <span className="badge badge-neutral">{session.game_mode === "team" ? "🤝 TEAM" : "🙋 SOLO"}</span>
            <span className="badge badge-live">{STATUS_LABELS[session.status] ?? session.status}</span>
          </div>
        </div>

        {session.status === "lobby" && (
          <div className="card text-center">
            <p>Members can join now from the Type What You See tab. Start when you're ready.</p>
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

        {session.status === "live" && !currentPuzzle && (
          <div className="card text-center">
            <p>Session is live — members can join, but no puzzle has started yet.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={handleNextPuzzle} disabled={busy}>
                {busy ? <span className="spinner" /> : "▶ Start First Puzzle"}
              </button>
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        {(session.status === "live" || session.status === "reveal") && currentPuzzle && (
          <div className="card">
            <div className="row-between">
              <span className="badge badge-neutral">
                Puzzle {currentPuzzle.order_index + 1} / {mainPuzzles.length}
              </span>
              {session.status === "live" && deadlineMs && <Timer deadline={deadlineMs} onExpire={handleTimerExpire} />}
            </div>
            <div className="rebus-puzzle-display" style={{ marginTop: "12px" }}>
              {currentPuzzle.display_text}
            </div>
            <p className="hint text-center">
              {currentPuzzle.points} + 300 speed bonus pts
              {session.mode === "hard" && (
                <>
                  {" "}
                  · −{Math.round(currentPuzzle.points / 2)} if wrong · −{Math.round(currentPuzzle.points * 0.25)} if no answer
                </>
              )}
            </p>
            <p className="text-muted text-center">
              Answer: <strong>{currentPuzzle.answer_text}</strong>
              {currentPuzzle.accepted_answers.length > 1 && ` (also: ${currentPuzzle.accepted_answers.filter((a) => a !== currentPuzzle.answer_text).join(", ")})`}
            </p>

            {session.status === "reveal" && isLastPuzzle && (
              <p className="text-muted text-center">That was the last puzzle in rounds 1-3 — hit Next to move to the Sprint Round setup.</p>
            )}

            <div className="row" style={{ marginTop: "16px", justifyContent: "center" }}>
              {session.status === "live" && (
                <button className="btn btn-secondary" onClick={handleEndPuzzle} disabled={busy}>
                  End puzzle now
                </button>
              )}
              {session.status === "reveal" && (
                <button className="btn btn-primary" onClick={handleNextPuzzle} disabled={busy}>
                  Next puzzle →
                </button>
              )}
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        {session.status === "round_ended" && (
          <div className="card">
            <h3>Set up the Sprint Round</h3>
            <p className="hint">Pick the two players who'll race through the Sprint pool, 30 seconds each.</p>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>Player 1</label>
                <select value={sprintPlayer1} onChange={(e) => setSprintPlayer1(e.target.value)}>
                  <option value="">Choose…</option>
                  {roster.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.profiles?.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Player 2</label>
                <select value={sprintPlayer2} onChange={(e) => setSprintPlayer2(e.target.value)}>
                  <option value="">Choose…</option>
                  {roster.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.profiles?.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row" style={{ marginTop: "12px" }}>
              <button
                className="btn btn-primary"
                disabled={!sprintPlayer1 || !sprintPlayer2 || sprintPlayer1 === sprintPlayer2 || busy}
                onClick={handleSetupSprint}
              >
                Set Sprint players
              </button>
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session here (skip Sprint & Final)
              </button>
            </div>
          </div>
        )}

        {session.status === "sprint_setup" && (
          <div className="card text-center">
            <p>
              Ready: <strong>{roster.find((p) => p.user_id === session.sprint_player1_id)?.profiles?.username}</strong> vs{" "}
              <strong>{roster.find((p) => p.user_id === session.sprint_player2_id)?.profiles?.username}</strong>
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={handleStartSprintPlayer} disabled={busy}>
                {busy ? <span className="spinner" /> : "▶ Start Player 1"}
              </button>
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        {(session.status === "sprint_p1" || session.status === "sprint_p2") && (
          <div className="card text-center">
            <p>
              <strong>{session.status === "sprint_p1" ? "Player 1" : "Player 2"}</strong> is sprinting —{" "}
              {session.status === "sprint_p1" ? session.sprint_p1_points : session.sprint_p2_points} pts so far
            </p>
            {sprintDeadlineMs && <Timer deadline={sprintDeadlineMs} onExpire={session.status === "sprint_p1" ? handleStartSprintPlayer : handleEndSprint} />}
            <div className="row" style={{ justifyContent: "center", marginTop: "12px" }}>
              {session.status === "sprint_p1" && (
                <button className="btn btn-primary" onClick={handleStartSprintPlayer} disabled={busy}>
                  End Player 1's turn → Start Player 2
                </button>
              )}
              {session.status === "sprint_p2" && (
                <button className="btn btn-primary" onClick={handleEndSprint} disabled={busy}>
                  End Sprint Round
                </button>
              )}
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        {session.status === "sprint_done" && (
          <div className="card text-center">
            <h3>Sprint results</h3>
            <p>
              Player 1: <strong>{session.sprint_p1_points}</strong> pts · Player 2: <strong>{session.sprint_p2_points}</strong> pts
            </p>
            {session.sprint_p1_points === session.sprint_p2_points && (
              <div className="field" style={{ maxWidth: "320px", margin: "0 auto" }}>
                <label>Tie! Pick who goes to the Final Round</label>
                <select value={finalistOverride} onChange={(e) => setFinalistOverride(e.target.value)}>
                  <option value="">Choose…</option>
                  <option value={session.sprint_player1_id ?? ""}>{roster.find((p) => p.user_id === session.sprint_player1_id)?.profiles?.username}</option>
                  <option value={session.sprint_player2_id ?? ""}>{roster.find((p) => p.user_id === session.sprint_player2_id)?.profiles?.username}</option>
                </select>
              </div>
            )}
            {finalCandidates.length === 0 && <p className="error-text">No Final Round puzzle has been authored yet — add one in the set editor first.</p>}
            <div className="row" style={{ justifyContent: "center", marginTop: "12px" }}>
              <button
                className="btn btn-primary"
                disabled={busy || finalCandidates.length === 0 || (session.sprint_p1_points === session.sprint_p2_points && !finalistOverride)}
                onClick={handleStartFinal}
              >
                ▶ Start Final Round
              </button>
              <button className="btn btn-danger" onClick={handleEndSession} disabled={busy}>
                End session here
              </button>
            </div>
          </div>
        )}

        {(session.status === "final_live" || session.status === "final_reveal") && (
          <div className="card">
            <p className="text-center">
              Finalist: <strong>{roster.find((p) => p.user_id === session.final_player_id)?.profiles?.username}</strong>
            </p>
            {finalPuzzle && <div className="rebus-puzzle-display">{finalPuzzle.display_text}</div>}
            {session.status === "final_live" && finalDeadlineMs && <Timer deadline={finalDeadlineMs} onExpire={handleEndFinal} />}
            {finalPuzzle && (
              <p className="text-muted text-center">
                Answer: <strong>{finalPuzzle.answer_text}</strong> · {finalPuzzle.points} pts
              </p>
            )}
            <div className="row" style={{ justifyContent: "center", marginTop: "12px" }}>
              {session.status === "final_live" && (
                <button className="btn btn-secondary" onClick={handleEndFinal} disabled={busy}>
                  End Final Round now
                </button>
              )}
              <button className={session.status === "final_reveal" ? "btn btn-primary" : "btn btn-danger"} onClick={handleEndSession} disabled={busy}>
                End session
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: "16px" }}>
          <h3>Standings</h3>
          {session.game_mode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} />}
          <div style={{ marginTop: session.game_mode === "team" ? "16px" : 0 }}>
            <Leaderboard entries={leaderboard} />
          </div>
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
