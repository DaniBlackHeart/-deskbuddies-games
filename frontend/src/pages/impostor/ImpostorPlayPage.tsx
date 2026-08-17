import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Timer from "../../components/Timer";
import ImpostorCardView from "../../components/ImpostorCardView";
import ImpostorClueBoard from "../../components/ImpostorClueBoard";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { sounds } from "../../lib/sounds";
import type { ImpostorCard, ImpostorClue, ImpostorParticipant, ImpostorSessionEvent, ImpostorSessionPublic } from "../../types";

type ImpostorState = {
  session: ImpostorSessionPublic;
  roster: ImpostorParticipant[];
  clues: ImpostorClue[];
  my_card: ImpostorCard | null;
  has_voted: boolean;
  is_playing: boolean;
};

export default function ImpostorPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [state, setState] = useState<ImpostorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [clueDraft, setClueDraft] = useState("");
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedEndSoundRef = useRef(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3500);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("get-impostor-state", { body: { session_id: sessionId } });
    if (error || data?.error) {
      console.error(error ?? data?.error);
      return;
    }
    setState(data as ImpostorState);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!state) return;
    if (state.session.status === "lobby") navigate("/impostor/lobby");
  }, [state?.session.status, navigate]);

  // Clear the vote pick whenever a fresh vote round opens.
  useEffect(() => {
    setSelectedSuspect(null);
  }, [state?.session.vote_round]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`impostor-session-${sessionId}`)
      .on("broadcast", { event: "game_started" }, () => {
        sounds.sessionStart();
        setRevealed(false);
        hydrate();
      })
      .on("broadcast", { event: "clue_submitted" }, () => {
        sounds.clueChime();
        hydrate();
      })
      .on("broadcast", { event: "voting_started" }, ({ payload }: { payload: ImpostorSessionEvent & { type: "voting_started" } }) => {
        sounds.suspenseReveal();
        showFlash(`Vote ${payload.vote_round}: who's the Impostor?`);
        hydrate();
      })
      .on("broadcast", { event: "vote_cast" }, () => hydrate())
      .on("broadcast", { event: "vote_resolved" }, ({ payload }: { payload: ImpostorSessionEvent & { type: "vote_resolved" } }) => {
        if (payload.outcome === "continue") {
          showFlash("No clear consensus — one more round of clues coming up…");
        }
        hydrate();
      })
      .on("broadcast", { event: "next_round_set_started" }, () => {
        sounds.sessionStart();
        hydrate();
      })
      .on("broadcast", { event: "game_ended" }, () => hydrate())
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, hydrate, showFlash]);

  // Game-end sound — once per session, mirroring UnoPlayPage's pattern.
  // Personalized: the Impostor "wins" feel opposite to everyone else's,
  // so this checks my_card.is_impostor against the outcome rather than
  // just checking a single winner_id like UNO does.
  useEffect(() => {
    if (!state || playedEndSoundRef.current) return;
    if (state.session.status !== "ended") return;
    playedEndSoundRef.current = true;
    if (state.session.completed && state.session.winner) {
      sounds.playSessionEnd(true, () => {
        const s = latestStateRef.current;
        if (!s?.session.winner || !s.is_playing || !s.my_card) return;
        const iWon = s.my_card.is_impostor ? s.session.winner === "impostor" : s.session.winner === "crew";
        if (iWon) sounds.winner();
        else sounds.loser();
      });
    } else {
      sounds.sessionEndedByMod();
    }
  }, [state]);

  async function callPlay(action: string, extra: Record<string, unknown> = {}) {
    if (!sessionId) return null;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("impostor-play", { body: { action, session_id: sessionId, ...extra } });
    setBusy(false);
    if (error || data?.error) {
      console.warn(action, data?.error ?? error);
      if (data?.error) showFlash(data.error);
      hydrate();
      return null;
    }
    return data;
  }

  async function handleSubmitClue() {
    if (!state || !clueDraft.trim()) return;
    const result = await callPlay("submit_clue", { clue_text: clueDraft.trim(), expected_version: state.session.state_version });
    if (result) setClueDraft("");
  }

  async function handleVote(suspectUserId: string) {
    if (busy || state?.has_voted) return;
    setSelectedSuspect(suspectUserId);
    sounds.voteLock();
    await callPlay("submit_vote", { suspect_user_id: suspectUserId });
    hydrate();
  }

  function usernameFor(userId: string | null): string {
    if (!userId) return "";
    return state?.roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  if (loading || !state) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const { session, roster, clues, my_card, has_voted, is_playing } = state;
  const isMyTurn = is_playing && session.current_turn_user_id === profile?.id;

  if (session.status === "ended") {
    return (
      <div className="app-shell">
        <AppHeader />
        <div className="container container--narrow">
          <div className="impostor-reveal card">
            <h2 style={{ marginTop: 0 }}>
              {session.completed ? (session.winner === "crew" ? "🎉 Crew wins!" : "🎭 The Impostor wins!") : "Game cancelled"}
            </h2>
            {session.completed && session.revealed_impostor_user_id && (
              <>
                <p className="text-muted" style={{ margin: 0 }}>
                  The Impostor was
                </p>
                <p className="impostor-reveal__word">{usernameFor(session.revealed_impostor_user_id)}</p>
                <p className="text-muted" style={{ margin: 0 }}>
                  The secret word was
                </p>
                <p className="impostor-reveal__word">{session.revealed_secret_word}</p>
              </>
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

        {is_playing && my_card && (
          <div style={{ marginBottom: "16px" }}>
            <ImpostorCardView card={my_card} revealed={revealed} onReveal={() => setRevealed(true)} />
          </div>
        )}

        <ImpostorClueBoard clues={clues} roster={roster} currentTurnUserId={session.status === "clue_giving" ? session.current_turn_user_id : null} />

        {session.status === "clue_giving" && (
          <div className="card">
            {session.clue_deadline_ms && <Timer deadline={session.clue_deadline_ms} onExpire={() => callPlay("clue_timeout")} />}
            {isMyTurn ? (
              <>
                <p style={{ fontWeight: 700, textAlign: "center", marginTop: 0 }}>Your turn — give a clue!</p>
                <div className="field" style={{ marginBottom: "8px" }}>
                  <input
                    type="text"
                    autoFocus
                    maxLength={140}
                    placeholder="A one-word or short clue…"
                    value={clueDraft}
                    onChange={(e) => setClueDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmitClue()}
                  />
                </div>
                <button className="btn btn-primary btn-block" disabled={busy || !clueDraft.trim()} onClick={handleSubmitClue}>
                  Submit clue
                </button>
              </>
            ) : (
              <p className="text-muted text-center" style={{ margin: 0 }}>
                Waiting on <strong>{usernameFor(session.current_turn_user_id)}</strong>…
              </p>
            )}
          </div>
        )}

        {session.status === "voting" && (
          <div className="card">
            {session.vote_deadline_ms && <Timer deadline={session.vote_deadline_ms} onExpire={() => callPlay("vote_timeout")} />}
            <p style={{ fontWeight: 700, textAlign: "center", marginTop: 0 }}>
              Vote {session.vote_round}: who's the Impostor?
            </p>
            {has_voted || selectedSuspect ? (
              <p className="text-muted text-center" style={{ margin: 0 }}>
                Your vote's locked in — waiting for everyone else…
              </p>
            ) : (
              <div className="impostor-vote-grid">
                {roster
                  .filter((p) => p.user_id !== profile?.id)
                  .map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      className={`impostor-vote-option ${selectedSuspect === p.user_id ? "impostor-vote-option--selected" : ""}`}
                      disabled={busy}
                      onClick={() => handleVote(p.user_id)}
                    >
                      {p.profiles?.username}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {!is_playing && (
          <p className="hint text-center">You're spectating this game from the play screen — no card or vote to cast.</p>
        )}
      </div>
    </div>
  );
}
