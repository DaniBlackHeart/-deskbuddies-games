import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Leaderboard from "../../components/Leaderboard";
import RebusTeamLeaderboard from "../../components/RebusTeamLeaderboard";
import Timer from "../../components/Timer";
import { supabase } from "../../lib/supabaseClient";
import { recordServerTime } from "../../lib/clockSync";
import type {
  PublicRebusPuzzle,
  RebusLeaderboardEntry,
  RebusSessionEvent,
  RebusSessionStatus,
  RebusTeamLeaderboardEntry,
} from "../../types";

type Phase = "loading" | "claim_failed" | RebusSessionStatus;

type ParticipantStatus = { user_id: string; username: string; avatar_url: string | null; hasAnswered: boolean };

export default function RebusSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chill" | "hard">("chill");
  const [gameMode, setGameMode] = useState<"solo" | "team">("solo");
  const [leaderboard, setLeaderboard] = useState<RebusLeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<RebusTeamLeaderboardEntry[] | null>(null);

  const [puzzle, setPuzzle] = useState<PublicRebusPuzzle | null>(null);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{ answer_text: string; accepted_answers: string[] } | null>(null);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);

  const [sprintPlayer1, setSprintPlayer1] = useState<{ user_id: string; username: string } | null>(null);
  const [sprintPlayer2, setSprintPlayer2] = useState<{ user_id: string; username: string } | null>(null);
  const [sprintP1Points, setSprintP1Points] = useState(0);
  const [sprintP2Points, setSprintP2Points] = useState(0);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);
  const [sprintDeadlineMs, setSprintDeadlineMs] = useState<number | null>(null);

  const [finalist, setFinalist] = useState<{ user_id: string; username: string } | null>(null);
  const [finalPuzzle, setFinalPuzzle] = useState<{ id: string; display_text: string; points: number; time_limit_seconds: number } | null>(null);
  const [finalDeadlineMs, setFinalDeadlineMs] = useState<number | null>(null);
  const [finalRevealed, setFinalRevealed] = useState<{ answer_text: string; accepted_answers: string[] } | null>(null);

  const currentPuzzleIdRef = useRef<string | null>(null);

  async function loadParticipantStatus(puzzleId: string | null) {
    const { data: participantRows } = await supabase
      .from("rebus_participants")
      .select("user_id, profiles(username, avatar_url)")
      .eq("session_id", sessionId);

    let answeredIds = new Set<string>();
    if (puzzleId) {
      const { data: answerRows } = await supabase.from("rebus_answers").select("user_id").eq("session_id", sessionId).eq("puzzle_id", puzzleId);
      answeredIds = new Set((answerRows ?? []).map((a) => a.user_id));
    }

    setParticipants(
      (participantRows ?? []).map((p: any) => ({
        user_id: p.user_id,
        username: p.profiles?.username ?? "Unknown",
        avatar_url: p.profiles?.avatar_url ?? null,
        hasAnswered: answeredIds.has(p.user_id),
      }))
    );
  }

  async function hydrate() {
    const { data, error } = await supabase.functions.invoke("get-rebus-state", { body: { session_id: sessionId, spectator: true } });
    if (error) {
      console.error(error);
      return;
    }
    recordServerTime(data.server_now_ms);
    setMode(data.mode === "hard" ? "hard" : "chill");
    setGameMode(data.game_mode === "team" ? "team" : "solo");
    setLeaderboard(data.leaderboard ?? []);
    setTeamLeaderboard(data.team_leaderboard ?? null);
    setPhase(data.status);

    if (data.status === "live" || data.status === "reveal") {
      setPuzzle(data.puzzle ?? null);
      currentPuzzleIdRef.current = data.puzzle?.id ?? null;
      setDeadlineMs(data.deadline_ms ?? null);
      setRevealed(data.revealed ?? null);
      loadParticipantStatus(data.puzzle?.id ?? null);
    }

    if (["sprint_setup", "sprint_p1", "sprint_p2", "sprint_done"].includes(data.status)) {
      setSprintPlayer1(data.sprint_player1 ?? null);
      setSprintPlayer2(data.sprint_player2 ?? null);
      setSprintP1Points(data.sprint_p1_points ?? 0);
      setSprintP2Points(data.sprint_p2_points ?? 0);
      setActiveSlot(data.active_slot ?? null);
      setSprintDeadlineMs(data.deadline_ms ?? null);
    }

    if (data.status === "final_live" || data.status === "final_reveal") {
      setFinalist(data.finalist ?? null);
      setFinalPuzzle(data.puzzle ?? null);
      setFinalDeadlineMs(data.deadline_ms ?? null);
      setFinalRevealed(data.revealed ?? null);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    async function claimAndStart() {
      const { data, error } = await supabase.functions.invoke("rebus-host", { body: { action: "claim_spectator", session_id: sessionId } });
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
      .channel(`rebus-session-${sessionId}`)
      .on("broadcast", { event: "lobby_update" }, () => hydrate())
      .on("broadcast", { event: "puzzle_started" }, ({ payload }: { payload: RebusSessionEvent & { type: "puzzle_started" } }) => {
        setPhase("live");
        setPuzzle(payload.puzzle);
        currentPuzzleIdRef.current = payload.puzzle.id;
        setDeadlineMs(payload.deadline_ms);
        setRevealed(null);
        loadParticipantStatus(payload.puzzle.id);
      })
      .on("broadcast", { event: "puzzle_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "puzzle_ended" } }) => {
        setPhase("reveal");
        setRevealed({ answer_text: payload.answer_text ?? "", accepted_answers: payload.accepted_answers });
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
      })
      .on("broadcast", { event: "round_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "round_ended" } }) => {
        setPhase("round_ended");
        setPuzzle(null);
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
      })
      .on("broadcast", { event: "sprint_setup" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_setup" } }) => {
        setPhase("sprint_setup");
        setSprintPlayer1(payload.player1);
        setSprintPlayer2(payload.player2);
        setSprintP1Points(0);
        setSprintP2Points(0);
        setActiveSlot(null);
      })
      .on("broadcast", { event: "sprint_player_started" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_player_started" } }) => {
        setPhase(payload.player_slot === 1 ? "sprint_p1" : "sprint_p2");
        setActiveSlot(payload.player_slot);
        setSprintDeadlineMs(payload.deadline_ms);
      })
      .on("broadcast", { event: "sprint_progress" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_progress" } }) => {
        if (payload.player_slot === 1) setSprintP1Points(payload.points);
        else setSprintP2Points(payload.points);
      })
      .on("broadcast", { event: "sprint_done" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_done" } }) => {
        setPhase("sprint_done");
        setSprintP1Points(payload.p1_points);
        setSprintP2Points(payload.p2_points);
        setActiveSlot(null);
      })
      .on("broadcast", { event: "final_started" }, ({ payload }: { payload: RebusSessionEvent & { type: "final_started" } }) => {
        setPhase("final_live");
        setFinalist(payload.finalist);
        setFinalPuzzle(payload.puzzle);
        setFinalDeadlineMs(payload.deadline_ms);
        setFinalRevealed(null);
      })
      .on("broadcast", { event: "final_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "final_ended" } }) => {
        setPhase("final_reveal");
        setFinalRevealed({ answer_text: payload.answer_text ?? "", accepted_answers: payload.accepted_answers });
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
      })
      .on("broadcast", { event: "session_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "session_ended" } }) => {
        setPhase("ended");
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
      })
      .subscribe();

    const answersChannel = supabase
      .channel(`spectator-rebus-answers-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_answers", filter: `session_id=eq.${sessionId}` }, () =>
        loadParticipantStatus(currentPuzzleIdRef.current)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_participants", filter: `session_id=eq.${sessionId}` }, () =>
        loadParticipantStatus(currentPuzzleIdRef.current)
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
    await supabase.functions.invoke("rebus-host", { body: { action: "release_spectator", session_id: sessionId } });
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
            <span className="badge badge-neutral">{gameMode === "team" ? "🤝 TEAM" : "🙋 SOLO"}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleStopWatching}>
              Stop watching
            </button>
          </div>
        </div>

        {phase === "lobby" && (
          <div className="card text-center" style={{ marginTop: "16px" }}>
            <p className="text-muted">Waiting for the host to start…</p>
          </div>
        )}

        {(phase === "live" || phase === "reveal") && puzzle && (
          <div className="card" style={{ marginTop: "16px" }}>
            <div className="row-between">
              <span className="badge badge-neutral">
                Puzzle {puzzle.order_index + 1} / {puzzle.total_puzzles}
              </span>
              {!revealed && deadlineMs && <Timer deadline={deadlineMs} />}
            </div>
            <div className="rebus-puzzle-display" style={{ marginTop: "12px" }}>{puzzle.display_text}</div>
            {revealed && (
              <p className="text-muted text-center">
                Answer: <strong>{revealed.answer_text}</strong>
              </p>
            )}
            <p className="text-center text-muted" style={{ marginTop: "8px" }}>
              {answeredCount} / {participants.length} have answered
            </p>
          </div>
        )}

        {(phase === "live" || phase === "reveal") && participants.length > 0 && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h3>Who's answered</h3>
            <div className="stack">
              {participants.map((p) => (
                <div key={p.user_id} className="row-between">
                  <div className="row" style={{ gap: "8px" }}>
                    {p.avatar_url && <img src={p.avatar_url} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />}
                    <span>{p.username}</span>
                  </div>
                  <span>{p.hasAnswered ? "✅" : "⏳"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "round_ended" && (
          <div className="card text-center" style={{ marginTop: "16px" }}>
            <p className="text-muted">Rounds 1-3 complete — waiting for the host to set up the Sprint Round…</p>
          </div>
        )}

        {(phase === "sprint_setup" || phase === "sprint_p1" || phase === "sprint_p2" || phase === "sprint_done") && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h3 className="text-center">⚡ Sprint Round</h3>
            <div className="row-between">
              <div className="text-center" style={{ flex: 1 }}>
                <strong>{sprintPlayer1?.username ?? "Player 1"}</strong>
                <p style={{ fontSize: "1.4rem", fontWeight: 800, margin: "4px 0" }}>{sprintP1Points}</p>
                {activeSlot === 1 && <span className="badge badge-live">🔴 Sprinting</span>}
              </div>
              <div className="text-center" style={{ flex: 1 }}>
                <strong>{sprintPlayer2?.username ?? "Player 2"}</strong>
                <p style={{ fontSize: "1.4rem", fontWeight: 800, margin: "4px 0" }}>{sprintP2Points}</p>
                {activeSlot === 2 && <span className="badge badge-live">🔴 Sprinting</span>}
              </div>
            </div>
            {sprintDeadlineMs && (activeSlot === 1 || activeSlot === 2) && <Timer deadline={sprintDeadlineMs} />}
            <p className="text-muted text-center" style={{ marginTop: "8px" }}>
              Puzzle content stays hidden here too — even for spectators — so the Sprint stays fair.
            </p>
          </div>
        )}

        {(phase === "final_live" || phase === "final_reveal") && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h3 className="text-center">🎇 Final Round</h3>
            <p className="text-center text-muted">
              <strong>{finalist?.username}</strong> is going for {finalPuzzle?.points ?? 1000} points!
            </p>
            {finalPuzzle && <div className="rebus-puzzle-display">{finalPuzzle.display_text}</div>}
            {phase === "final_live" && finalDeadlineMs && <Timer deadline={finalDeadlineMs} />}
            {finalRevealed && (
              <p className="text-muted text-center">
                Answer: <strong>{finalRevealed.answer_text}</strong>
              </p>
            )}
          </div>
        )}

        {phase === "ended" && (
          <div className="card" style={{ marginTop: "16px" }}>
            <h2 className="text-center">🎉 Final Results</h2>
            {gameMode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} />}
            <div style={{ marginTop: gameMode === "team" ? "16px" : 0 }}>
              <Leaderboard entries={leaderboard} />
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: "16px" }}>
          <h3>Standings</h3>
          {gameMode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} />}
          <div style={{ marginTop: gameMode === "team" ? "16px" : 0 }}>
            <Leaderboard entries={leaderboard} />
          </div>
        </div>
      </div>
    </div>
  );
}
