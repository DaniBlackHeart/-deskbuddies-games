import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Timer from "../../components/Timer";
import Buzzer from "../../components/Buzzer";
import WheelBoard from "../../components/WheelBoard";
import WheelLetterTracker from "../../components/WheelLetterTracker";
import WheelSpinner from "../../components/WheelSpinner";
import WheelScoreboard from "../../components/WheelScoreboard";
import WheelTeamScoreboard from "../../components/WheelTeamScoreboard";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { sounds } from "../../lib/sounds";
import { recordServerTime } from "../../lib/clockSync";
import { WHEEL_CONSONANTS, WHEEL_VOWELS, WHEEL_VOWEL_COST, wedgeLabel } from "../../lib/wheelConstants";
import type { WheelParticipant, WheelRoundPublic, WheelSessionEvent, WheelSessionPublic, WheelTeam, WheelWedge } from "../../types";

type WheelState = {
  session: WheelSessionPublic;
  roster: WheelParticipant[];
  teams: WheelTeam[];
  my_team_id: string | null;
  round: WheelRoundPublic | null;
  is_playing: boolean;
};

// Matches the CSS transition duration on .wheel-spinner in global.css —
// the outcome (points/Bankrupt/etc.) only appears once the decorative
// spin animation has had time to finish.
const SPIN_ANIMATION_MS = 2300;

function wedgeSound(wedge: WheelWedge) {
  switch (wedge.type) {
    case "bankrupt":
      sounds.bankrupt();
      return;
    case "lose_turn":
      sounds.wrong();
      return;
    case "wild_card":
      sounds.wildCard();
      return;
    case "mystery":
      sounds.suspenseReveal();
      return;
    case "free_play":
      sounds.freePlaySaved();
      return;
    default:
      return;
  }
}

