import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import Timer from "../../components/Timer";
import Buzzer from "../../components/Buzzer";
import FeudBoard from "../../components/FeudBoard";
import TeamScoreboard from "../../components/TeamScoreboard";
import TypedAnswerBox from "../../components/TypedAnswerBox";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { sounds } from "../../lib/sounds";
import type { FeudParticipant, FeudSessionEvent, PublicFeudRound, Team } from "../../types";

type FastMoneyRevealedEntry = {
  question_index: number;
  prompt: string;
  player1: { answer_text: string; points_awarded: number } | null;
  player2: { answer_text: string; points_awarded: number } | null;
};

type FeudState = {
  session: {
    id: string;
    status: string;
    team_a_name: string;
    team_b_name: string;
    team_a_score: number;
    team_b_score: number;
    current_round_index: number;
    fastmoney_team: Team | null;
    fastmoney_player1_id: string | null;
    fastmoney_player2_id: string | null;
    fastmoney_total_points: number;
  };
  my_team: Team | null;
  roster_a: FeudParticipant[];
  roster_b: FeudParticipant[];
  round: PublicFeudRound | null;
  fast_money: { my_slot: 1 | 2; answered_indices: number[] } | null;
  fast_money_revealed: FastMoneyRevealedEntry[];
  completed: boolean;
};

const FASTMONEY_QUESTION_COUNT = 5;

