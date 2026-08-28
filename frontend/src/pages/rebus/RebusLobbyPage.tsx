import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { lobbyMusic, sounds } from "../../lib/sounds";
import type { RebusGameMode, RebusParticipant, RebusSessionStatus, RebusTeam } from "../../types";

type OpenSession = { id: string; status: RebusSessionStatus; game_mode: RebusGameMode };

export default function RebusLobbyPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [session, setSession] = useState<OpenSession | null | undefined>(undefined);
  const [justEnded, setJustEnded] = useState(false);
  const [teams, setTeams] = useState<RebusTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const sessionRef = useRef<OpenSession | null | undefined>(session);
  sessionRef.current = session;

  async function loadOpenSession() {
    const { data } = await supabase
      .from("rebus_sessions")
      .select("id, status, game_mode")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const found = (data as unknown as OpenSession) ?? null;
    if (found) setJustEnded(false);
    setSession(found);
  }

  async function loadTeams(sessionId: string) {
    const [{ data: teamRows }, { data: participantRows }] = await Promise.all([
      supabase.from("rebus_teams").select("*").eq("session_id", sessionId).order("created_at"),
      supabase.from("rebus_participants").select("user_id, team_id, profiles(username, avatar_url)").eq("session_id", sessionId),
    ]);
    const built: RebusTeam[] = (teamRows ?? []).map((t) => ({
      id: t.id,
      session_id: t.session_id,
      name: t.name,
      created_at: t.created_at,
      members: ((participantRows ?? []) as unknown as RebusParticipant[]).filter((p) => p.team_id === t.id),
    }));
    setTeams(built);
  }

  useEffect(() => {
    loadOpenSession();
    const channel = supabase
      .channel("rebus-sessions-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_sessions" }, (payload) => {
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
    if (session.game_mode === "team") loadTeams(session.id);
    if (session.status !== "lobby") {
      sounds.sessionStart();
      navigate(`/rebus/play/${session.id}`);
      return;
    }
    if (session.game_mode !== "team") return;
    const channel = supabase
      .channel(`rebus-lobby-watch-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_participants", filter: `session_id=eq.${session.id}` }, () => loadTeams(session.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "rebus_teams", filter: `session_id=eq.${session.id}` }, () => loadTeams(session.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (session && session.status === "lobby") {
      lobbyMusic.start();
    } else {
      lobbyMusic.stop();
    }
    return () => lobbyMusic.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  // Same defensive-refetch reasoning as WheelLobbyPage's callPlay — don't
  // rely on the postgres_changes round trip to update the acting client's
  // own screen after their own create_team/join_team/leave_team call.
  async function callPlay(action: string, extra: Record<string, unknown> = {}) {
    if (!session) return null;
    setBusy(true);
    setError(null);
    const { data, error } = await invokeFunction("rebus-play", { action, session_id: session.id, ...extra });
    if (error) {
      setBusy(false);
      setError(error);
      return null;
    }
    await loadTeams(session.id);
    setBusy(false);
    return data;
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    const data = await callPlay("create_team", { name: newTeamName.trim() });
    if (data) setNewTeamName("");
  }

  async function handleJoinTeam(teamId: string) {
    await callPlay("join_team", { team_id: teamId });
  }

  async function handleLeaveTeam() {
    await callPlay("leave_team");
  }

  const myTeam = teams.find((t) => t.members?.some((m) => m.user_id === profile?.id));
  const isTeamMode = session?.game_mode === "team";

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="card text-center">
          <div style={{ fontSize: "2.5rem" }}>🔤</div>
          <h1>Type What You See</h1>

          {session === undefined && <p className="text-muted">Checking for a live game…</p>}

          {session === null && (
            <>
              <p className="text-muted">
                {justEnded
                  ? "This game was cancelled by the mod."
                  : "No game happening right now. Keep an eye on Discord for the next announcement!"}
              </p>
              <button className="btn btn-secondary" onClick={() => navigate("/")}>
                Back to games
              </button>
            </>
          )}

          {session && !isTeamMode && (
            <>
              <p className="text-muted">A session is about to start!</p>
              <button className="btn btn-primary btn-block" onClick={() => navigate(`/rebus/play/${session.id}`)}>
                Join Type What You See
              </button>
            </>
          )}

          {session && isTeamMode && (
            <>
              <p className="text-muted" style={{ marginBottom: "16px" }}>
                Pick a team, or start a new one.
              </p>

              {myTeam ? (
                <div className="rebus-team-card rebus-team-card--mine" style={{ marginBottom: "16px", textAlign: "left" }}>
                  <p style={{ fontWeight: 800, margin: 0 }}>You're on {myTeam.name}</p>
                  <div className="rebus-team-card__members">
                    {(myTeam.members ?? []).map((m) => (
                      <span key={m.user_id}>
                        {m.profiles?.username} {m.user_id === profile?.id && "(you)"}
                      </span>
                    ))}
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={handleLeaveTeam}>
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
                    <button className="btn btn-primary btn-sm" disabled={busy || !newTeamName.trim()} onClick={handleCreateTeam}>
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
                  return (
                    <div key={t.id} className={`rebus-team-card ${isMine ? "rebus-team-card--mine" : ""}`}>
                      <div className="row-between">
                        <strong>{t.name}</strong>
                        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                          {(t.members ?? []).length} member{(t.members ?? []).length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="rebus-team-card__members">
                        {(t.members ?? []).map((m) => (
                          <span key={m.user_id} className="hint" style={{ margin: 0 }}>
                            {m.profiles?.username}
                          </span>
                        ))}
                      </div>
                      {!isMine && (
                        <button className="btn btn-secondary btn-sm btn-block" disabled={busy} onClick={() => handleJoinTeam(t.id)}>
                          Join {t.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {myTeam && <p className="hint" style={{ marginTop: "16px" }}>Waiting for the host to start the game…</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