export default function WheelPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [state, setState] = useState<WheelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [lastWedge, setLastWedge] = useState<WheelWedge | null>(null);
  const [spinTargetWedge, setSpinTargetWedge] = useState<WheelWedge | null>(null);
  const [showVowelPicker, setShowVowelPicker] = useState(false);
  const [solveDraft, setSolveDraft] = useState("");
  const [bonusConsonants, setBonusConsonants] = useState<string[]>([]);
  const [bonusVowel, setBonusVowel] = useState<string | null>(null);
  const [bonusSolveDraft, setBonusSolveDraft] = useState("");
  const [roundEndBanner, setRoundEndBanner] = useState<{ solved: boolean; solverName?: string; points?: number; phrase: string } | null>(null);

  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bankrupt/Lose a Turn resolve server-side the instant the spin lands —
  // the very next broadcast (turn_ended/turn_passed/round_ended) can arrive
  // within milliseconds of spin_result, well before the ~2.3s spin
  // animation has actually finished. Anything that would otherwise update
  // state or hydrate while a spin is still visually playing gets queued
  // here instead, and runs once the spin's own timeout completes — so the
  // board never shows "whose turn it is now" before the wheel has stopped.
  const postSpinQueue = useRef<Array<() => void>>([]);

  function runOrQueue(fn: () => void) {
    if (spinTimeout.current) {
      postSpinQueue.current.push(fn);
    } else {
      fn();
    }
  }

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3500);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("get-wheel-state", { body: { session_id: sessionId } });
    if (error || data?.error) {
      console.error(error ?? data?.error);
      return;
    }
    recordServerTime(data.server_now_ms);
    setState(data as WheelState);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!state) return;
    if (state.session.status === "lobby") navigate("/wheel/lobby");
  }, [state?.session.status, navigate]);

  useEffect(() => {
    setBonusConsonants([]);
    setBonusVowel(null);
    setBonusSolveDraft("");
  }, [state?.session.status]);

  function usernameFor(userId: string | null | undefined): string {
    if (!userId) return "";
    return state?.roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  function teamNameFor(teamId: string | null | undefined): string {
    if (!teamId) return "";
    return state?.teams.find((t) => t.id === teamId)?.name ?? "A team";
  }

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`wheel-session-${sessionId}`)
      .on("broadcast", { event: "game_started" }, () => {
        sounds.sessionStart();
        setRoundEndBanner(null);
        hydrate();
      })
      .on("broadcast", { event: "round_started" }, () => {
        sounds.questionFlash();
        setRoundEndBanner(null);
        setLastWedge(null);
        setShowVowelPicker(false);
        hydrate();
      })
      .on("broadcast", { event: "tiebreaker_started" }, () => {
        showFlash("Tied! Do-or-Die round starting…");
      })
      .on("broadcast", { event: "buzz_won" }, ({ payload }: { payload: WheelSessionEvent & { type: "buzz_won" } }) => {
        if (payload.user_id !== profile?.id) sounds.buzzer();
        hydrate();
      })
      .on("broadcast", { event: "spin_result" }, ({ payload }: { payload: WheelSessionEvent & { type: "spin_result" } }) => {
        setSpinning(true);
        setLastWedge(null);
        setSpinTargetWedge(payload.wedge);
        setShowVowelPicker(false);
        if (spinTimeout.current) clearTimeout(spinTimeout.current);
        spinTimeout.current = setTimeout(() => {
          setSpinning(false);
          setLastWedge(payload.wedge);
          wedgeSound(payload.wedge);
          hydrate();
          spinTimeout.current = null;
          const queued = postSpinQueue.current;
          postSpinQueue.current = [];
          queued.forEach((fn) => fn());
        }, SPIN_ANIMATION_MS);
      })
      .on("broadcast", { event: "mystery_resolved" }, ({ payload }: { payload: WheelSessionEvent & { type: "mystery_resolved" } }) => {
        sounds.suspenseReveal();
        if (payload.outcome === "bankrupt") showFlash(`${usernameFor(payload.user_id)} risked it and lost everything!`);
        else if (payload.outcome === "big_win") showFlash(`${usernameFor(payload.user_id)} risked it and won big!`);
        else showFlash(`${usernameFor(payload.user_id)} took the safe ${payload.value} points.`);
        hydrate();
      })
      .on("broadcast", { event: "vowel_bought" }, () => {
        sounds.vowelBought();
        hydrate();
      })
      .on("broadcast", { event: "consonant_called" }, ({ payload }: { payload: WheelSessionEvent & { type: "consonant_called" } }) => {
        if (payload.hit) sounds.correct();
        else sounds.wrong();
        hydrate();
      })
      .on("broadcast", { event: "extra_call_available" }, () => {
        showFlash("Wild Card! Call one more consonant.");
        hydrate();
      })
      .on("broadcast", { event: "free_play_saved" }, () => {
        showFlash("Free Play saved that turn!");
        hydrate();
      })
      .on("broadcast", { event: "solve_attempt_started" }, ({ payload }: { payload: WheelSessionEvent & { type: "solve_attempt_started" } }) => {
        sounds.suspenseReveal();
        showFlash(`${usernameFor(payload.user_id)} is attempting to solve!`);
        hydrate();
      })
      .on("broadcast", { event: "solve_missed" }, () => {
        sounds.wrong();
        hydrate();
      })
      .on("broadcast", { event: "turn_ended" }, () => runOrQueue(() => hydrate()))
      .on("broadcast", { event: "turn_passed" }, ({ payload }: { payload: WheelSessionEvent & { type: "turn_passed" } }) => {
        runOrQueue(() => {
          showFlash(`${usernameFor(payload.to_user_id)}'s turn to spin!`);
          hydrate();
        });
      })
      .on("broadcast", { event: "turn_timed_out" }, () => runOrQueue(() => hydrate()))
      .on("broadcast", { event: "round_ended" }, ({ payload }: { payload: WheelSessionEvent & { type: "round_ended" } }) => {
        runOrQueue(() => {
          if (payload.solved) sounds.roundSolved();
          else sounds.noAnswer();
          setRoundEndBanner({
            solved: payload.solved,
            solverName: payload.solved_by_user_id ? usernameFor(payload.solved_by_user_id) : undefined,
            points: payload.points_won,
            phrase: payload.revealed_phrase,
          });
          hydrate();
        });
      })
      .on("broadcast", { event: "bonus_setup" }, () => {
        sounds.suspenseReveal();
        hydrate();
      })
      .on("broadcast", { event: "bonus_category_chosen" }, () => {
        sounds.questionFlash();
        hydrate();
      })
      .on("broadcast", { event: "bonus_board_revealed" }, () => {
        sounds.sessionStart();
        hydrate();
      })
      .on("broadcast", { event: "bonus_resolved" }, ({ payload }: { payload: WheelSessionEvent & { type: "bonus_resolved" } }) => {
        sounds.playSessionEnd(true, () => (payload.won ? sounds.winner() : sounds.loser()));
        hydrate();
      })
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (spinTimeout.current) clearTimeout(spinTimeout.current);
      postSpinQueue.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hydrate, showFlash, profile?.id]);

  async function callPlay(action: string, extra: Record<string, unknown> = {}) {
    if (!sessionId) return null;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("wheel-play", { body: { action, session_id: sessionId, ...extra } });
    setBusy(false);
    if (error || data?.error) {
      const message = data?.error ?? "Something went wrong";
      console.warn(action, message);
      showFlash(message);
      hydrate();
      return null;
    }
    return data;
  }

  if (loading || !state) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const { session, roster, teams, my_team_id, round, is_playing } = state;
  const myId = profile?.id;
  const isTeamMode = session.game_mode === "team";
  const isMyTurn = round?.active_user_id === myId;
  const myTeam = teams.find((t) => t.id === my_team_id);
  const isMyTurnToRepresent = !!myTeam && myTeam.members.find((m) => m.line_position === myTeam.current_rep_index)?.user_id === myId;
  const iAmLockedOut = isTeamMode ? !!round?.locked_out_team_ids.includes(my_team_id ?? "") : !!round?.locked_out_user_ids.includes(myId ?? "");
  const iAmWinner = session.winner_user_id === myId;
  const scoreKey = isTeamMode ? my_team_id ?? "" : myId ?? "";
  const myRoundScore = round?.round_scores?.[scoreKey] ?? 0;
  const usedVowelSet = new Set(round?.guessed_letters ?? []);
  const usedConsonantSet = new Set(round?.guessed_letters ?? []);

  // ---------------- Ended screen ----------------
  if (session.status === "ended") {
    const winnerTotal = isTeamMode
      ? teams.find((t) => t.id === session.winner_team_id)?.total_points ?? 0
      : roster.find((p) => p.user_id === session.winner_user_id)?.total_points ?? 0;
    const winnerLabel = isTeamMode
      ? session.winner_team_id
        ? `${teamNameFor(session.winner_team_id)} (${usernameFor(session.winner_user_id)})`
        : null
      : session.winner_user_id
        ? usernameFor(session.winner_user_id)
        : null;
    return (
      <div className="app-shell">
        <AppHeader />
        <div className="container container--narrow">
          <div className="card text-center">
            <h2 style={{ marginTop: 0 }}>{winnerLabel ? `🎉 ${winnerLabel} won the game!` : "Game ended"}</h2>
            {winnerLabel && (
              <p className="text-muted">
                Final score before the Bonus Round: <strong>{winnerTotal - (session.bonus_won ? session.bonus_points_awarded ?? 0 : 0)}</strong>
              </p>
            )}
            {session.bonus_won !== null && (
              <div className="card card--tight" style={{ marginTop: "12px" }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {session.bonus_won ? `🏆 Solved the Bonus Round for ${session.bonus_points_awarded} points!` : "Didn't solve the Bonus Round."}
                </p>
                {session.bonus_solved_phrase && <p className="text-muted" style={{ marginTop: "6px" }}>The phrase was: <strong>{session.bonus_solved_phrase}</strong></p>}
              </div>
            )}
            <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => navigate("/")}>
              Back to games
            </button>
          </div>
          <div style={{ marginTop: "16px" }}>{isTeamMode ? <WheelTeamScoreboard teams={teams} /> : <WheelScoreboard roster={roster} />}</div>
        </div>
      </div>
    );
  }

  // ---------------- Bonus Round screens ----------------
  if (session.status === "bonus_category_choice" || session.status === "bonus_letter_choice" || session.status === "bonus_solving") {
    return (
      <div className="app-shell">
        <AppHeader />
        <div className="container container--narrow">
          {flash && (
            <div className="card text-center" style={{ marginBottom: "12px", fontWeight: 700 }}>
              {flash}
            </div>
          )}
          <div className="card text-center" style={{ marginBottom: "16px" }}>
            <h2 style={{ marginTop: 0 }}>🎁 Bonus Round</h2>
            <p className="text-muted">
              {isTeamMode ? `${teamNameFor(session.winner_team_id)}'s ${usernameFor(session.winner_user_id)}` : usernameFor(session.winner_user_id)} is playing for the grand prize!
            </p>
          </div>

          {session.status === "bonus_category_choice" && (
            <div className="card">
              {iAmWinner ? (
                <>
                  <p style={{ fontWeight: 700, textAlign: "center" }}>Choose a category:</p>
                  <div className="stack">
                    {(session.bonus_category_choices ?? []).map((c) => (
                      <button key={c.id} className="btn btn-secondary btn-block" disabled={busy} onClick={() => callPlay("bonus_choose_category", { category_id: c.id })}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted text-center" style={{ margin: 0 }}>Waiting on {usernameFor(session.winner_user_id)} to choose a category…</p>
              )}
            </div>
          )}

          {session.status === "bonus_letter_choice" && (
            <div className="card">
              <p className="text-muted text-center">
                Category: <strong>{session.bonus_category_name}</strong> · Given letters: <strong>{session.bonus_given_letters.join(" ")}</strong>
              </p>
              {iAmWinner ? (
                <>
                  <p style={{ fontWeight: 700, textAlign: "center" }}>Pick 3 consonants and 1 vowel:</p>
                  <div className="wheel-keypad">
                    {WHEEL_CONSONANTS.filter((c) => !session.bonus_given_letters.includes(c)).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="wheel-keypad__key"
                        disabled={busy || (bonusConsonants.includes(c) ? false : bonusConsonants.length >= 3)}
                        style={bonusConsonants.includes(c) ? { borderColor: "var(--color-primary)", background: "var(--color-primary-soft)" } : undefined}
                        onClick={() => setBonusConsonants((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length < 3 ? [...cs, c] : cs))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="wheel-keypad" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {WHEEL_VOWELS.filter((v) => !session.bonus_given_letters.includes(v)).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="wheel-keypad__key wheel-keypad__key--vowel"
                        disabled={busy}
                        style={bonusVowel === v ? { borderColor: "var(--color-primary)" } : undefined}
                        onClick={() => setBonusVowel(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary btn-block"
                    style={{ marginTop: "12px" }}
                    disabled={busy || bonusConsonants.length !== 3 || !bonusVowel}
                    onClick={() => callPlay("bonus_choose_letters", { consonants: bonusConsonants, vowel: bonusVowel })}
                  >
                    Reveal the board
                  </button>
                </>
              ) : (
                <p className="text-muted text-center" style={{ margin: 0 }}>Waiting on {usernameFor(session.winner_user_id)} to pick letters…</p>
              )}
            </div>
          )}

          {session.status === "bonus_solving" && (
            <>
              <WheelBoard maskedPhrase={session.bonus_masked_phrase ?? ""} categoryName={session.bonus_category_name ?? ""} />
              <div className="card">
                {session.bonus_deadline_ms && <Timer deadline={session.bonus_deadline_ms} onExpire={() => callPlay("bonus_solve_timeout")} />}
                {iAmWinner ? (
                  <>
                    <div className="field">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Solve the puzzle…"
                        value={bonusSolveDraft}
                        onChange={(e) => setBonusSolveDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && bonusSolveDraft.trim() && callPlay("bonus_solve", { guess: bonusSolveDraft.trim() })}
                      />
                    </div>
                    <button
                      className="btn btn-primary btn-block"
                      disabled={busy || !bonusSolveDraft.trim()}
                      onClick={() => callPlay("bonus_solve", { guess: bonusSolveDraft.trim() })}
                    >
                      Solve!
                    </button>
                  </>
                ) : (
                  <p className="text-muted text-center" style={{ margin: 0 }}>Watching {usernameFor(session.winner_user_id)} go for it…</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------------- Main round screens (live / tiebreaker) ----------------
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        {flash && (
          <div className="card text-center" style={{ marginBottom: "12px", fontWeight: 700 }}>
            {flash}
          </div>
        )}

        <p className="text-center text-muted" style={{ marginTop: 0 }}>
          {round?.is_tiebreaker ? "Do-or-Die Tiebreaker" : `Round ${(round?.round_index ?? 0) + 1} of 5`}
        </p>

        {round && <WheelBoard maskedPhrase={round.masked_phrase} categoryName={round.category_name} />}
        {round && <WheelLetterTracker guessedLetters={round.guessed_letters} />}

        {round?.status !== "active" && roundEndBanner && (
          <div className="card text-center" style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: 700, margin: 0 }}>
              {roundEndBanner.solved ? `${roundEndBanner.solverName} solved it for ${roundEndBanner.points} points!` : "Nobody solved it — revealed."}
            </p>
            <p className="text-muted" style={{ margin: "6px 0 0" }}>The phrase was: <strong>{roundEndBanner.phrase}</strong></p>
            <p className="hint" style={{ marginTop: "10px" }}>Waiting for the host to start the next round…</p>
          </div>
        )}

        {round?.status === "active" && round.turn_phase === "buzz_open" && (
          <div className="card text-center">
            {round.turn_deadline_ms && <Timer deadline={round.turn_deadline_ms} onExpire={() => callPlay("buzz_timeout")} />}
            {!is_playing || (isTeamMode ? !round.eligible_team_ids.includes(my_team_id ?? "") : !round.eligible_user_ids.includes(myId ?? "")) ? (
              <p className="text-muted">
                {!is_playing
                  ? "Just watching this round."
                  : round.is_tiebreaker
                    ? "Your team isn't tied for the lead, so you're just watching this tiebreaker."
                    : "Just watching this round."}
              </p>
            ) : iAmLockedOut ? (
              <p className="text-muted">{isTeamMode ? "Your team is" : "You're"} locked out until {isTeamMode ? "another team" : "someone else"} guesses a correct consonant.</p>
            ) : isTeamMode && !isMyTurnToRepresent ? (
              <p className="text-muted">
                Waiting on your teammate {usernameFor(myTeam?.members.find((m) => m.line_position === myTeam.current_rep_index)?.user_id)} to buzz in for {myTeam?.name}…
              </p>
            ) : (
              <Buzzer onBuzz={() => callPlay("buzz")} disabled={busy} label="BUZZ IN" />
            )}
          </div>
        )}

        {round?.status === "active" && isMyTurn && (
          <div className="card">
            {round.turn_deadline_ms && (
              <Timer
                deadline={round.turn_deadline_ms}
                onExpire={() =>
                  round.turn_phase === "awaiting_solve_guess" ? callPlay("solve_timeout") : callPlay("turn_timeout")
                }
              />
            )}

            {round.turn_phase === "awaiting_action" && (
              <>
                <WheelSpinner spinning={spinning} targetWedge={spinTargetWedge} resultLabel={lastWedge ? wedgeLabel(lastWedge) : null} />
                <p className="text-center text-muted" style={{ margin: "8px 0" }}>Your round total: {myRoundScore}</p>
                {!showVowelPicker ? (
                  <div className="stack">
                    <button className="btn btn-primary btn-block" disabled={busy} onClick={() => callPlay("spin")}>
                      🎡 Spin the wheel
                    </button>
                    <button
                      className="btn btn-secondary btn-block"
                      disabled={busy || myRoundScore < WHEEL_VOWEL_COST}
                      onClick={() => setShowVowelPicker(true)}
                    >
                      Buy a vowel ({WHEEL_VOWEL_COST} pts)
                    </button>
                    <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => callPlay("start_solve_attempt")}>
                      Solve the puzzle
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-center hint">Pick a vowel:</p>
                    <div className="wheel-keypad" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                      {WHEEL_VOWELS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="wheel-keypad__key wheel-keypad__key--vowel"
                          disabled={busy || usedVowelSet.has(v)}
                          onClick={() => callPlay("buy_vowel", { letter: v }).then(() => setShowVowelPicker(false))}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowVowelPicker(false)}>
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}

            {round.turn_phase === "awaiting_consonant" && (
              <>
                {round.pending_wedge ? (
                  <>
                    <WheelSpinner spinning={false} resultLabel={wedgeLabel(round.pending_wedge)} />
                    <p className="text-center" style={{ fontWeight: 700 }}>Call a consonant:</p>
                  </>
                ) : (
                  <p className="text-center" style={{ fontWeight: 700 }}>You buzzed in! Call a consonant:</p>
                )}
                <div className="wheel-keypad">
                  {WHEEL_CONSONANTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="wheel-keypad__key"
                      disabled={busy || usedConsonantSet.has(c)}
                      onClick={() => callPlay("call_consonant", { letter: c })}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            {round.turn_phase === "awaiting_mystery_choice" && (
              <>
                <p className="text-center" style={{ fontWeight: 700 }}>Mystery Wedge! Take the safe points, or risk it?</p>
                <div className="row" style={{ justifyContent: "center" }}>
                  <button className="btn btn-secondary" disabled={busy} onClick={() => callPlay("mystery_choice", { choice: "take" })}>
                    Take it safe
                  </button>
                  <button className="btn btn-primary" disabled={busy} onClick={() => callPlay("mystery_choice", { choice: "risk" })}>
                    Risk it!
                  </button>
                </div>
              </>
            )}

            {round.turn_phase === "awaiting_solve_guess" && (
              <>
                <p className="text-center" style={{ fontWeight: 700 }}>Solve the puzzle!</p>
                <div className="field">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Type the full phrase…"
                    value={solveDraft}
                    onChange={(e) => setSolveDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && solveDraft.trim() && callPlay("submit_solve", { guess: solveDraft.trim() }).then(() => setSolveDraft(""))}
                  />
                </div>
                <button
                  className="btn btn-primary btn-block"
                  disabled={busy || !solveDraft.trim()}
                  onClick={() => callPlay("submit_solve", { guess: solveDraft.trim() }).then(() => setSolveDraft(""))}
                >
                  Submit
                </button>
              </>
            )}
          </div>
        )}

        {round?.status === "active" && round.turn_phase !== "buzz_open" && !isMyTurn && (
          <div className="card text-center">
            <p className="text-muted" style={{ margin: 0 }}>
              {isTeamMode ? `${teamNameFor(round.active_team_id)} (${usernameFor(round.active_user_id)})'s turn…` : `${usernameFor(round.active_user_id)}'s turn…`}
            </p>
          </div>
        )}

        <div style={{ marginTop: "16px" }}>
          {isTeamMode ? (
            <WheelTeamScoreboard teams={teams} roundScores={round?.round_scores} activeTeamId={round?.active_team_id} lockedOutTeamIds={round?.locked_out_team_ids} />
          ) : (
            <WheelScoreboard roster={roster} roundScores={round?.round_scores} activeUserId={round?.active_user_id} lockedOutUserIds={round?.locked_out_user_ids} />
          )}
        </div>

        {!is_playing && <p className="hint text-center" style={{ marginTop: "16px" }}>You're spectating this game from the play screen.</p>}
      </div>
    </div>
  );
}