export default function FeudPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [state, setState] = useState<FeudState | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [huddle, setHuddle] = useState<{ username: string; text: string }[]>([]);
  const [huddleInput, setHuddleInput] = useState("");
  const [fmDuplicateFlag, setFmDuplicateFlag] = useState<number | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3500);
  }, []);

  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("get-feud-state", { body: { session_id: sessionId } });
    if (error || data?.error) {
      console.error(error ?? data?.error);
      return;
    }
    setState(data as FeudState);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!state) return;
    if (state.session.status === "lobby") {
      navigate("/feud/lobby");
    }
  }, [state?.session.status, navigate]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`feud-session-${sessionId}`)
      .on("broadcast", { event: "round_started" }, ({ payload }: { payload: FeudSessionEvent & { type: "round_started" } }) => {
        showFlash(`Round ${payload.round_index + 1} — face-off!`);
        hydrate();
      })
      .on("broadcast", { event: "buzz_locked" }, ({ payload }: { payload: FeudSessionEvent & { type: "buzz_locked" } }) => {
        // Skip for whoever actually pressed — Buzzer.tsx already played the
        // sound for them the instant they tapped, with zero network delay.
        if (payload.winner_user_id !== profile?.id) sounds.buzzer();
        hydrate();
      })
      .on("broadcast", { event: "faceoff_correct" }, ({ payload }: { payload: FeudSessionEvent & { type: "faceoff_correct" } }) => {
        showFlash(`✅ "${payload.text}" — ${payload.points} pts!`);
        sounds.correct();
        sounds.boardReveal();
        hydrate();
      })
      .on("broadcast", { event: "faceoff_miss" }, ({ payload }: { payload: FeudSessionEvent & { type: "faceoff_miss" } }) => {
        showFlash("❌ Not on the board!");
        if (payload.timed_out) sounds.noAnswer();
        else sounds.wrong();
        hydrate();
      })
      .on("broadcast", { event: "faceoff_next_pair" }, () => {
        sounds.questionFlash();
        hydrate();
      })
      .on("broadcast", { event: "faceoff_all_missed" }, ({ payload }: { payload: FeudSessionEvent & { type: "faceoff_all_missed" } }) => {
        showFlash("😬 Nobody took control!");
        if (payload.timed_out) sounds.noAnswer();
        else sounds.wrong();
        hydrate();
      })
      .on("broadcast", { event: "board_started" }, () => {
        sounds.questionFlash();
        hydrate();
      })
      .on("broadcast", { event: "board_correct" }, ({ payload }: { payload: FeudSessionEvent & { type: "board_correct" } }) => {
        showFlash(`✅ "${payload.text}" — ${payload.points} pts!`);
        sounds.correct();
        sounds.boardReveal();
        hydrate();
      })
      .on("broadcast", { event: "board_strike" }, ({ payload }: { payload: FeudSessionEvent & { type: "board_strike" } }) => {
        showFlash("❌ STRIKE!");
        if (payload.timed_out) sounds.noAnswer();
        else sounds.wrong();
        hydrate();
      })
      .on("broadcast", { event: "board_cleared" }, () => {
        showFlash("🎉 Board cleared!");
        sounds.correct();
        sounds.boardReveal();
        hydrate();
      })
      .on("broadcast", { event: "steal_started" }, ({ payload }: { payload: FeudSessionEvent & { type: "steal_started" } }) => {
        showFlash("🔁 Three strikes — steal time!");
        if (payload.timed_out) sounds.noAnswer();
        else sounds.wrong();
        setHuddle([]);
        hydrate();
      })
      .on("broadcast", { event: "round_complete" }, ({ payload }: { payload: FeudSessionEvent & { type: "round_complete" } }) => {
        showFlash(payload.outcome === "stolen" ? "🕵️ Stolen!" : "🛡️ Defended!");
        if (payload.outcome === "stolen") sounds.correct();
        else if (payload.timed_out) sounds.noAnswer();
        else sounds.wrong();
        sounds.boardReveal();
        hydrate();
      })
      .on("broadcast", { event: "lost_reveal_answer" }, () => {
        sounds.boardReveal();
        hydrate();
      })
      .on("broadcast", { event: "main_game_ended" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_setup" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_player_started" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_reveal_ready" }, () => hydrate())
      .on("broadcast", { event: "fastmoney_answer_revealed" }, ({ payload }: { payload: FeudSessionEvent & { type: "fastmoney_answer_revealed" } }) => {
        // If either player blanked on this one, that's the more useful cue
        // to hear than the generic reveal ding.
        if (payload.player1_answer === null || payload.player2_answer === null) sounds.noAnswer();
        else sounds.boardReveal();
        hydrate();
      })
      .on("broadcast", { event: "game_started" }, () => hydrate())
      .on("broadcast", { event: "session_ended" }, () => hydrate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, hydrate, showFlash, profile?.id]);

  // Huddle chat — ephemeral, client-to-client broadcast only (nothing persisted,
  // nothing scored). Scoped per round so it clears itself out naturally.
  useEffect(() => {
    if (!sessionId || !state?.round || state.round.status !== "steal") return;
    const roundIdx = state.round.round_index;
    const channel = supabase
      .channel(`feud-huddle-${sessionId}-${roundIdx}`)
      .on("broadcast", { event: "message" }, ({ payload }: { payload: { username: string; text: string } }) => {
        setHuddle((prev) => [...prev, payload]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, state?.round?.status, state?.round?.round_index]);

  // Session-end sound when the game ends — once per session. A "set
  // finished" or "ended early" intro plays first, then whoever's on the
  // winning team gets the winner sound, the other team gets the loser
  // sound. A tie gets neither (there's no clear outcome to react to).
  const playedEndSoundRef = useRef(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  useEffect(() => {
    if (!state || playedEndSoundRef.current) return;
    if (state.session.status !== "ended") return;
    playedEndSoundRef.current = true;
    // The intro (finished vs. cut short) always plays. The winner/loser
    // follow-up only plays if there's an actual team assigned and an actual
    // winner — read from a ref rather than closing over `state` directly,
    // since this runs after playSessionEnd's delay and state may have
    // moved on by then.
    sounds.playSessionEnd(state.completed, () => {
      const s = latestStateRef.current;
      if (!s || !s.my_team) return;
      const { team_a_score, team_b_score } = s.session;
      if (team_a_score === team_b_score) return; // tie — no personal outcome to announce
      const winningTeam: Team = team_a_score > team_b_score ? "A" : "B";
      if (s.my_team === winningTeam) sounds.winner();
      else sounds.loser();
    });
  }, [state]);

  function sendHuddleMessage() {
    if (!huddleInput.trim() || !sessionId || !state?.round) return;
    const channel = supabase.channel(`feud-huddle-${sessionId}-${state.round.round_index}`);
    channel.send({ type: "broadcast", event: "message", payload: { username: profile?.username ?? "Someone", text: huddleInput.trim() } });
    setHuddle((prev) => [...prev, { username: profile?.username ?? "You", text: huddleInput.trim() }]);
    setHuddleInput("");
  }

  async function callPlay(action: string, extra: Record<string, unknown> = {}) {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("feud-play", { body: { action, session_id: sessionId, ...extra } });
    if (error || data?.error) {
      // 409s here are mostly benign races (e.g. someone else buzzed first,
      // or a timeout failsafe firing after the round already moved on).
      console.warn(action, data?.error ?? error);
    }
    return data;
  }

  function usernameFor(userId: string | null): string {
    if (!userId) return "";
    const all = [...(state?.roster_a ?? []), ...(state?.roster_b ?? [])];
    return all.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  if (loading || !state) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const { session, round, my_team } = state;
  const isMyTurn = (userId: string | null) => !!userId && userId === profile?.id;

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <TeamScoreboard
          teamAName={session.team_a_name}
          teamBName={session.team_b_name}
          teamAScore={session.team_a_score}
          teamBScore={session.team_b_score}
          highlightTeam={round?.controlling_team ?? null}
        />

        {flash && (
          <div className="card feud-reveal-flash text-center" style={{ marginBottom: "16px", fontWeight: 700, fontSize: "1.1rem" }}>
            {flash}
          </div>
        )}

        {session.status === "live" && round && renderRound()}
        {session.status === "main_ended" && renderMainEnded()}
        {(session.status === "fastmoney_setup" || session.status === "fastmoney_p1" || session.status === "fastmoney_p2") && renderFastMoney()}
        {session.status === "fastmoney_reveal" && renderFastMoneyReveal()}
        {session.status === "ended" && renderEnded()}
      </div>
    </div>
  );

  function renderRound() {
    if (!round) return null;

    if (round.status === "faceoff") {
      const iAmActive = isMyTurn(round.face_off_active_a_user_id) || isMyTurn(round.face_off_active_b_user_id);
      const expectedUser = round.face_off_singleton_user_id ?? round.face_off_buzz_user_id;
      const buzzOpen = !round.face_off_buzz_user_id && iAmActive;
      const myTurnToAnswer = expectedUser && isMyTurn(expectedUser);
      const waitingOnSomeoneElse = expectedUser && !myTurnToAnswer;

      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Round {round.round_index + 1} · Face-off</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <p className="text-muted">
            {usernameFor(round.face_off_active_a_user_id)} vs {usernameFor(round.face_off_active_b_user_id)}
          </p>

          {buzzOpen && <Buzzer onBuzz={() => callPlay("buzz")} />}
          {!buzzOpen && !expectedUser && !iAmActive && <p className="hint">Waiting for a buzz…</p>}

          {expectedUser && (
            <>
              {round.face_off_deadline_ms && <Timer deadline={round.face_off_deadline_ms} onExpire={() => callPlay("faceoff_timeout")} />}
              {myTurnToAnswer ? (
                <TypedAnswerBox onSubmit={(text) => callPlay("faceoff_answer", { answer_text: text })} placeholder="Your answer…" />
              ) : (
                waitingOnSomeoneElse && <p className="hint">{usernameFor(expectedUser)} is answering…</p>
              )}
            </>
          )}
        </div>
      );
    }

    if (round.status === "faceoff_decision") {
      const decisionIsMine = round.face_off_decision_user_id === profile?.id;
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Round {round.round_index + 1}</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <FeudBoard board={round.board} pointsPot={round.points_pot} />
          {decisionIsMine ? (
            <div className="row" style={{ justifyContent: "center", marginTop: "16px" }}>
              <button className="btn btn-primary" onClick={() => callPlay("pass_or_continue", { choice: "continue" })}>
                ▶ Play
              </button>
              <button className="btn btn-secondary" onClick={() => callPlay("pass_or_continue", { choice: "pass" })}>
                ⤴ Pass
              </button>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: "12px" }}>
              Waiting for {usernameFor(round.face_off_decision_user_id)} to choose: play or pass…
            </p>
          )}
        </div>
      );
    }

    if (round.status === "board") {
      const myTurn = isMyTurn(round.current_turn_user_id);
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">
            {round.controlling_team === "A" ? session.team_a_name : session.team_b_name} is playing the board
          </span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <div className="feud-strikes">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`feud-strike ${i < round.strikes ? "feud-strike--hit" : ""}`}>
                {i < round.strikes ? "✕" : ""}
              </div>
            ))}
          </div>
          <FeudBoard board={round.board} pointsPot={round.points_pot} />
          {round.current_turn_deadline_ms && <Timer deadline={round.current_turn_deadline_ms} onExpire={() => callPlay("board_timeout")} />}
          {myTurn ? (
            <TypedAnswerBox onSubmit={(text) => callPlay("board_answer", { answer_text: text })} placeholder="Your answer…" />
          ) : (
            <p className="hint">{usernameFor(round.current_turn_user_id)}'s turn — no helping!</p>
          )}
        </div>
      );
    }

    if (round.status === "steal") {
      const onOpposingTeam = my_team === round.opposing_team;
      const roster = round.opposing_team === "A" ? state!.roster_a : state!.roster_b;
      const captainId = roster[0]?.user_id;
      const iAmCaptain = captainId === profile?.id;

      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Steal! {round.points_pot} pts on the line</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <FeudBoard board={round.board} />
          {round.current_turn_deadline_ms && <Timer deadline={round.current_turn_deadline_ms} onExpire={() => callPlay("steal_timeout")} />}

          {onOpposingTeam ? (
            <>
              <div className="feud-huddle" style={{ margin: "16px 0" }}>
                <strong>🤫 Huddle up — discuss it openly!</strong>
                <p className="hint">
                  {iAmCaptain ? "You give the final answer." : `${usernameFor(captainId)} will give the final answer.`}
                </p>
                <div className="stack" style={{ textAlign: "left", maxHeight: "140px", overflowY: "auto", margin: "8px 0" }}>
                  {huddle.map((m, i) => (
                    <p key={i} style={{ margin: 0, fontSize: "0.9rem" }}>
                      <strong>{m.username}:</strong> {m.text}
                    </p>
                  ))}
                </div>
                <div className="row">
                  <input
                    type="text"
                    placeholder="Say something to your team…"
                    value={huddleInput}
                    onChange={(e) => setHuddleInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendHuddleMessage()}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-border)" }}
                  />
                  <button className="btn btn-sm" onClick={sendHuddleMessage}>
                    Send
                  </button>
                </div>
              </div>
              {iAmCaptain && <TypedAnswerBox onSubmit={(text) => callPlay("steal_answer", { answer_text: text })} placeholder="Your team's final answer…" submitLabel="Lock it in" />}
              {!iAmCaptain && <p className="hint">Waiting for {usernameFor(captainId)} to lock in your answer…</p>}
            </>
          ) : (
            <p className="hint">The other team is huddling to try to steal your points…</p>
          )}
        </div>
      );
    }

    if (round.status === "lost_reveal") {
      return (
        <div className="card text-center">
          <span className="badge badge-neutral">Nobody took control</span>
          <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
          <p className="hint">The board's being revealed…</p>
          <FeudBoard board={round.board} />
        </div>
      );
    }

    // complete
    return (
      <div className="card text-center">
        <span className="badge badge-neutral">Round {round.round_index + 1} complete</span>
        <h2 style={{ marginTop: "8px" }}>{round.prompt}</h2>
        <FeudBoard board={round.board} />
        {round.outcome && (
          <p style={{ fontWeight: 700, marginTop: "12px" }}>
            {round.outcome === "cleared" && `🎉 ${round.awarded_to_team === "A" ? session.team_a_name : session.team_b_name} cleared the board!`}
            {round.outcome === "stolen" && `🕵️ ${round.awarded_to_team === "A" ? session.team_a_name : session.team_b_name} stole it!`}
            {round.outcome === "defended" && `🛡️ ${round.awarded_to_team === "A" ? session.team_a_name : session.team_b_name} held on!`}
            {round.outcome === "lost_no_control" && "No points awarded this round."}
          </p>
        )}
        <p className="hint">Waiting for the host to start the next round…</p>
      </div>
    );
  }

  function renderMainEnded() {
    return (
      <div className="card text-center">
        <h2>Main game over!</h2>
        <p className="text-muted">Waiting for the host to set up Fast Money…</p>
      </div>
    );
  }

  function renderFastMoney() {
    const iAmP1 = session.fastmoney_player1_id === profile?.id;
    const iAmP2 = session.fastmoney_player2_id === profile?.id;
    const activeSlot = session.status === "fastmoney_p1" ? 1 : session.status === "fastmoney_p2" ? 2 : null;
    const isMyTurnNow = (activeSlot === 1 && iAmP1) || (activeSlot === 2 && iAmP2);

    if (session.status === "fastmoney_setup") {
      return (
        <div className="card text-center">
          <h2>💰 Fast Money!</h2>
          <p className="text-muted">
            {iAmP1 || iAmP2 ? "You're playing!" : `${session.fastmoney_team === "A" ? session.team_a_name : session.team_b_name} is up.`}
          </p>
          <p className="hint">Waiting for the host to start Player 1…</p>
        </div>
      );
    }

    if (!isMyTurnNow) {
      return (
        <div className="card text-center">
          <h2>💰 Fast Money</h2>
          <p className="text-muted">
            {activeSlot === 1 ? "Player 1" : "Player 2"} is answering now — no peeking, everyone else just waits for the reveal!
          </p>
        </div>
      );
    }

    const answeredIndices = new Set(state!.fast_money?.answered_indices ?? []);

    return (
      <div className="card">
        <h2 className="text-center">💰 Your Fast Money run!</h2>
        <p className="hint text-center">
          {activeSlot === 2 && "If you repeat your teammate's answer, it won't count — try something else."}
        </p>
        <div className="stack">
          {Array.from({ length: FASTMONEY_QUESTION_COUNT }).map((_, i) => (
            <div key={i} className="card card--tight">
              <strong>Question {i + 1}</strong>
              {answeredIndices.has(i) ? (
                <p className="hint">✓ Locked in</p>
              ) : (
                <>
                  <TypedAnswerBox
                    autoFocus={false}
                    submitLabel="Lock in"
                    placeholder="Your answer…"
                    onSubmit={async (text) => {
                      const result = await callPlay("fastmoney_answer", { question_index: i, answer_text: text });
                      if (result?.duplicate) {
                        setFmDuplicateFlag(i);
                        setTimeout(() => setFmDuplicateFlag((cur) => (cur === i ? null : cur)), 3000);
                      } else if (result?.saved) {
                        hydrate();
                      }
                    }}
                  />
                  {fmDuplicateFlag === i && <p className="error-text">🚫 Buzz! That answer's already been given — try something else.</p>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderFastMoneyReveal() {
    return (
      <div className="card text-center">
        <h2>💰 Fast Money — the reveal!</h2>
        <p className="feud-pot">Running total: {session.fastmoney_total_points} / 200</p>
        <div className="stack" style={{ marginTop: "16px", textAlign: "left" }}>
          {state!.fast_money_revealed.map((r) => (
            <div key={r.question_index} className="card card--tight">
              <strong>{r.prompt}</strong>
              <p style={{ margin: "4px 0" }}>
                Player 1: {r.player1?.answer_text ?? "—"} ({r.player1?.points_awarded ?? 0} pts)
              </p>
              <p style={{ margin: 0 }}>
                Player 2: {r.player2?.answer_text ?? "—"} ({r.player2?.points_awarded ?? 0} pts)
              </p>
            </div>
          ))}
        </div>
        {state!.fast_money_revealed.length === 0 && <p className="hint">Waiting for the host to reveal the first answer…</p>}
      </div>
    );
  }

  function renderEnded() {
    const winner = session.team_a_score === session.team_b_score ? null : session.team_a_score > session.team_b_score ? session.team_a_name : session.team_b_name;
    return (
      <div className="card text-center">
        <h2>🏁 Game over!</h2>
        {winner ? <p style={{ fontWeight: 700 }}>{winner} won the main game!</p> : <p>It was a tie!</p>}
        {session.fastmoney_total_points > 0 && (
          <p style={{ fontWeight: 700, marginTop: "8px" }}>
            {session.fastmoney_total_points >= 200 ? "🏆 They won the grand prize!" : `Fast Money total: ${session.fastmoney_total_points} — not quite 200.`}
          </p>
        )}
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => navigate("/")}>
          Back to games
        </button>
      </div>
    );
  }
}
