import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import WheelBoard from "../../components/WheelBoard";
import WheelScoreboard from "../../components/WheelScoreboard";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { WheelParticipant, WheelRoundPublic, WheelSessionPublic } from "../../types";

type WheelState = {
  session: WheelSessionPublic;
  roster: WheelParticipant[];
  round: WheelRoundPublic | null;
};

export default function WheelSpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<WheelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimError, setClaimError] = useState<string | null>(null);

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
      .on("broadcast", { event: "*" }, () => hydrate())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
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
  const { session, roster, round } = state;

  function usernameFor(userId: string | null | undefined): string {
    if (!userId) return "";
    return roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="badge badge-neutral" style={{ marginBottom: "12px" }}>👁 Spectating</div>

        {(session.status === "live" || session.status === "tiebreaker") && round && (
          <>
            <p className="text-center text-muted">
              {round.is_tiebreaker ? "Do-or-Die Tiebreaker" : `Round ${round.round_index + 1} of 5`}
            </p>
            <WheelBoard maskedPhrase={round.masked_phrase} categoryName={round.category_name} />
            <div className="card text-center">
              {round.status === "active" ? (
                <p style={{ margin: 0 }}>
                  {round.turn_phase === "buzz_open" ? "Buzzer's open…" : `${usernameFor(round.active_user_id)}'s turn`}
                </p>
              ) : (
                <p style={{ margin: 0 }}>Round finished.</p>
              )}
            </div>
          </>
        )}

        {(session.status === "bonus_category_choice" || session.status === "bonus_letter_choice") && (
          <div className="card text-center">
            <h2 style={{ marginTop: 0 }}>🎁 Bonus Round</h2>
            <p className="text-muted">{usernameFor(session.winner_user_id)} is choosing…</p>
          </div>
        )}

        {session.status === "bonus_solving" && (
          <>
            <WheelBoard maskedPhrase={session.bonus_masked_phrase ?? ""} categoryName={session.bonus_category_name ?? ""} />
            <div className="card text-center">
              <p style={{ margin: 0 }}>{usernameFor(session.winner_user_id)} is solving the Bonus Round…</p>
            </div>
          </>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2 style={{ marginTop: 0 }}>{session.winner_user_id ? `🎉 ${usernameFor(session.winner_user_id)} won!` : "Game ended"}</h2>
            {session.bonus_won !== null && (
              <p style={{ fontWeight: 700 }}>{session.bonus_won ? `Solved the Bonus Round for ${session.bonus_points_awarded} points!` : "Didn't solve the Bonus Round."}</p>
            )}
          </div>
        )}

        <div style={{ marginTop: "16px" }}>
          <WheelScoreboard roster={roster} roundScores={round?.round_scores} activeUserId={round?.active_user_id} lockedOutUserIds={round?.locked_out_user_ids} />
        </div>
      </div>
    </div>
  );
}
