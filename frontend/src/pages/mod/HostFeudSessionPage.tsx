import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import TeamScoreboard from "../../components/TeamScoreboard";
import Timer from "../../components/Timer";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { FeudAnswer, FeudFastMoneyQuestion, FeudParticipant, FeudRoundQuestion, FeudSession, Team } from "../../types";

type RoundRow = {
  id: string;
  round_index: number;
  status: string;
  pair_index: number;
  face_off_active_a_user_id: string | null;
  face_off_active_b_user_id: string | null;
  face_off_buzz_user_id: string | null;
  face_off_singleton_user_id: string | null;
  controlling_team: Team | null;
  opposing_team: Team | null;
  current_turn_user_id: string | null;
  strikes: number;
  revealed_indices: number[];
  points_pot: number;
  reveal_count: number;
  outcome: string | null;
  awarded_to_team: Team | null;
};

type RevealedFm = {
  question_index: number;
  prompt: string;
  player1_answer: string | null;
  player1_points: number;
  player2_answer: string | null;
  player2_points: number;
  round_points: number;
};

const STATUS_LABELS: Record<string, string> = {
  lobby: "Not started yet",
  live: "Live",
  main_ended: "Main game over — set up Fast Money below",
  fastmoney_setup: "Fast Money — ready to start",
  fastmoney_p1: "Fast Money — Player 1 answering",
  fastmoney_p2: "Fast Money — Player 2 answering",
  fastmoney_reveal: "Fast Money — revealing answers",
};

