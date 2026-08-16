import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import UnoCardView from "../../components/UnoCardView";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { UnoCard, UnoParticipant, UnoSessionEvent, UnoSessionPublic } from "../../types";

type UnoState = {
  session: UnoSessionPublic;
  roster: UnoParticipant[];
  // my_hand/is_playing are always empty/false here — a spectating MOD
  // never has a hand — get-uno-state naturally returns that for anyone
  // not seated, no special-casing needed (unlike Trivia's original
  // spectator bug, this endpoint never writes anything, so there's no
  // side effect to guard against).
};

type Phase = "loading" | "claim_failed" | "ready";

export default function UnoSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [state, setState] = useState<UnoState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3000);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await invokeFunction<UnoState>("get-uno-state", { session_id: sessionId });
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
      const { error } = await invokeFunction("uno-host", { action: "claim_spectator", session_id: sessionId });
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
      .channel(`uno-session-${sessionId}`)
      .on("broadcast", { event: "game_started" }, () => hydrate())
      .on("broadcast", { event: "card_played" }, ({ payload }: { payload: UnoSessionEvent & { type: "card_played" } }) => {
        if (payload.pending_draw_type) showFlash(payload.pending_draw_type === "draw_four" ? "Wild +4!" : "+2!");
        hydrate();
      })
      .on("broadcast", { event: "card_drawn" }, () => hydrate())
      .on("broadcast", { event: "forced_draw" }, () => hydrate())
      .on("broadcast", { event: "turn_passed" }, () => hydrate())
      .on("broadcast", { event: "uno_caught" }, () => {
        showFlash("🚨 Caught without calling UNO!");
        hydrate();
      })
      .on("broadcast", { event: "challenge_resolved" }, ({ payload }: { payload: UnoSessionEvent & { type: "challenge_resolved" } }) => {
        showFlash(payload.success ? "Challenge won! 🎯" : "Challenge failed 😬");
        hydrate();
      })
      .on("broadcast", { event: "game_ended" }, () => hydrate())
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    // Roster changes during the lobby stage aren't covered by broadcasts.
    const rosterChannel = supabase
      .channel(`uno-spectate-roster-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uno_participants", filter: `session_id=eq.${sessionId}` }, () => hydrate())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(rosterChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hydrate, showFlash]);

  async function handleStopWatching() {
    await invokeFunction("uno-host", { action: "release_spectator", session_id: sessionId });
    navigate("/mod");
  }

  function usernameFor(userId: string | null): string {
    if (!userId || !state) return "";
    return state.roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
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
  const { session, roster } = state;

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

        {flash && (
          <div className="card feud-reveal-flash text-center" style={{ marginBottom: "16px", fontWeight: 700, fontSize: "1.1rem" }}>
            {flash}
          </div>
        )}

        {session.status === "lobby" && (
          <div className="card text-center">
            <p className="text-muted">Waiting for the host to start the game…</p>
            <div className="uno-roster">
              {roster.map((p, i) => (
                <div key={p.user_id} className="uno-roster__seat">
                  <span>
                    {i + 1}. {p.profiles?.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {session.status === "live" && (
          <div className="card">
            <div className="row-between">
              <span className={`uno-direction ${session.direction === -1 ? "uno-direction--reversed" : ""}`}>➜</span>
              <span className="badge badge-neutral">{usernameFor(session.current_turn_user_id)}'s turn</span>
              {session.current_color && (
                <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
                  {session.current_color}
                </span>
              )}
            </div>
            <div className="uno-table">
              <div className="uno-draw-pile">
                <UnoCardView card={{ color: "wild", value: "wild" }} faceDown size="lg" />
                <span className="hint">{session.draw_pile_count} left</span>
              </div>
              {session.discard_top && <UnoCardView card={session.discard_top as UnoCard} size="lg" />}
            </div>
            {session.pending_draw_type && (
              <p className="text-center">
                <span className="uno-pending-badge">
                  ⚠️ {session.pending_draw} owed by {usernameFor(session.current_turn_user_id)}
                </span>
              </p>
            )}
            <div className="uno-roster">
              {roster.map((p) => (
                <div
                  key={p.user_id}
                  className={`uno-roster__seat ${p.user_id === session.current_turn_user_id ? "uno-roster__seat--active" : ""} ${p.finished_at ? "uno-roster__seat--finished" : ""}`}
                >
                  <span>{p.profiles?.username}</span>
                  <span className="hint">
                    {p.hand_count} card{p.hand_count === 1 ? "" : "s"}
                    {p.hand_count === 1 && p.has_called_uno && " · UNO!"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2>{session.winner_id ? "🏁 Game over!" : "Game cancelled"}</h2>
            {session.winner_id && <p style={{ fontWeight: 700 }}>{usernameFor(session.winner_id)} won! 🎉</p>}
          </div>
        )}
      </div>
    </div>
  );
}
