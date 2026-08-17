import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import ImpostorClueBoard from "../../components/ImpostorClueBoard";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { ImpostorClue, ImpostorParticipant, ImpostorSessionEvent, ImpostorSessionPublic } from "../../types";

type ImpostorState = {
  session: ImpostorSessionPublic;
  roster: ImpostorParticipant[];
  clues: ImpostorClue[];
  // my_card/has_voted are always null/false here — a spectating MOD never
  // has a card or a vote, and get-impostor-state naturally returns that
  // for anyone not seated, same as get-uno-state's my_hand for spectators.
};

type Phase = "loading" | "claim_failed" | "ready";

export default function ImpostorSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [state, setState] = useState<ImpostorState | null>(null);
  const [votedCount, setVotedCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3500);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await invokeFunction<ImpostorState>("get-impostor-state", { session_id: sessionId });
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
      const { error } = await invokeFunction("impostor-host", { action: "claim_spectator", session_id: sessionId });
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
      .channel(`impostor-session-${sessionId}`)
      .on("broadcast", { event: "game_started" }, () => hydrate())
      .on("broadcast", { event: "clue_submitted" }, () => hydrate())
      .on("broadcast", { event: "voting_started" }, ({ payload }: { payload: ImpostorSessionEvent & { type: "voting_started" } }) => {
        setVotedCount(0);
        showFlash(`Vote ${payload.vote_round} — cast your suspicion!`);
        hydrate();
      })
      .on("broadcast", { event: "vote_cast" }, ({ payload }: { payload: ImpostorSessionEvent & { type: "vote_cast" } }) => {
        setVotedCount(payload.voted_count);
      })
      .on("broadcast", { event: "vote_resolved" }, ({ payload }: { payload: ImpostorSessionEvent & { type: "vote_resolved" } }) => {
        showFlash(payload.outcome === "continue" ? "No consensus — one more round-set…" : "Vote's in!");
        hydrate();
      })
      .on("broadcast", { event: "next_round_set_started" }, () => hydrate())
      .on("broadcast", { event: "game_ended" }, () => hydrate())
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    // Roster changes during the lobby stage aren't covered by broadcasts.
    const rosterChannel = supabase
      .channel(`impostor-spectate-roster-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "impostor_participants", filter: `session_id=eq.${sessionId}` }, () => hydrate())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(rosterChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hydrate, showFlash]);

  async function handleStopWatching() {
    await invokeFunction("impostor-host", { action: "release_spectator", session_id: sessionId });
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
  const { session, roster, clues } = state;

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
            <p className="text-muted">Waiting for the host to start the game… (Category: {session.category_name})</p>
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

        {(session.status === "clue_giving" || session.status === "voting") && (
          <>
            <ImpostorClueBoard clues={clues} roster={roster} currentTurnUserId={session.status === "clue_giving" ? session.current_turn_user_id : null} />
            <div className="card text-center">
              {session.status === "clue_giving" && (
                <p style={{ margin: 0 }}>
                  Round {session.round_number} of 4 — waiting on <strong>{usernameFor(session.current_turn_user_id)}</strong>
                </p>
              )}
              {session.status === "voting" && (
                <p style={{ margin: 0 }}>
                  Vote {session.vote_round} — {votedCount}/{roster.length} voted
                </p>
              )}
            </div>
          </>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2>{session.completed ? (session.winner === "crew" ? "🎉 Crew wins!" : "🎭 The Impostor wins!") : "Game cancelled"}</h2>
            {session.completed && session.revealed_impostor_user_id && (
              <p style={{ fontWeight: 700 }}>
                The Impostor was <strong>{usernameFor(session.revealed_impostor_user_id)}</strong> — the word was{" "}
                <strong>{session.revealed_secret_word}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