export default function HostFeudSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<FeudSession | null>(null);
  const [rosterA, setRosterA] = useState<FeudParticipant[]>([]);
  const [rosterB, setRosterB] = useState<FeudParticipant[]>([]);
  const [round, setRound] = useState<RoundRow | null>(null);
  const [roundQuestion, setRoundQuestion] = useState<FeudRoundQuestion | null>(null);
  const [fmQuestions, setFmQuestions] = useState<FeudFastMoneyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fmTeamChoice, setFmTeamChoice] = useState<Team>("A");
  const [fmPlayer1, setFmPlayer1] = useState("");
  const [fmPlayer2, setFmPlayer2] = useState("");
  const [revealedFm, setRevealedFm] = useState<Record<number, RevealedFm>>({});

  async function loadSession() {
    const { data } = await supabase.from("feud_sessions").select("*").eq("id", sessionId).single();
    setSession(data);
    return data as FeudSession | null;
  }

  async function loadRosters() {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("feud_participants").select("user_id, line_position, profiles(username, avatar_url)").eq("session_id", sessionId).eq("team", "A").order("line_position"),
      supabase.from("feud_participants").select("user_id, line_position, profiles(username, avatar_url)").eq("session_id", sessionId).eq("team", "B").order("line_position"),
    ]);
    setRosterA((a as unknown as FeudParticipant[]) ?? []);
    setRosterB((b as unknown as FeudParticipant[]) ?? []);
  }

  async function loadRound(currentSession: FeudSession | null) {
    if (!currentSession || currentSession.current_round_index < 0) {
      setRound(null);
      setRoundQuestion(null);
      return;
    }
    const { data: roundRow } = await supabase
      .from("feud_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_index", currentSession.current_round_index)
      .maybeSingle();
    setRound(roundRow);

    if (roundRow) {
      const { data: rq } = await supabase
        .from("feud_round_questions")
        .select("*")
        .eq("feud_set_id", currentSession.feud_set_id)
        .eq("order_index", roundRow.round_index)
        .single();
      setRoundQuestion(rq);
    }
  }

  async function loadFmQuestions(currentSession: FeudSession | null) {
    if (!currentSession) return;
    const { data } = await supabase.from("feud_fastmoney_questions").select("*").eq("feud_set_id", currentSession.feud_set_id).order("order_index");
    setFmQuestions(data ?? []);
  }

  async function loadAll() {
    setLoading(true);
    const s = await loadSession();
    await Promise.all([loadRosters(), loadRound(s), loadFmQuestions(s)]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel(`feud-host-watch-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_sessions", filter: `id=eq.${sessionId}` }, async () => {
        const s = await loadSession();
        loadRound(s);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_participants", filter: `session_id=eq.${sessionId}` }, () => loadRosters())
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_rounds", filter: `session_id=eq.${sessionId}` }, async () => {
        const s = session ?? (await loadSession());
        loadRound(s);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function usernameFor(userId: string | null): string {
    if (!userId) return "";
    return [...rosterA, ...rosterB].find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  async function callHost(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const { data, error } = await invokeFunction("feud-host", { action, session_id: sessionId, ...extra });
    setBusy(false);
    if (error) {
      alert(error);
      return null;
    }
    return data;
  }

  async function moveLine(team: Team, userId: string, direction: -1 | 1) {
    const roster = team === "A" ? rosterA : rosterB;
    const ids = roster.map((p) => p.user_id);
    const idx = ids.indexOf(userId);
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    await callHost("set_line_order", { team, ordered_user_ids: ids });
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

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between">
          <h1>🎙️ Hosting Family Feud</h1>
          <span className="badge badge-neutral">Code: {session.join_code}</span>
        </div>

        <TeamScoreboard
          teamAName={session.team_a_name}
          teamBName={session.team_b_name}
          teamAScore={session.team_a_score}
          teamBScore={session.team_b_score}
          highlightTeam={round?.controlling_team ?? null}
        />

        {session.status !== "ended" && (
          <div className="row-between" style={{ margin: "12px 0" }}>
            <span className="hint">{STATUS_LABELS[session.status] ?? session.status}</span>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={handleEndSession}>
              {session.status === "lobby" ? "Cancel session" : "End session"}
            </button>
          </div>
        )}

        {session.status === "lobby" && renderLobby()}
        {session.status === "live" && renderLive()}
        {session.status === "main_ended" && renderMainEnded()}
        {(session.status === "fastmoney_setup" || session.status === "fastmoney_p1" || session.status === "fastmoney_p2") && renderFastMoneyControl()}
        {session.status === "fastmoney_reveal" && renderFastMoneyReveal()}
        {session.status === "ended" && renderEnded()}
      </div>
    </div>
  );

  function renderRoster(team: Team) {
    const roster = team === "A" ? rosterA : rosterB;
    return (
      <div className="card card--tight" style={{ flex: 1 }}>
        <h3>{team === "A" ? session!.team_a_name : session!.team_b_name}</h3>
        <div className="stack" style={{ marginTop: "8px" }}>
          {roster.length === 0 && <p className="hint">No one yet</p>}
          {roster.map((p, i) => (
            <div key={p.user_id} className="row-between" style={{ fontSize: "0.9rem" }}>
              <span>
                {i + 1}. {p.profiles?.username}
              </span>
              <div className="row" style={{ gap: "4px" }}>
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveLine(team, p.user_id, -1)}>
                  ↑
                </button>
                <button className="btn btn-ghost btn-sm" disabled={i === roster.length - 1} onClick={() => moveLine(team, p.user_id, 1)}>
                  ↓
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => callHost("remove_player", { user_id: p.user_id })}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderLobby() {
    return (
      <div className="card">
        <p className="text-muted">
          Players join from the Family Feud lobby and pick a team. Reorder with ↑↓ to set who faces off first.
        </p>
        <div className="row" style={{ alignItems: "stretch", marginTop: "12px" }}>
          {renderRoster("A")}
          {renderRoster("B")}
        </div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: "16px" }}
          disabled={rosterA.length === 0 || rosterB.length === 0 || busy}
          onClick={() => callHost("start_game")}
        >
          ▶ Start game
        </button>
      </div>
    );
  }

  function renderLive() {
    const roundInProgress = round && round.status !== "complete";
    return (
      <div className="card">
        {!roundInProgress && (
          <div className="text-center">
            <button className="btn btn-primary" disabled={busy} onClick={async () => {
              const result = await callHost("start_round");
              if (result?.done) alert(result.message);
            }}>
              ▶ Start round {session!.current_round_index + 2 <= 0 ? 1 : session!.current_round_index + 2}
            </button>
          </div>
        )}

        {round && roundQuestion && (
          <div style={{ marginTop: roundInProgress ? 0 : "20px" }}>
            <p className="hint text-center">Round {round.round_index + 1} · {round.status}</p>
            <h3 className="text-center">{roundQuestion.prompt}</h3>

            {/* Full answer key — host always sees everything */}
            <div className="stack" style={{ margin: "12px 0" }}>
              {(roundQuestion.answers as FeudAnswer[]).map((a, i) => (
                <div
                  key={i}
                  className="row-between card card--tight"
                  style={{
                    opacity: round.revealed_indices.includes(i) ? 1 : 0.55,
                    background: round.revealed_indices.includes(i) ? "var(--color-primary-soft)" : undefined,
                  }}
                >
                  <span>{round.revealed_indices.includes(i) ? "✅" : "⬜"} {a.text}</span>
                  <strong>{a.points}</strong>
                </div>
              ))}
            </div>

            {round.status === "faceoff" && (
              <p className="text-center hint">
                {usernameFor(round.face_off_active_a_user_id)} vs {usernameFor(round.face_off_active_b_user_id)}
                {round.face_off_buzz_user_id && ` — ${usernameFor(round.face_off_singleton_user_id ?? round.face_off_buzz_user_id)} is answering`}
              </p>
            )}

            {round.status === "board" && (
              <div className="feud-strikes">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`feud-strike ${i < round.strikes ? "feud-strike--hit" : ""}`}>
                    {i < round.strikes ? "✕" : ""}
                  </div>
                ))}
              </div>
            )}

            {round.status === "lost_reveal" && (
              <div className="text-center">
                <button className="btn btn-secondary" disabled={busy} onClick={() => callHost("reveal_next_lost_answer")}>
                  Reveal next answer ({round.reveal_count}/{(roundQuestion.answers as FeudAnswer[]).length})
                </button>
              </div>
            )}

            {round.status === "complete" && (
              <p className="text-center" style={{ fontWeight: 700 }}>
                {round.outcome === "cleared" && "🎉 Board cleared!"}
                {round.outcome === "stolen" && "🕵️ Stolen!"}
                {round.outcome === "defended" && "🛡️ Defended!"}
                {round.outcome === "lost_no_control" && "No points awarded."}
              </p>
            )}
          </div>
        )}

        <button className="btn btn-ghost btn-block" style={{ marginTop: "20px" }} disabled={busy} onClick={() => {
          if (confirm("End the main game and move to Fast Money setup?")) callHost("end_main_game");
        }}>
          End main game →
        </button>
      </div>
    );
  }

  function renderMainEnded() {
    // Fast Money is only for the team that actually won the main game — a
    // tie is the one case where the host genuinely has to pick.
    const winningTeam: Team | null =
      session!.team_a_score === session!.team_b_score ? null : session!.team_a_score > session!.team_b_score ? "A" : "B";
    const effectiveTeam: Team = winningTeam ?? fmTeamChoice;
    const roster = effectiveTeam === "A" ? rosterA : rosterB;

    return (
      <div className="card">
        <h3>Pick your Fast Money team</h3>

        {winningTeam ? (
          <p className="text-muted">
            <strong>{effectiveTeam === "A" ? session!.team_a_name : session!.team_b_name}</strong> won the main game (
            {session!.team_a_score}–{session!.team_b_score}) and plays Fast Money.
          </p>
        ) : (
          <>
            <p className="text-muted">
              It's a tie ({session!.team_a_score}–{session!.team_b_score}) — pick which team plays Fast Money.
            </p>
            <div className="row">
              <button className={`btn btn-sm ${fmTeamChoice === "A" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFmTeamChoice("A")}>
                {session!.team_a_name} ({session!.team_a_score})
              </button>
              <button className={`btn btn-sm ${fmTeamChoice === "B" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFmTeamChoice("B")}>
                {session!.team_b_name} ({session!.team_b_score})
              </button>
            </div>
          </>
        )}

        <div className="row" style={{ marginTop: "12px" }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Player 1 (answers first, 20s)</label>
            <select value={fmPlayer1} onChange={(e) => setFmPlayer1(e.target.value)}>
              <option value="">Choose…</option>
              {roster.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.profiles?.username}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Player 2 (sequestered, 25s)</label>
            <select value={fmPlayer2} onChange={(e) => setFmPlayer2(e.target.value)}>
              <option value="">Choose…</option>
              {roster.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.profiles?.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: "12px" }}
          disabled={!fmPlayer1 || !fmPlayer2 || fmPlayer1 === fmPlayer2 || fmQuestions.length < 5 || busy}
          onClick={() => callHost("select_fastmoney_players", { team: effectiveTeam, player1_id: fmPlayer1, player2_id: fmPlayer2 })}
        >
          Set Fast Money players
        </button>
        {fmQuestions.length < 5 && <p className="error-text">This set is missing Fast Money questions — add all 5 in the set editor first.</p>}
      </div>
    );
  }

  function renderFastMoneyControl() {
    return (
      <div className="card text-center">
        <h3>💰 Fast Money</h3>
        <p className="text-muted">
          {usernameFor(session!.fastmoney_player1_id)} (P1) & {usernameFor(session!.fastmoney_player2_id)} (P2) —{" "}
          {session!.fastmoney_team === "A" ? session!.team_a_name : session!.team_b_name}
        </p>

        {session!.status === "fastmoney_setup" && (
          <button className="btn btn-primary" disabled={busy} onClick={() => callHost("start_fastmoney_player", { player_slot: 1 })}>
            ▶ Start Player 1 (20s)
          </button>
        )}
        {session!.status === "fastmoney_p1" && (
          <>
            {(session as any).fastmoney_p1_deadline && <Timer deadline={new Date((session as any).fastmoney_p1_deadline).getTime()} />}
            <button className="btn btn-primary" style={{ marginTop: "12px" }} disabled={busy} onClick={() => callHost("start_fastmoney_player", { player_slot: 2 })}>
              Start Player 2 (25s) →
            </button>
          </>
        )}
        {session!.status === "fastmoney_p2" && (
          <>
            {(session as any).fastmoney_p2_deadline && <Timer deadline={new Date((session as any).fastmoney_p2_deadline).getTime()} />}
            <button className="btn btn-primary" style={{ marginTop: "12px" }} disabled={busy} onClick={() => callHost("end_fastmoney_play")}>
              Move to reveal →
            </button>
          </>
        )}
      </div>
    );
  }

  function renderFastMoneyReveal() {
    const revealedIndices = session!.fastmoney_revealed_indices ?? [];
    return (
      <div className="card">
        <h3 className="text-center">💰 Reveal answers</h3>
        <p className="feud-pot text-center" style={{ display: "block" }}>
          Running total: {session!.fastmoney_total_points} / 200
        </p>
        <div className="stack" style={{ marginTop: "12px" }}>
          {fmQuestions.map((q) => {
            const done = revealedIndices.includes(q.order_index);
            const r = revealedFm[q.order_index];
            return (
              <div key={q.id} className="card card--tight">
                <strong>{q.prompt}</strong>
                {done && r ? (
                  <>
                    <p style={{ margin: "4px 0" }}>P1: {r.player1_answer ?? "—"} ({r.player1_points} pts)</p>
                    <p style={{ margin: 0 }}>P2: {r.player2_answer ?? "—"} ({r.player2_points} pts)</p>
                  </>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "8px" }}
                    disabled={busy || done}
                    onClick={async () => {
                      const data = await callHost("reveal_fastmoney_answer", { question_index: q.order_index });
                      if (data && !data.error) setRevealedFm((prev) => ({ ...prev, [q.order_index]: data }));
                    }}
                  >
                    Reveal
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {revealedIndices.length === 5 && (
          <button className="btn btn-primary btn-block" style={{ marginTop: "16px" }} disabled={busy} onClick={() => callHost("end_session")}>
            🏁 End session
          </button>
        )}
      </div>
    );
  }

  function renderEnded() {
    return (
      <div className="card text-center">
        <h2>Session ended</h2>
        <button className="btn btn-secondary" style={{ marginTop: "12px" }} onClick={() => navigate("/mod/feud-sets")}>
          Back to Feud sets
        </button>
      </div>
    );
  }
}
