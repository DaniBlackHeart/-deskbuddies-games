import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Timer from "../../components/Timer";
import FeudBoard from "../../components/FeudBoard";
import TeamScoreboard from "../../components/TeamScoreboard";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { FeudParticipant, PublicFeudRound, Team } from "../../types";

type FastMoneyRevealedEntry = {
  question_index: number;
  prompt: string;
  player1: { answer_text: string; points_awarded: number } | null;
  player2: { answer_text: string; points_awarded: number } | null;
};

type FeudState = {
  session: {
    id: string;
    status: string;
    team_a_name: string;
    team_b_name: string;
    team_a_score: number;
    team_b_score: number;
    current_round_index: number;
    fastmoney_team: Team | null;
    fastmoney_player1_id: string | null;
    fastmoney_player2_id: string | null;
    fastmoney_total_points: number;
    fastmoney_p1_deadline_ms: number | null;
    fastmoney_p2_deadline_ms: number | null;
  };
  roster_a: FeudParticipant[];
  roster_b: FeudParticipant[];
  round: PublicFeudRound | null;
  fast_money_revealed: FastMoneyRevealedEntry[];
};

type Phase = "loading" | "claim_failed" | "ready";

export default function FeudSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [state, setState] = useState<FeudState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3500);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await invokeFunction<FeudState>("get-feud-state", { session_id: sessionId });
    if (error) {
      console.error(error);
      return;
    }
    setState(data);
    setPhase("ready");
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    async function claimAndStart() {
      const { error } = await invokeFunction("feud-host", { action: "claim_spectator", session_id: sessionId });
      if (!isMounted) return;
      if (error) {
        setClaimError(error);
        setPhase("claim_failed");
        return;
      }
      hydrate();
    }

    claimAndStart();

    const channel = supabase
      .channel(`feud-session-${sessionId}`)
      .on("broadcast", { event: "round_started" }, ({ payload }: any) => {
        showFlash(`Round ${payload.round_index + 1} — face-off!`);
        hydrate();
      })
      .on("broadcast", { event: "tiebreaker_started" }, () => {
        showFlash("⚡ Tied! Tiebreaker round starting…");
      })
      .on("broadcast", { event: "buzz_locked" }, () => hydrate())
      .on("broadcast", { event: "faceoff_correct" }, ({ payload }: any) => {
        showFlash(`✅ "${payload.text}" — ${payload.points} pts!`);
        hydrate();
      })
      .on("broadcast", { event: "faceoff_miss" }, () => {
        showFlash("❌ Not on the board!");
        hydrate();
      })
      .on("broadcast", { event: "faceoff_next_pair" }, () => hydrate())
      .on("broadcast", { event: "faceoff_all_missed" }, () => {
        showFlash("😬 Nobody took control!");
        hydrate();
      })
      .on("broadcast", { event: "board_started" }, () => hydrate())
      .on("broadcast", { event: "board_correct" }, ({ payload }: any) => {
        showFlash(`✅ "${payload.text}" — ${payload.points} pts!`);
        hydrate();
      })
      .on("broadcast", { event: "board_strike" }, () => {
        showFlash("❌ STRIKE!");
        hydrate();
      })
      .on("broadcast", { event: "board_cleared" }, () => {
        showFlash("🎉 Board cleared!");
        hydrate();
      })
      .on("broadcast", { event: "steal_started" }, () => {
        showFlash("🔁 Three strikes — steal time!");
        hydrate();
      })
      .on("broadcast", { event: "round_complete" }, ({ payload }: any) => {
        showFlash(payload.outcome === "stolen" ? "🕵️ Stolen!" : "🛡️ Defended!");
        hydrate();
      })
      .on("broadcast", { event: "lost_reveal_answer" }, () => hydrate())
      .on("broadcast", { event: "main_game_ended" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_setup" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_player_started" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_reveal_ready" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_answer_revealed" }, () => hydrate())
      .on("broadcast", { event: "game_started" }, () => hydrate())
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    // Rosters change while mods are still picking teams in the lobby —
    // broadcasts don't cover that stage, so also watch the table directly.
    const rosterChannel = supabase
      .channel(`feud-spectate-roster-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feud_participants", filter: `session_id=eq.${sessionId}` },
        () => hydrate()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(rosterChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hydrate, showFlash]);

  async function handleStopWatching() {
    await invokeFunction("feud-host", { action: "release_spectator", session_id: sessionId });
    navigate("/mod");
  }

  function usernameFor(userId: string | null): string {
    if (!userId || !state) return "";
    const all = [...state.roster_a, ...state.roster_b];
    return all.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
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

  if (!state) return null;
  const { session, round } = state;

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
          <button className="btn btn-ghost btn-sm" onClick={handleStopWatching}>
            Stop watching
          </button>
        </div>

        <TeamScoreboard
          teamAName={session.team_a_name}
          teamBName={session.team_b_name}
          teamAScore={session.team_a_score}
          teamBScore={session.team_b_score}
          highlightTeam={round?.controlling_team ?? null}
        />

        {flash && (
          <div className="card feud-reveal-flash text-center" style={{ marginBottom: "16px", fontWeight: 700, fontSize: "1.1rem" }}>
            {flash}
          </div>
        )}

        {session.status === "lobby" && renderLobby()}
        {(session.status === "live" || session.status === "tiebreaker") && round && renderRound()}
        {session.status === "main_ended" && renderMainEnded()}
        {(session.status === "fastmoney_setup" || session.status === "fastmoney_p1" || session.status === "fastmoney_p2") && renderFastMoney()}
        {session.status === "fastmoney_reveal" && renderFastMoneyReveal()}
        {session.status === "ended" && renderEnded()}
      </div>
    </div>
  );

  function renderLobby() {
    return (
      <div className="card">
        <p className="text-muted text-center">Waiting for the host to start the game…</p>
        <div className="row" style={{ alignItems: "stretch", marginTop: "12px" }}>
          <div className="card card--tight" style={{ flex: 1 }}>
            <h3>{session.team_a_name}</h3>
            {state!.roster_a.length === 0 && <p className="hint">No one yet</p>}
            {state!.roster_a.map((p) => (
              <p key={p.user_id} style={{ margin: "4px 0" }}>
                {p.profiles?.username}
              </p>
            ))}
          </div>
          <div className="card card--tight" style={{ flex: 1 }}>
            <h3>{session.team_b_name}</h3>
            {state!.roster_b.length === 0 && <p className="hint">No one yet</p>}
            {state!.roster_b.map((p) => (
              <p key={p.user_id} style={{ margin: "4px 0" }}>
                {p.profiles?.username}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderRound() {
    if (!round) return null;

    if (round.status === "faceoff") {
      const expectedUser = round.face_off_singleton_user_id ?? round.face_off_buzz_user_id;
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Round {round.round_index + 1} · Face-off</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <p className="text-muted">
            {usernameFor(round.face_off_active_a_user_id)} vs {usernameFor(round.face_off_active_b_user_id)}
          </p>
          {!expectedUser && <p className="hint">Waiting for a buzz…</p>}
          {expectedUser && (
            <>
              {round.face_off_deadline_ms && <Timer deadline={round.face_off_deadline_ms} />}
              <p className="hint">{usernameFor(expectedUser)} is answering…</p>
            </>
          )}
        </div>
      );
    }

    if (round.status === "faceoff_decision") {
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Round {round.round_index + 1}</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <FeudBoard board={round.board} pointsPot={round.points_pot} />
          <p className="hint" style={{ marginTop: "12px" }}>
            Waiting for {usernameFor(round.face_off_decision_user_id)} to choose: play or pass…
          </p>
        </div>
      );
    }

    if (round.status === "board") {
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">
            {round.controlling_team === "A" ? session.team_a_name : session.team_b_name} is playing the board
          </span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <div className="feud-strikes">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`feud-strike ${i < round.strikes ? "feud-strike--hit" : ""}`}>
                {i < round.strikes ? "✕" : ""}
              </div>
            ))}
          </div>
          <FeudBoard board={round.board} pointsPot={round.points_pot} />
          {round.current_turn_deadline_ms && <Timer deadline={round.current_turn_deadline_ms} />}
          <p className="hint">{usernameFor(round.current_turn_user_id)}'s turn…</p>
        </div>
      );
    }

    if (round.status === "steal") {
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Steal! {round.points_pot} pts on the line</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <FeudBoard board={round.board} />
          {round.current_turn_deadline_ms && <Timer deadline={round.current_turn_deadline_ms} />}
          <p className="hint">
            {round.opposing_team === "A" ? session.team_a_name : session.team_b_name} is huddling to try to steal…
          </p>
        </div>
      );
    }

    if (round.status === "lost_reveal") {
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Nobody took control</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <p className="hint">The board's being revealed…</p>
          <FeudBoard board={round.board} />
        </div>
      );
    }

    // complete
    return (
      <div className="card text-center">
        <span className="badge badge-neutral">Round {round.round_index + 1} complete</span>
        <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
        <FeudBoard board={round.board} />
        {round.outcome && (
          <p style={{ fontWeight: 700, marginTop: "12px" }}>
            {round.outcome === "cleared" && `🎉 ${round.awarded_to_team === "A" ? session.team_a_name : session.team_b_name} cleared the board!`}
            {round.outcome === "stolen" && `🕵️ ${round.awarded_to_team === "A" ? session.team_a_name : session.team_b_name} stole it!`}
            {round.outcome === "defended" && `🛡️ ${round.awarded_to_team === "A" ? session.team_a_name : session.team_b_name} held on!`}
            {round.outcome === "lost_no_control" && "No points awarded this round."}
          </p>
        )}
        <p className="hint">Waiting for the host to start the next round…</p>
      </div>
    );
  }

  function renderMainEnded() {
    const { team_a_score, team_b_score, team_a_name, team_b_name } = session;
    const tied = team_a_score === team_b_score;
    return (
      <div className="card text-center">
        <h2>{tied ? "🤝 Main game over — it's a tie!" : "🏁 Main game over!"}</h2>
        <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>
          {team_a_name} {team_a_score} — {team_b_score} {team_b_name}
        </p>
        <p className="text-muted">
          {tied ? "Waiting for the host to start a tiebreaker." : `${team_a_score > team_b_score ? team_a_name : team_b_name} is heading to Fast Money.`}
        </p>
      </div>
    );
  }

  function renderFastMoney() {
    const activeSlot = session.status === "fastmoney_p1" ? 1 : session.status === "fastmoney_p2" ? 2 : null;
    return (
      <div className="card text-center">
        <h2>💰 Fast Money</h2>
        <p className="text-muted">
          {usernameFor(session.fastmoney_player1_id)} (P1) & {usernameFor(session.fastmoney_player2_id)} (P2) —{" "}
          {session.fastmoney_team === "A" ? session.team_a_name : session.team_b_name}
        </p>
        {session.status === "fastmoney_setup" && <p className="hint">Waiting for the host to start Player 1…</p>}
        {activeSlot && (
          <>
            <p className="hint">Player {activeSlot} is answering now — no peeking, everyone waits for the reveal!</p>
            {activeSlot === 1 && session.fastmoney_p1_deadline_ms && <Timer deadline={session.fastmoney_p1_deadline_ms} />}
            {activeSlot === 2 && session.fastmoney_p2_deadline_ms && <Timer deadline={session.fastmoney_p2_deadline_ms} />}
          </>
        )}
      </div>
    );
  }

  function renderFastMoneyReveal() {
    return (
      <div className="card text-center">
        <h2>💰 Fast Money — the reveal!</h2>
        <p className="feud-pot">Running total: {session.fastmoney_total_points} / 200</p>
        <div className="stack" style={{ marginTop: "16px", textAlign: "left" }}>
          {state!.fast_money_revealed.map((r) => (
            <div key={r.question_index} className="card card--tight">
              <strong>{r.prompt}</strong>
              <p style={{ margin: "4px 0" }}>
                Player 1: {r.player1?.answer_text ?? "—"} ({r.player1?.points_awarded ?? 0} pts)
              </p>
              <p style={{ margin: 0 }}>
                Player 2: {r.player2?.answer_text ?? "—"} ({r.player2?.points_awarded ?? 0} pts)
              </p>
            </div>
          ))}
        </div>
        {state!.fast_money_revealed.length === 0 && <p className="hint">Waiting for the host to reveal the first answer…</p>}
      </div>
    );
  }

  function renderEnded() {
    const winner =
      session.team_a_score === session.team_b_score
        ? null
        : session.team_a_score > session.team_b_score
          ? session.team_a_name
          : session.team_b_name;
    return (
      <div className="card text-center">
        <h2>🏁 Game over!</h2>
        {winner ? <p style={{ fontWeight: 700 }}>{winner} won the main game!</p> : <p>It was a tie!</p>}
        {session.fastmoney_total_points > 0 && (
          <p style={{ fontWeight: 700, marginTop: "8px" }}>
            {session.fastmoney_total_points >= 200 ? "🏆 They won the grand prize!" : `Fast Money total: ${session.fastmoney_total_points} — not quite 200.`}
          </p>
        )}
      </div>
    );
  }
}
