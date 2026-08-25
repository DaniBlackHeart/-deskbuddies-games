import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import WheelScoreboard from "../../components/WheelScoreboard";
import WheelTeamScoreboard from "../../components/WheelTeamScoreboard";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { WHEEL_MIN_PLAYERS, WHEEL_MIN_TEAM_SIZE, WHEEL_MIN_TEAMS } from "../../lib/wheelConstants";
import type { WheelParticipant, WheelRoundPublic, WheelSessionPublic, WheelTeam } from "../../types";

const STATUS_LABELS: Record<string, string> = {
  lobby: "Waiting in the lobby",
  live: "Main game",
  tiebreaker: "Do-or-Die tiebreaker",
  bonus_category_choice: "Bonus Round — choosing category",
  bonus_letter_choice: "Bonus Round — choosing letters",
  bonus_solving: "Bonus Round — solving",
  ended: "Ended",
};

export default function HostWheelSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<WheelSessionPublic | null>(null);
  const [roster, setRoster] = useState<WheelParticipant[]>([]);
  const [teams, setTeams] = useState<WheelTeam[]>([]);
  const [round, setRound] = useState<WheelRoundPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isTeamMode = session?.game_mode === "team";

  async function loadSession() {
    const { data } = await supabase.from("wheel_sessions").select("*").eq("id", sessionId).single();
    if (!data) {
      setSession(null);
      return;
    }
    setSession({
      id: data.id,
      status: data.status,
      game_mode: data.game_mode,
      current_round_index: data.current_round_index,
      winner_user_id: data.winner_user_id,
      winner_team_id: data.winner_team_id,
      bonus_category_choices: data.bonus_category_choices,
      bonus_category_id: data.bonus_category_id,
      bonus_category_name: data.bonus_category_name,
      bonus_given_letters: data.bonus_given_letters,
      bonus_chosen_consonants: data.bonus_chosen_consonants,
      bonus_chosen_vowel: data.bonus_chosen_vowel,
      bonus_deadline_ms: data.bonus_deadline ? new Date(data.bonus_deadline).getTime() : null,
      bonus_won: data.bonus_won,
      bonus_points_awarded: data.bonus_points_awarded,
      bonus_solved_phrase: data.bonus_solved_phrase,
      bonus_masked_phrase: null,
      state_version: data.state_version,
    });

    if (data.status === "live" || data.status === "tiebreaker") {
      const { data: roundRow } = await supabase
        .from("wheel_rounds")
        .select("*")
        .eq("session_id", sessionId)
        .eq("round_index", data.current_round_index)
        .maybeSingle();
      setRound(
        roundRow
          ? {
              id: roundRow.id,
              round_index: roundRow.round_index,
              is_tiebreaker: roundRow.is_tiebreaker,
              category_name: roundRow.category_name,
              phrase_length: roundRow.phrase_length,
              status: roundRow.status,
              solved_by_user_id: roundRow.solved_by_user_id,
              guessed_letters: roundRow.guessed_letters,
              locked_out_user_ids: roundRow.locked_out_user_ids,
              locked_out_team_ids: roundRow.locked_out_team_ids,
              active_user_id: roundRow.active_user_id,
              active_team_id: roundRow.active_team_id,
              turn_phase: roundRow.turn_phase,
              turn_deadline_ms: roundRow.turn_deadline ? new Date(roundRow.turn_deadline).getTime() : null,
              pending_wedge: roundRow.pending_wedge,
              free_play_active: roundRow.free_play_active,
              round_scores: roundRow.round_scores,
              masked_phrase: "", // host doesn't need the letters spelled out — just progress/status
              eligible_user_ids: [],
              eligible_team_ids: [],
            }
          : null
      );
    } else {
      setRound(null);
    }
  }

  async function loadRoster() {
    const { data } = await supabase
      .from("wheel_participants")
      .select("user_id, seat_order, total_points, team_id, line_position, profiles(username, avatar_url)")
      .eq("session_id", sessionId)
      .order("seat_order");
    setRoster((data as unknown as WheelParticipant[]) ?? []);
  }

  async function loadTeams() {
    const [{ data: teamRows }, { data: participantRows }] = await Promise.all([
      supabase.from("wheel_teams").select("*").eq("session_id", sessionId).order("seat_order"),
      supabase.from("wheel_participants").select("user_id, team_id, line_position, profiles(username, avatar_url)").eq("session_id", sessionId),
    ]);
    const built: WheelTeam[] = (teamRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      seat_order: t.seat_order,
      current_rep_index: t.current_rep_index,
      total_points: t.total_points,
      members: (participantRows ?? [])
        .filter((p: any) => p.team_id === t.id)
        .sort((a: any, b: any) => (a.line_position ?? 0) - (b.line_position ?? 0))
        .map((p: any) => ({ user_id: p.user_id, line_position: p.line_position ?? 0, profiles: p.profiles })),
    }));
    setTeams(built);
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadSession(), loadRoster(), loadTeams()]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel(`wheel-host-watch-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_sessions", filter: `id=eq.${sessionId}` }, loadSession)
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_participants", filter: `session_id=eq.${sessionId}` }, () => {
        loadRoster();
        loadTeams();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_teams", filter: `session_id=eq.${sessionId}` }, loadTeams)
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_rounds", filter: `session_id=eq.${sessionId}` }, loadSession)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function usernameFor(userId: string | null | undefined): string {
    if (!userId) return "";
    return roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  function teamNameFor(teamId: string | null | undefined): string {
    if (!teamId) return "";
    return teams.find((t) => t.id === teamId)?.name ?? "A team";
  }

  async function callHost(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const { data, error } = await invokeFunction("wheel-host", { action, session_id: sessionId, ...extra });
    setBusy(false);
    if (error) {
      alert(error);
      return null;
    }
    return data;
  }

  async function handleEndSession() {
    const message = session?.status === "lobby" ? "Cancel this game before it starts?" : "End the game for everyone?";
    if (!confirm(message)) return;
    await callHost("end_session");
    loadSession();
  }

  function advanceButtonLabel(): string {
    if (!session) return "Continue →";
    if (session.status === "tiebreaker") return "Continue →";
    if (session.current_round_index < 4) return `Start Round ${session.current_round_index + 2} →`;
    return "Continue to results →";
  }

  const shortTeams = teams.filter((t) => t.members.length < WHEEL_MIN_TEAM_SIZE);
  const canStartTeamGame = teams.length >= WHEEL_MIN_TEAMS && shortTeams.length === 0;

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
          <h1>🎡 Hosting Wheel of Fortune {isTeamMode && <span className="badge badge-neutral">Team mode</span>}</h1>
          {session.status !== "ended" && (
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={handleEndSession}>
              {session.status === "lobby" ? "Cancel game" : "End game"}
            </button>
          )}
        </div>

        {session.status !== "ended" && <p className="hint">{STATUS_LABELS[session.status] ?? session.status}</p>}

        {session.status === "lobby" && !isTeamMode && (
          <div className="card">
            <p className="text-muted">
              Players join from the Wheel of Fortune lobby. Need {WHEEL_MIN_PLAYERS}-10 to start.
            </p>
            <div className="stack" style={{ marginTop: "12px" }}>
              {roster.length === 0 && <p className="hint">No one yet</p>}
              {roster.map((p, i) => (
                <div key={p.user_id} className="row-between">
                  <span>
                    {i + 1}. {p.profiles?.username}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => callHost("remove_player", { user_id: p.user_id })}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: "16px" }}
              disabled={roster.length < WHEEL_MIN_PLAYERS || busy}
              onClick={() => callHost("start_game")}
            >
              ▶ Start game
            </button>
            {roster.length > 0 && roster.length < WHEEL_MIN_PLAYERS && <p className="hint">Need at least {WHEEL_MIN_PLAYERS} players.</p>}
          </div>
        )}

        {session.status === "lobby" && isTeamMode && (
          <div className="card">
            <p className="text-muted">
              Members create or join teams from the Wheel of Fortune lobby. Need {WHEEL_MIN_TEAMS}+ teams, each with{" "}
              {WHEEL_MIN_TEAM_SIZE}+ members, to start.
            </p>
            <div className="stack" style={{ marginTop: "12px" }}>
              {teams.length === 0 && <p className="hint">No teams yet</p>}
              {teams.map((t) => (
                <div key={t.id} className="card card--tight">
                  <div className="row-between">
                    <strong>{t.name}</strong>
                    <span className={`badge ${t.members.length < WHEEL_MIN_TEAM_SIZE ? "badge-live" : "badge-neutral"}`}>{t.members.length} member{t.members.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="stack" style={{ marginTop: "6px" }}>
                    {t.members.map((m) => (
                      <div key={m.user_id} className="row-between">
                        <span className="hint" style={{ margin: 0 }}>{m.profiles?.username}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => callHost("remove_player", { user_id: m.user_id })}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: "16px" }} disabled={!canStartTeamGame || busy} onClick={() => callHost("start_game")}>
              ▶ Start game
            </button>
            {teams.length > 0 && teams.length < WHEEL_MIN_TEAMS && <p className="hint">Need at least {WHEEL_MIN_TEAMS} teams.</p>}
            {shortTeams.length > 0 && <p className="hint">These teams need {WHEEL_MIN_TEAM_SIZE}+ members: {shortTeams.map((t) => t.name).join(", ")}</p>}
          </div>
        )}

        {(session.status === "live" || session.status === "tiebreaker") && (
          <div className="card">
            <p className="text-center" style={{ fontWeight: 700 }}>
              {round?.is_tiebreaker ? "Do-or-Die Tiebreaker" : `Round ${(round?.round_index ?? 0) + 1} of 5`}
              {round?.category_name ? ` — ${round.category_name}` : ""}
            </p>
            {round?.status === "active" ? (
              <p className="text-center text-muted" style={{ margin: 0 }}>
                {round.turn_phase === "buzz_open"
                  ? "Buzzer's open — waiting for a player…"
                  : isTeamMode
                    ? `${teamNameFor(round.active_team_id)} (${usernameFor(round.active_user_id)}) is taking their turn…`
                    : `${usernameFor(round.active_user_id)} is taking their turn…`}
              </p>
            ) : (
              <p className="text-center text-muted" style={{ margin: 0 }}>Round finished — ready to continue.</p>
            )}
            <p className="hint text-center" style={{ marginTop: "12px", marginBottom: 0 }}>
              Players run the game themselves from their own screens.
            </p>
            <div className="row" style={{ justifyContent: "center", marginTop: "12px" }}>
              {round?.status === "active" && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => callHost("force_end_round")}>
                  Force-reveal this round
                </button>
              )}
              {round && round.status !== "active" && (
                <button className="btn btn-primary" disabled={busy} onClick={() => callHost("advance_round")}>
                  {advanceButtonLabel()}
                </button>
              )}
            </div>
          </div>
        )}

        {(session.status === "bonus_category_choice" || session.status === "bonus_letter_choice" || session.status === "bonus_solving") && (
          <div className="card text-center">
            <p style={{ margin: 0 }}>
              🎁 {isTeamMode ? `${teamNameFor(session.winner_team_id)} (${usernameFor(session.winner_user_id)})` : usernameFor(session.winner_user_id)} is playing the Bonus Round —{" "}
              {STATUS_LABELS[session.status]}
            </p>
          </div>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2>
              {isTeamMode
                ? session.winner_team_id
                  ? `🎉 ${teamNameFor(session.winner_team_id)} won!`
                  : "Game cancelled"
                : session.winner_user_id
                  ? `🎉 ${usernameFor(session.winner_user_id)} won!`
                  : "Game cancelled"}
            </h2>
            {session.bonus_won !== null && (
              <p style={{ fontWeight: 700 }}>
                {session.bonus_won ? `Solved the Bonus Round for ${session.bonus_points_awarded} points!` : "Didn't solve the Bonus Round."}
              </p>
            )}
            <button className="btn btn-secondary" style={{ marginTop: "12px" }} onClick={() => navigate("/mod")}>
              Back to dashboard
            </button>
          </div>
        )}

        {session.status !== "lobby" && (
          <div style={{ marginTop: "16px" }}>
            {isTeamMode ? (
              <WheelTeamScoreboard teams={teams} roundScores={round?.round_scores} activeTeamId={round?.active_team_id} lockedOutTeamIds={round?.locked_out_team_ids} />
            ) : (
              roster.length > 0 && (
                <WheelScoreboard roster={roster} roundScores={round?.round_scores} activeUserId={round?.active_user_id} lockedOutUserIds={round?.locked_out_user_ids} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
