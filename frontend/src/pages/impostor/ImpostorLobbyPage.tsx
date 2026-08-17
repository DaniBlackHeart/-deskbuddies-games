import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { lobbyMusic, sounds } from "../../lib/sounds";
import type { ImpostorParticipant, ImpostorSessionStatus } from "../../types";

type OpenSession = { id: string; status: ImpostorSessionStatus; category_name: string };

export default function ImpostorLobbyPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [session, setSession] = useState<OpenSession | null | undefined>(undefined);
  const [justEnded, setJustEnded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roster, setRoster] = useState<ImpostorParticipant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<OpenSession | null | undefined>(session);
  sessionRef.current = session;

  async function loadOpenSession() {
    const { data } = await supabase
      .from("impostor_sessions")
      .select("id, status, category_name")
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
      .from("impostor_participants")
      .select("user_id, seat_order, profiles(username, avatar_url)")
      .eq("session_id", sessionId)
      .order("seat_order");
    setRoster((data as unknown as ImpostorParticipant[]) ?? []);
  }

  useEffect(() => {
    loadOpenSession();
    const channel = supabase
      .channel("impostor-sessions-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "impostor_sessions" }, (payload) => {
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
    if (session.status !== "lobby") {
      sounds.sessionStart();
      navigate(`/impostor/play/${session.id}`);
      return;
    }
    const channel = supabase
      .channel(`impostor-lobby-watch-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "impostor_participants", filter: `session_id=eq.${session.id}` }, () => loadRoster(session.id))
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

  async function handleJoin() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const { error } = await invokeFunction("impostor-play", { action: "join_game", session_id: session.id });
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="card text-center">
          <div style={{ fontSize: "2.5rem" }}>🕵️</div>
          <h1>Impostor WHO?</h1>

          {session === undefined && <p className="text-muted">Checking for a live game…</p>}

          {session === null && (
            <>
              <p className="text-muted">
                {justEnded
                  ? "This game was cancelled by the mod."
                  : "No Impostor WHO? game happening right now. Keep an eye on Discord for the next announcement!"}
              </p>
              <button className="btn btn-secondary" onClick={() => navigate("/")}>
                Back to games
              </button>
            </>
          )}

          {session && !joined && (
            <>
              <p className="text-muted">
                A game is about to start (category: <strong>{session.category_name}</strong>) — join before the host deals cards.
              </p>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={handleJoin}>
                Join game
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}

          {session && joined && (
            <>
              <div className="impostor-card impostor-card--back" style={{ maxWidth: "200px", minHeight: "120px", margin: "16px auto", cursor: "default" }}>
                <span className="impostor-card__back-icon">🂠</span>
              </div>
              <p className="text-muted">
                You're in! {roster.length} player{roster.length === 1 ? "" : "s"} seated. Category: <strong>{session.category_name}</strong>
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
              <p className="hint">Waiting for the host to start the game… (3+ players)</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
