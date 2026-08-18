import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import ImpostorClueBoard from "../../components/ImpostorClueBoard";
import ImpostorVoteResults from "../../components/ImpostorVoteResults";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { ImpostorClue, ImpostorFinalVoteTally, ImpostorParticipant, ImpostorSessionEvent, ImpostorSessionPublic } from "../../types";

type ImpostorState = {
  session: ImpostorSessionPublic;
  roster: ImpostorParticipant[];
  clues: ImpostorClue[];
  // my_card/has_voted are always null/false here — a spectating MOD never
  // has a card or a vote, and get-impostor-state naturally returns that
  // for anyone not seated, same as get-uno-state's my_hand for spectators.
};

type Phase = "loading" | "claim_failed" | "ready";

// Same reveal-then-move-on pause as ImpostorPlayPage — see its comment on
// RESULTS_REVEAL_MS for why this isn't just an immediate hydrate().
const RESULTS_REVEAL_MS = 6000;

export default function ImpostorSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [state, setState] = useState<ImpostorState | null>(null);
  const [votedCount, setVotedCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [lastVoteResult, setLastVoteResult] = useState<(ImpostorFinalVoteTally & { outcome: "continue" | "crew_win" | "impostor_win" }) | null>(
    null
  );
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      .on("broadcast", { event: "game_started" }, () => {
        setLastVoteResult(null);
        hydrate();
      })
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
        setLastVoteResult({
          vote_round: payload.vote_round,
          tally: payload.tally,
          total_votes: payload.total_votes,
          accused_user_id: payload.accused_user_id,
          outcome: payload.outcome,
        });
        if (payload.outcome === "continue") {
          showFlash("No consensus — one more round-set…");
          if (resultsTimeout.current) clearTimeout(resultsTimeout.current);
          resultsTimeout.current = setTimeout(hydrate, RESULTS_REVEAL_MS);
        } else {
          showFlash("Vote's in!");
          hydrate();
        }
      })
      .on("broadcast", { event: "next_round_set_started" }, () => {
        // No hydrate() here on purpose — see the vote_resolved handler above.
      })
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
      if (resultsTimeout.current) clearTimeout(resultsTimeout.current);
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
  const finalResults =
    lastVoteResult ?? (session.final_vote_tally ? { ...session.final_vote_tally, outcome: session.winner === "crew" ? ("crew_win" as const) : ("impostor_win" as const) } : null);

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

        {session.status === "clue_giving" && (
          <>
            <ImpostorClueBoard clues={clues} roster={roster} currentTurnUserId={session.current_turn_user_id} />
            <div className="card text-center">
              <p style={{ margin: 0 }}>
                Round {session.round_number} of 4 — waiting on <strong>{usernameFor(session.current_turn_user_id)}</strong>
              </p>
            </div>
          </>
        )}

        {session.status === "voting" &&
          (lastVoteResult && lastVoteResult.vote_round === session.vote_round ? (
            <ImpostorVoteResults
              headline="No clear consensus — here's how the votes landed:"
              roster={roster}
              tally={lastVoteResult.tally}
              totalVotes={lastVoteResult.total_votes}
              accusedUserId={lastVoteResult.accused_user_id}
            />
          ) : (
            <>
              <ImpostorClueBoard clues={clues} roster={roster} currentTurnUserId={null} />
              <div className="card text-center">
                <p style={{ margin: 0 }}>
                  Vote {session.vote_round} — {votedCount}/{roster.length} voted
                </p>
              </div>
            </>
          ))}

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

        {session.status === "ended" && finalResults && (
          <div style={{ marginTop: "16px" }}>
            <ImpostorVoteResults
              headline="How the vote went:"
              roster={roster}
              tally={finalResults.tally}
              totalVotes={finalResults.total_votes}
              accusedUserId={finalResults.accused_user_id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
