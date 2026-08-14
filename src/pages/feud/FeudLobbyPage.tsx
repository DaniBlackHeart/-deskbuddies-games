import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { lobbyMusic, sounds } from "../../lib/sounds";
import type { FeudParticipant, FeudSession, Team } from "../../types";

type OpenSession = Pick<FeudSession, "id" | "status" | "team_a_name" | "team_b_name" | "feud_set_id"> & {
  feud_sets: { name: string } | null;
};

export default function FeudLobbyPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [session, setSession] = useState<OpenSession | null | undefined>(undefined);
  const [rosterA, setRosterA] = useState<FeudParticipant[]>([]);
  const [rosterB, setRosterB] = useState<FeudParticipant[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadOpenSession() {
    const { data } = await supabase
      .from("feud_sessions")
      .select("id, status, team_a_name, team_b_name, feud_set_id, feud_sets(name)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession((data as unknown as OpenSession) ?? null);
  }

  async function loadRosters(sessionId: string) {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("feud_participants").select("user_id, line_position, profiles(username, avatar_url)").eq("session_id", sessionId).eq("team", "A").order("line_position"),
      supabase.from("feud_participants").select("user_id, line_position, profiles(username, avatar_url)").eq("session_id", sessionId).eq("team", "B").order("line_position"),
    ]);
    setRosterA((a as unknown as FeudParticipant[]) ?? []);
    setRosterB((b as unknown as FeudParticipant[]) ?? []);
  }

  useEffect(() => {
    loadOpenSession();
    const channel = supabase
      .channel("feud-sessions-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_sessions" }, () => loadOpenSession())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    loadRosters(session.id);
    if (session.status !== "lobby") {
      sounds.sessionStart();
      navigate(`/feud/play/${session.id}`);
      return;
    }
    const channel = supabase
      .channel(`feud-lobby-watch-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_participants", filter: `session_id=eq.${session.id}` }, () => loadRosters(session.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  // Lobby BGM — plays only while a session exists and is genuinely still in
  // "lobby" (team-pick) status; stops the moment the host starts the game.
  useEffect(() => {
    if (session && session.status === "lobby") {
      lobbyMusic.start();
    } else {
      lobbyMusic.stop();
    }
    return () => lobbyMusic.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  const myTeam: Team | null =
    rosterA.some((p) => p.user_id === profile?.id) ? "A" : rosterB.some((p) => p.user_id === profile?.id) ? "B" : null;

  async function handleJoinTeam(team: Team) {
    if (!session) return;
    setBusy(true);
    const { error } = await invokeFunction("feud-play", { action: "join_team", session_id: session.id, team });
    setBusy(false);
    if (error) {
      alert(error);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="card text-center">
          <div style={{ fontSize: "2.5rem" }}>🎙️</div>
          <h1>Family Feud</h1>

          {session === undefined && <p className="text-muted">Checking for a live game…</p>}

          {session === null && (
            <>
              <p className="text-muted">
                No Family Feud game happening right now. Keep an eye on Discord for the next announcement!
              </p>
              <button className="btn btn-secondary" onClick={() => navigate("/")}>
                Back to games
              </button>
            </>
          )}

          {session && (
            <>
              <p className="text-muted">
                Lobby is open for <strong>{session.feud_sets?.name}</strong> — pick a team below.
              </p>

              <div className="row" style={{ alignItems: "stretch", marginTop: "16px" }}>
                <div className="card card--tight" style={{ flex: 1 }}>
                  <h3>{session.team_a_name}</h3>
                  <div className="stack" style={{ marginTop: "8px" }}>
                    {rosterA.length === 0 && <p className="hint">No one yet</p>}
                    {rosterA.map((p) => (
                      <div key={p.user_id} className="row" style={{ gap: "6px" }}>
                        {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} alt="" width={20} height={20} style={{ borderRadius: "50%" }} />}
                        <span style={{ fontSize: "0.9rem" }}>{p.profiles?.username}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-sm btn-block"
                    style={{ marginTop: "12px" }}
                    onClick={() => handleJoinTeam("A")}
                    disabled={busy || myTeam === "A"}
                  >
                    {myTeam === "A" ? "✓ You're in" : "Join this team"}
                  </button>
                </div>

                <div className="card card--tight" style={{ flex: 1 }}>
                  <h3>{session.team_b_name}</h3>
                  <div className="stack" style={{ marginTop: "8px" }}>
                    {rosterB.length === 0 && <p className="hint">No one yet</p>}
                    {rosterB.map((p) => (
                      <div key={p.user_id} className="row" style={{ gap: "6px" }}>
                        {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} alt="" width={20} height={20} style={{ borderRadius: "50%" }} />}
                        <span style={{ fontSize: "0.9rem" }}>{p.profiles?.username}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-sm btn-block"
                    style={{ marginTop: "12px" }}
                    onClick={() => handleJoinTeam("B")}
                    disabled={busy || myTeam === "B"}
                  >
                    {myTeam === "B" ? "✓ You're in" : "Join this team"}
                  </button>
                </div>
              </div>

              <p className="hint" style={{ marginTop: "16px" }}>
                Waiting for the host to start the game…
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
