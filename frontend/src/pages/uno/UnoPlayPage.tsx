import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import UnoCardView from "../../components/UnoCardView";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { sounds } from "../../lib/sounds";
import { isUnoLegalPlayAgainst, isUnoJumpInMatch, isUnoWildCard } from "../../lib/unoRules";
import type { UnoCard, UnoColor, UnoParticipant, UnoSessionEvent, UnoSessionPublic } from "../../types";

type UnoState = {
  session: UnoSessionPublic;
  roster: UnoParticipant[];
  my_hand: UnoCard[];
  is_playing: boolean;
};

const COLOR_LABEL: Record<UnoColor, string> = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" };

export default function UnoPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [state, setState] = useState<UnoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingCard, setPendingCard] = useState<UnoCard | null>(null); // a wild/7 the player tapped but hasn't finished configuring
  const [unoArmed, setUnoArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedEndSoundRef = useRef(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3000);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("get-uno-state", { body: { session_id: sessionId } });
    if (error || data?.error) {
      console.error(error ?? data?.error);
      return;
    }
    setState(data as UnoState);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!state) return;
    if (state.session.status === "lobby") navigate("/uno/lobby");
  }, [state?.session.status, navigate]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`uno-session-${sessionId}`)
      .on("broadcast", { event: "game_started" }, () => {
        sounds.sessionStart();
        hydrate();
      })
      .on("broadcast", { event: "card_played" }, ({ payload }: { payload: UnoSessionEvent & { type: "card_played" } }) => {
        sounds.cardReveal();
        if (payload.pending_draw_type) showFlash(payload.pending_draw_type === "draw_four" ? "Wild +4!" : "+2!");
        hydrate();
      })
      .on("broadcast", { event: "card_drawn" }, () => {
        sounds.cardDraw();
        hydrate();
      })
      .on("broadcast", { event: "forced_draw" }, ({ payload }: { payload: UnoSessionEvent & { type: "forced_draw" } }) => {
        sounds.cardDraw();
        showFlash(`Drew ${payload.count} 😬`);
        hydrate();
      })
      .on("broadcast", { event: "turn_passed" }, () => hydrate())
      .on("broadcast", { event: "uno_caught" }, () => {
        sounds.wrong();
        showFlash("🚨 Caught without calling UNO!");
        hydrate();
      })
      .on("broadcast", { event: "challenge_resolved" }, ({ payload }: { payload: UnoSessionEvent & { type: "challenge_resolved" } }) => {
        if (payload.success) sounds.correct();
        else sounds.wrong();
        showFlash(payload.success ? "Challenge won! 🎯" : "Challenge failed 😬");
        hydrate();
      })
      .on("broadcast", { event: "game_ended" }, () => hydrate())
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, hydrate, showFlash]);

  // Game-end sound — once per session, mirroring FeudPlayPage's pattern.
  // A natural win (someone empties their hand) gets the full fanfare +
  // personal winner/loser sound. A MOD cutting the game short only gets
  // the neutral "ended by mod" cue — there's no legitimate winner to
  // announce there.
  useEffect(() => {
    if (!state || playedEndSoundRef.current) return;
    if (state.session.status !== "ended") return;
    playedEndSoundRef.current = true;
    if (state.session.winner_id) {
      sounds.playSessionEnd(true, () => {
        const s = latestStateRef.current;
        if (!s?.session.winner_id) return;
        if (s.session.winner_id === profile?.id) sounds.winner();
        else if (s.is_playing) sounds.loser();
      });
    } else {
      sounds.sessionEndedByMod();
    }
  }, [state, profile?.id]);

  async function callPlay(action: string, extra: Record<string, unknown> = {}) {
    if (!sessionId || !state) return null;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("uno-play", {
      body: { action, session_id: sessionId, expected_version: state.session.state_version, ...extra },
    });
    setBusy(false);
    if (error || data?.error) {
      console.warn(action, data?.error ?? error);
      if (data?.error) showFlash(data.error);
      hydrate(); // our local state_version may be stale — resync
      return null;
    }
    return data;
  }

  function usernameFor(userId: string | null): string {
    if (!userId) return "";
    return state?.roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  function handleCardTap(card: UnoCard) {
    if (busy || !state) return;
    if (isUnoWildCard(card) || card.value === "7") {
      setPendingCard(card);
      return;
    }
    void playCard(card, {});
  }

  async function playCard(card: UnoCard, extra: Record<string, unknown>) {
    const result = await callPlay("play_card", { card, called_uno: unoArmed, ...extra });
    setPendingCard(null);
    if (result) setUnoArmed(false);
  }

  if (loading || !state) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const { session, roster, my_hand, is_playing } = state;
  const isMyTurn = session.current_turn_user_id === profile?.id;
  const otherActivePlayers = roster.filter((p) => p.user_id !== profile?.id && !p.finished_at);

  function isPlayable(card: UnoCard): boolean {
    if (!session.discard_top || !session.current_color) return false;
    if (isMyTurn) return isUnoLegalPlayAgainst(card, session.discard_top, session.current_color, session.pending_draw_type);
    if (session.pending_draw_type) return false;
    return isUnoJumpInMatch(card, session.discard_top);
  }

  if (session.status === "ended") {
    const standings = [...roster].sort((a, b) => (a.finish_rank ?? 99) - (b.finish_rank ?? 99));
    return (
      <div className="app-shell">
        <AppHeader />
        <div className="container container--narrow">
          <div className="card text-center">
            <h2>{session.winner_id ? "🏁 Game over!" : "Game cancelled"}</h2>
            {session.winner_id && <p style={{ fontWeight: 700 }}>{usernameFor(session.winner_id)} won! 🎉</p>}
            {standings.length > 0 && (
              <div className="stack" style={{ marginTop: "16px", textAlign: "left" }}>
                {standings.map((p, i) => (
                  <div key={p.user_id} className="row-between">
                    <span>
                      {p.finish_rank ?? i + 1}. {p.profiles?.username}
                    </span>
                    <span className="text-muted">{p.hand_count} card{p.hand_count === 1 ? "" : "s"} left</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => navigate("/")}>
              Back to games
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        {flash && (
          <div className="card text-center" style={{ marginBottom: "12px", fontWeight: 700 }}>
            {flash}
          </div>
        )}

        <div className="row-between">
          <span className={`uno-direction ${session.direction === -1 ? "uno-direction--reversed" : ""}`} aria-label="Play direction">
            ➜
          </span>
          <span className="badge badge-neutral">
            {isMyTurn ? "Your turn!" : `${usernameFor(session.current_turn_user_id)}'s turn`}
          </span>
          {session.current_color && (
            <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
              {COLOR_LABEL[session.current_color]}
            </span>
          )}
        </div>

        <div className="uno-table">
          <div className="uno-draw-pile">
            <UnoCardView card={{ color: "wild", value: "wild" }} faceDown size="lg" />
            <span className="hint">{session.draw_pile_count} left</span>
          </div>
          {session.discard_top && <UnoCardView card={session.discard_top} size="lg" />}
        </div>

        {session.pending_draw_type && (
          <div className="text-center" style={{ marginBottom: "12px" }}>
            <span className="uno-pending-badge">⚠️ {session.pending_draw} to draw</span>
          </div>
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
              {p.hand_count === 1 && !p.has_called_uno && !p.finished_at && p.user_id !== profile?.id && (
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => callPlay("catch_uno", { target_user_id: p.user_id })}>
                  Catch!
                </button>
              )}
            </div>
          ))}
        </div>

        {pendingCard && isUnoWildCard(pendingCard) && (
          <div className="card text-center">
            <p style={{ fontWeight: 700, marginTop: 0 }}>Choose a color</p>
            <div className="uno-color-picker">
              {(Object.keys(COLOR_LABEL) as UnoColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`uno-color-swatch uno-color-swatch--${c}`}
                  aria-label={COLOR_LABEL[c]}
                  onClick={() => playCard(pendingCard, { chosen_color: c })}
                />
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setPendingCard(null)}>
              Cancel
            </button>
          </div>
        )}

        {pendingCard && pendingCard.value === "7" && (
          <div className="card text-center">
            <p style={{ fontWeight: 700, marginTop: 0 }}>Swap hands with…</p>
            <div className="stack">
              {otherActivePlayers.map((p) => (
                <button key={p.user_id} className="btn btn-secondary btn-block" onClick={() => playCard(pendingCard, { swap_with_user_id: p.user_id })}>
                  {p.profiles?.username} ({p.hand_count} cards)
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: "8px" }} onClick={() => setPendingCard(null)}>
              Cancel
            </button>
          </div>
        )}

        {is_playing && !pendingCard && (
          <>
            <div className="uno-hand">
              {my_hand.map((card, i) => (
                <UnoCardView key={i} card={card} onClick={() => handleCardTap(card)} disabled={busy || !isPlayable(card)} />
              ))}
            </div>

            <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
              {my_hand.length === 2 && (
                <button className={`btn btn-sm ${unoArmed ? "btn-primary" : "btn-secondary"}`} onClick={() => setUnoArmed((v) => !v)}>
                  📢 {unoArmed ? "Calling UNO!" : "Call UNO"}
                </button>
              )}
              {isMyTurn && !session.pending_draw_type && !session.drawn_this_turn && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => callPlay("draw_card")}>
                  Draw a card
                </button>
              )}
              {isMyTurn && session.pending_draw_type && (
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => callPlay("draw_card")}>
                  Draw {session.pending_draw} (forced)
                </button>
              )}
              {isMyTurn && !session.pending_draw_type && session.drawn_this_turn && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => callPlay("pass_turn")}>
                  Pass turn
                </button>
              )}
              {isMyTurn && session.pending_draw_type === "draw_four" && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => callPlay("challenge_wild_draw_four")}>
                  🤨 Challenge!
                </button>
              )}
            </div>
          </>
        )}

        {!is_playing && <p className="hint text-center">You're spectating this game from the play screen — no hand to show.</p>}
      </div>
    </div>
  );
}
