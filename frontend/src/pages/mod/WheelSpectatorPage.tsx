import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import WheelBoard from "../../components/WheelBoard";
import WheelLetterTracker from "../../components/WheelLetterTracker";
import WheelSpinner from "../../components/WheelSpinner";
import WheelScoreboard from "../../components/WheelScoreboard";
import WheelTeamScoreboard from "../../components/WheelTeamScoreboard";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { wedgeLabel } from "../../lib/wheelConstants";
import type { WheelParticipant, WheelRoundPublic, WheelSessionPublic, WheelTeam, WheelWedge } from "../../types";

type WheelState = {
  session: WheelSessionPublic;
  roster: WheelParticipant[];
  teams: WheelTeam[];
  round: WheelRoundPublic | null;
};

// Matches the CSS transition duration on .wheel-spinner in global.css —
// same constant WheelPlayPage uses, kept in sync so the spectator's wheel
// finishes spinning at the same moment a player's would.
const SPIN_ANIMATION_MS = 2300;

export default function WheelSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<WheelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [lastWedge, setLastWedge] = useState<WheelWedge | null>(null);
  const [spinTargetWedge, setSpinTargetWedge] = useState<WheelWedge | null>(null);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Same reasoning as WheelPlayPage: Bankrupt/Lose a Turn resolve
  // server-side the instant the spin lands, so the very next broadcast
  // can arrive before the ~2.3s spin animation has actually finished.
  // Anything that would update state while a spin is still visually
  // playing gets queued here instead, and runs once the spin's own
  // timeout completes.
  const postSpinQueue = useRef<Array<() => void>>([]);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("get-wheel-state", { body: { session_id: sessionId } });
    if (error || data?.error) {
      console.error(error ?? data?.error);
      return;
    }
    setState(data as WheelState);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      const { error } = await invokeFunction("wheel-host", { action: "claim_spectator", session_id: sessionId });
      if (cancelled) return;
      if (error) {
        setClaimError(error);
        setLoading(false);
        return;
      }
      hydrate();
    })();

    const channel = supabase
      .channel(`wheel-session-${sessionId}`)
      .on("broadcast", { event: "spin_result" }, ({ payload }: { payload: { wedge: WheelWedge } }) => {
        setSpinning(true);
        setLastWedge(null);
        setSpinTargetWedge(payload.wedge);
        if (spinTimeout.current) clearTimeout(spinTimeout.current);
        spinTimeout.current = setTimeout(() => {
          setSpinning(false);
          setLastWedge(payload.wedge);
          hydrate();
          spinTimeout.current = null;
          const queued = postSpinQueue.current;
          postSpinQueue.current = [];
          queued.forEach((fn) => fn());
        }, SPIN_ANIMATION_MS);
      })
      .on("broadcast", { event: "*" }, (message: { event: string }) => {
        // spin_result is handled above with a delay, so the board doesn't
        // reveal the outcome before the wheel visually finishes spinning.
        if (message.event === "spin_result") return;

        const run = () => {
          if (["round_started", "turn_ended", "turn_passed", "turn_timed_out"].includes(message.event)) {
            setLastWedge(null);
            setSpinning(false);
          }
          hydrate();
        };

        // Bankrupt/Lose a Turn's immediate follow-up events must wait for
        // the spin to actually finish, same as WheelPlayPage — otherwise
        // this would cut the animation short via the setSpinning(false)
        // above, well before the wheel visually stops.
        if (spinTimeout.current && ["turn_ended", "turn_passed", "turn_timed_out", "round_ended"].includes(message.event)) {
          postSpinQueue.current.push(run);
          return;
        }
        run();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      if (spinTimeout.current) clearTimeout(spinTimeout.current);
      postSpinQueue.current = [];
      invokeFunction("wheel-host", { action: "release_spectator", session_id: sessionId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hydrate]);

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (claimError) {
    return (
      <div className="app-shell">
        <AppHeader />
        <div className="container container--narrow">
          <div className="card text-center">
            <p className="error-text">{claimError}</p>
            <button className="btn btn-secondary" onClick={() => navigate("/mod")}>
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state) return null;
  const { session, roster, teams, round } = state;
  const isTeamMode = session.game_mode === "team";

  function usernameFor(userId: string | null | undefined): string {
    if (!userId) return "";
    return roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  function teamNameFor(teamId: string | null | undefined): string {
    if (!teamId) return "";
    return teams.find((t) => t.id === teamId)?.name ?? "A team";
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="badge badge-neutral" style={{ marginBottom: "12px" }}>
          👁 Spectating {isTeamMode && "· Team mode"}
        </div>

        {(session.status === "live" || session.status === "tiebreaker") && round && (
          <>
            <p className="text-center text-muted">
              {round.is_tiebreaker ? "Do-or-Die Tiebreaker" : `Round ${round.round_index + 1} of 5`}
            </p>
            <WheelBoard maskedPhrase={round.masked_phrase} categoryName={round.category_name} />
            <WheelLetterTracker guessedLetters={round.guessed_letters} />
            <div className="card text-center">
              {round.status === "active" ? (
                <>
                  <p style={{ margin: 0 }}>
                    {round.turn_phase === "buzz_open"
                      ? "Buzzer's open…"
                      : isTeamMode
                        ? `${teamNameFor(round.active_team_id)} (${usernameFor(round.active_user_id)})'s turn`
                        : `${usernameFor(round.active_user_id)}'s turn`}
                  </p>
                  {round.active_user_id && <WheelSpinner spinning={spinning} targetWedge={spinTargetWedge} resultLabel={!spinning ? wedgeLabel(round.pending_wedge ?? lastWedge) : null} />}
                </>
              ) : (
                <p style={{ margin: 0 }}>Round finished.</p>
              )}
            </div>
          </>
        )}

        {(session.status === "bonus_category_choice" || session.status === "bonus_letter_choice") && (
          <div className="card text-center">
            <h2 style={{ marginTop: 0 }}>🎁 Bonus Round</h2>
            <p className="text-muted">
              {isTeamMode ? `${teamNameFor(session.winner_team_id)}'s ${usernameFor(session.winner_user_id)}` : usernameFor(session.winner_user_id)} is choosing…
            </p>
          </div>
        )}

        {session.status === "bonus_solving" && (
          <>
            <WheelBoard maskedPhrase={session.bonus_masked_phrase ?? ""} categoryName={session.bonus_category_name ?? ""} />
            <div className="card text-center">
              <p style={{ margin: 0 }}>
                {isTeamMode ? `${teamNameFor(session.winner_team_id)}'s ${usernameFor(session.winner_user_id)}` : usernameFor(session.winner_user_id)} is solving the Bonus Round…
              </p>
            </div>
          </>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2 style={{ marginTop: 0 }}>
              {isTeamMode
                ? session.winner_team_id
                  ? `🎉 ${teamNameFor(session.winner_team_id)} won!`
                  : "Game ended"
                : session.winner_user_id
                  ? `🎉 ${usernameFor(session.winner_user_id)} won!`
                  : "Game ended"}
            </h2>
            {session.bonus_won !== null && (
              <p style={{ fontWeight: 700 }}>{session.bonus_won ? `Solved the Bonus Round for ${session.bonus_points_awarded} points!` : "Didn't solve the Bonus Round."}</p>
            )}
          </div>
        )}

        <div style={{ marginTop: "16px" }}>
          {isTeamMode ? (
            <WheelTeamScoreboard teams={teams} roundScores={round?.round_scores} activeTeamId={round?.active_team_id} lockedOutTeamIds={round?.locked_out_team_ids} />
          ) : (
            <WheelScoreboard roster={roster} roundScores={round?.round_scores} activeUserId={round?.active_user_id} lockedOutUserIds={round?.locked_out_user_ids} />
          )}
        </div>
      </div>
    </div>
  );
}
