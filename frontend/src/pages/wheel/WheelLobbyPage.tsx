import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { lobbyMusic, sounds } from "../../lib/sounds";
import { WHEEL_MAX_PLAYERS, WHEEL_MAX_TEAM_SIZE, WHEEL_MAX_TEAMS, WHEEL_MIN_PLAYERS, WHEEL_MIN_TEAM_SIZE, WHEEL_MIN_TEAMS } from "../../lib/wheelConstants";
import type { WheelGameMode, WheelParticipant, WheelSessionStatus, WheelTeam } from "../../types";

type OpenSession = { id: string; status: WheelSessionStatus; game_mode: WheelGameMode };

export default function WheelLobbyPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [session, setSession] = useState<OpenSession | null | undefined>(undefined);
  const [justEnded, setJustEnded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roster, setRoster] = useState<WheelParticipant[]>([]);
  const [teams, setTeams] = useState<WheelTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const sessionRef = useRef<OpenSession | null | undefined>(session);
  sessionRef.current = session;

  async function loadOpenSession() {
    const { data } = await supabase
      .from("wheel_sessions")
      .select("id, status, game_mode")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const found = (data as OpenSession) ?? null;
    if (found) setJustEnded(false);
    setSession(found);
  }

  async function loadRoster(sessionId: string) {
    const { data } = await supabase
      .from("wheel_participants")
      .select("user_id, seat_order, total_points, team_id, line_position, profiles(username, avatar_url)")
      .eq("session_id", sessionId)
      .order("seat_order");
    setRoster((data as unknown as WheelParticipant[]) ?? []);
  }

  async function loadTeams(sessionId: string) {
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

  useEffect(() => {
    loadOpenSession();
    const channel = supabase
      .channel("wheel-sessions-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_sessions" }, (payload) => {
        const row = (payload.new ?? payload.old) as { id?: string; status?: string } | null;
        const current = sessionRef.current;
        if (current && row?.id === current.id && row?.status === "ended") {
          sounds.sessionEndedByMod();
          setSession(null);
          setJustEnded(true);
          return;
        }
        loadOpenSession();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    loadRoster(session.id);
    if (session.game_mode === "team") loadTeams(session.id);
    if (session.status !== "lobby") {
      sounds.sessionStart();
      navigate(`/wheel/play/${session.id}`);
      return;
    }
    const channel = supabase
      .channel(`wheel-lobby-watch-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_participants", filter: `session_id=eq.${session.id}` }, () => {
        loadRoster(session.id);
        if (session.game_mode === "team") loadTeams(session.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wheel_teams", filter: `session_id=eq.${session.id}` }, () => loadTeams(session.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  useEffect(() => {
    setJoined(false);
  }, [session?.id]);

  const alreadyIn = roster.some((p) => p.user_id === profile?.id);
  useEffect(() => {
    if (alreadyIn) setJoined(true);
  }, [alreadyIn]);

  useEffect(() => {
    if (session && session.status === "lobby" && joined) {
      lobbyMusic.start();
    } else {
      lobbyMusic.stop();
    }
    return () => lobbyMusic.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, joined]);

  // Wraps every wheel-play lobby action so the ACTING client's own screen
  // updates immediately from a direct refetch, rather than waiting on the
  // postgres_changes broadcast to round-trip back to itself. That
  // broadcast still runs (it's what updates everyone ELSE watching the
  // lobby), but the person who just took the action shouldn't have to
  // depend on realtime delivery timing just to see their own change —
  // that dependency is what made "join"/"create team" look stuck until a
  // manual reload forced a fresh query.
  async function callPlay(action: string, extra: Record<string, unknown> = {}) {
    if (!session) return null;
    setBusy(true);
    setError(null);
    const { data, error } = await invokeFunction("wheel-play", { action, session_id: session.id, ...extra });
    if (error) {
      setBusy(false);
      setError(error);
      return null;
    }
    await Promise.all([loadRoster(session.id), session.game_mode === "team" ? loadTeams(session.id) : Promise.resolve()]);
    setBusy(false);
    return data;
  }

  async function handleJoin() {
    await callPlay("join_game");
  }

  async function handleLeave() {
    await callPlay("leave_lobby");
    setJoined(false);
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    const data = await callPlay("create_team", { name: newTeamName.trim() });
    if (data) setNewTeamName("");
  }

  async function handleJoinTeam(teamId: string) {
    await callPlay("join_team", { team_id: teamId });
  }

  const myTeam = teams.find((t) => t.members.some((m) => m.user_id === profile?.id));
  const isTeamMode = session?.game_mode === "team";

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="card text-center">
          <div style={{ fontSize: "2.5rem" }}>🎡</div>
          <h1>Wheel of Fortune</h1>

          {session === undefined && <p className="text-muted">Checking for a live game…</p>}

          {session === null && (
            <>
              <p className="text-muted">
                {justEnded
                  ? "This game was cancelled by the mod."
                  : "No Wheel of Fortune game happening right now. Keep an eye on Discord for the next announcement!"}
              </p>
              <button className="btn btn-secondary" onClick={() => navigate("/")}>
                Back to games
              </button>
            </>
          )}

          {/* ---------------- Solo mode (unchanged) ---------------- */}
          {session && !isTeamMode && !joined && (
            <>
              <p className="text-muted">
                A game is about to start — join before the host spins things up. ({WHEEL_MIN_PLAYERS}-{WHEEL_MAX_PLAYERS} players)
              </p>
              <button className="btn btn-primary btn-block" disabled={busy || roster.length >= WHEEL_MAX_PLAYERS} onClick={handleJoin}>
                {roster.length >= WHEEL_MAX_PLAYERS ? "Game is full" : "Join game"}
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}

          {session && !isTeamMode && joined && (
            <>
              <p className="text-muted">
                You're in! {roster.length}/{WHEEL_MAX_PLAYERS} players joined.
              </p>
              <div className="uno-roster">
                {roster.map((p, i) => (
                  <div key={p.user_id} className="uno-roster__seat">
                    {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} alt="" width={28} height={28} style={{ borderRadius: "50%" }} />}
                    <span>
                      {i + 1}. {p.profiles?.username}
                    </span>
                  </div>
                ))}
              </div>
              <p className="hint">Waiting for the host to start the game… ({WHEEL_MIN_PLAYERS}+ players)</p>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={handleLeave}>
                Leave lobby
              </button>
            </>
          )}

          {/* ---------------- Team mode ---------------- */}
          {session && isTeamMode && (
            <>
              <p className="text-muted" style={{ marginBottom: "16px" }}>
                Pick a team, or start a new one. ({WHEEL_MIN_TEAMS}-{WHEEL_MAX_TEAMS} teams, {WHEEL_MIN_TEAM_SIZE}-{WHEEL_MAX_TEAM_SIZE} members each)
              </p>

              {myTeam ? (
                <div className="wheel-team-card wheel-team-card--mine" style={{ marginBottom: "16px", textAlign: "left" }}>
                  <p style={{ fontWeight: 800, margin: 0 }}>You're on {myTeam.name}</p>
                  <div className="wheel-team-card__members">
                    {myTeam.members.map((m, i) => (
                      <span key={m.user_id}>
                        {i + 1}. {m.profiles?.username} {m.user_id === profile?.id && "(you)"}
                      </span>
                    ))}
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={handleLeave}>
                    Leave team
                  </button>
                </div>
              ) : (
                <div className="card card--tight" style={{ marginBottom: "16px", textAlign: "left" }}>
                  <p className="hint" style={{ marginTop: 0 }}>Start a new team:</p>
                  <div className="row">
                    <input
                      type="text"
                      placeholder="Team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary btn-sm" disabled={busy || !newTeamName.trim() || teams.length >= WHEEL_MAX_TEAMS} onClick={handleCreateTeam}>
                      Create
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="error-text">{error}</p>}

              <div className="stack" style={{ textAlign: "left" }}>
                {teams.length === 0 && <p className="hint text-center">No teams yet — be the first to create one!</p>}
                {teams.map((t) => {
                  const isMine = t.id === myTeam?.id;
                  const isFull = t.members.length >= WHEEL_MAX_TEAM_SIZE;
                  return (
                    <div key={t.id} className={`wheel-team-card ${isMine ? "wheel-team-card--mine" : ""}`}>
                      <div className="row-between">
                        <strong>{t.name}</strong>
                        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                          {t.members.length}/{WHEEL_MAX_TEAM_SIZE}
                        </span>
                      </div>
                      <div className="wheel-team-card__members">
                        {t.members.map((m) => (
                          <span key={m.user_id} className="hint" style={{ margin: 0 }}>
                            {m.profiles?.username}
                          </span>
                        ))}
                      </div>
                      {!myTeam && !isFull && (
                        <button className="btn btn-secondary btn-sm btn-block" disabled={busy} onClick={() => handleJoinTeam(t.id)}>
                          Join {t.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {myTeam && (
                <p className="hint" style={{ marginTop: "16px" }}>
                  Waiting for the host to start the game… ({WHEEL_MIN_TEAMS}+ teams, every team needs {WHEEL_MIN_TEAM_SIZE}+ members)
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
