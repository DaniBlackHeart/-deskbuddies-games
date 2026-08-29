import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import Timer from "../../components/Timer";
import TypedAnswerBox from "../../components/TypedAnswerBox";
import Leaderboard from "../../components/Leaderboard";
import RebusTeamLeaderboard from "../../components/RebusTeamLeaderboard";
import { recordServerTime, correctedNow } from "../../lib/clockSync";
import { lobbyMusic, sounds } from "../../lib/sounds";
import type {
  PublicRebusPuzzle,
  RebusLeaderboardEntry,
  RebusSessionEvent,
  RebusSessionStatus,
  RebusTeamLeaderboardEntry,
} from "../../types";

type SprintPlayerInfo = { user_id: string; username: string } | null;

export default function RebusPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [status, setStatus] = useState<RebusSessionStatus | "loading">("loading");
  const [mode, setMode] = useState<"chill" | "hard">("chill");
  const [gameMode, setGameMode] = useState<"solo" | "team">("solo");
  const [leaderboard, setLeaderboard] = useState<RebusLeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<RebusTeamLeaderboardEntry[] | null>(null);

  // Rounds 1-3
  const [puzzle, setPuzzle] = useState<PublicRebusPuzzle | null>(null);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [existingAnswer, setExistingAnswer] = useState<{ answer_text: string | null; is_correct: boolean; points_awarded: number } | null>(null);
  const [revealed, setRevealed] = useState<{ answer_text: string; accepted_answers: string[] } | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sprint (Round 4)
  const [sprintPlayer1, setSprintPlayer1] = useState<SprintPlayerInfo>(null);
  const [sprintPlayer2, setSprintPlayer2] = useState<SprintPlayerInfo>(null);
  const [sprintP1Points, setSprintP1Points] = useState(0);
  const [sprintP2Points, setSprintP2Points] = useState(0);
  const [mySlot, setMySlot] = useState<1 | 2 | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);
  const [sprintDeadlineMs, setSprintDeadlineMs] = useState<number | null>(null);
  const [mySprintPuzzle, setMySprintPuzzle] = useState<{ display_text: string } | null>(null);
  const [myAttempted, setMyAttempted] = useState(0);
  const [sprintFlash, setSprintFlash] = useState<{ is_correct: boolean; points_awarded: number } | null>(null);
  const [sprintExpired, setSprintExpired] = useState(false);

  // Final Round
  const [finalist, setFinalist] = useState<{ user_id: string; username: string } | null>(null);
  const [finalPuzzle, setFinalPuzzle] = useState<{ id: string; display_text: string; points: number; time_limit_seconds: number } | null>(null);
  const [finalDeadlineMs, setFinalDeadlineMs] = useState<number | null>(null);
  const [finalExistingAnswer, setFinalExistingAnswer] = useState<{ answer_text: string | null; is_correct: boolean; points_awarded: number } | null>(null);
  const [finalRevealed, setFinalRevealed] = useState<{ answer_text: string; accepted_answers: string[] } | null>(null);
  const [finalTimeExpired, setFinalTimeExpired] = useState(false);

  const [sessionCompleted, setSessionCompleted] = useState(false);

  const currentPuzzleIdRef = useRef<string | null>(null);
  const puzzleStartRef = useRef<number>(0);
  const finalStartRef = useRef<number>(0);

  async function hydrate() {
    const { data, error } = await supabase.functions.invoke("get-rebus-state", { body: { session_id: sessionId } });
    if (error) {
      console.error(error);
      return;
    }
    recordServerTime(data.server_now_ms);
    setMode(data.mode === "hard" ? "hard" : "chill");
    setGameMode(data.game_mode === "team" ? "team" : "solo");
    setLeaderboard(data.leaderboard ?? []);
    setTeamLeaderboard(data.team_leaderboard ?? null);
    setStatus(data.status);

    if (data.status === "ended") {
      setSessionCompleted(Boolean(data.completed));
      return;
    }

    if (data.status === "live" || data.status === "reveal") {
      setPuzzle(data.puzzle ?? null);
      currentPuzzleIdRef.current = data.puzzle?.id ?? null;
      setDeadlineMs(data.deadline_ms ?? null);
      puzzleStartRef.current = data.deadline_ms && data.puzzle ? data.deadline_ms - data.puzzle.time_limit_seconds * 1000 : 0;
      setExistingAnswer(data.existing_answer ?? null);
      setRevealed(data.revealed ?? null);
      setTimeExpired(data.status === "reveal" || (data.deadline_ms ? correctedNow() > data.deadline_ms : false));
      setSubmitError(null);
    }

    if (["sprint_setup", "sprint_p1", "sprint_p2", "sprint_done"].includes(data.status)) {
      setSprintPlayer1(data.sprint_player1 ?? null);
      setSprintPlayer2(data.sprint_player2 ?? null);
      setSprintP1Points(data.sprint_p1_points ?? 0);
      setSprintP2Points(data.sprint_p2_points ?? 0);
      setActiveSlot(data.active_slot ?? null);
      setMySlot(data.my_slot ?? null);
      setSprintDeadlineMs(data.deadline_ms ?? null);
      setSprintExpired(data.deadline_ms ? correctedNow() > data.deadline_ms : false);
      // The server only ever includes puzzle content when it's genuinely
      // this caller's active turn (see get-rebus-state's anti-cheat note)
      // — explicitly clear it otherwise rather than leaving stale state
      // from a previous turn on screen.
      if (data.my_slot && data.my_slot === data.active_slot) {
        setMySprintPuzzle(data.my_current_puzzle ?? null);
        setMyAttempted(data.my_attempted ?? 0);
      } else {
        setMySprintPuzzle(null);
        setMyAttempted(0);
      }
    }

    if (data.status === "final_live" || data.status === "final_reveal") {
      setFinalist(data.finalist ?? null);
      setFinalPuzzle(data.puzzle ?? null);
      setFinalDeadlineMs(data.deadline_ms ?? null);
      finalStartRef.current = data.deadline_ms && data.puzzle ? data.deadline_ms - data.puzzle.time_limit_seconds * 1000 : 0;
      setFinalExistingAnswer(data.existing_answer ?? null);
      setFinalRevealed(data.revealed ?? null);
      setFinalTimeExpired(data.status === "final_reveal" || (data.deadline_ms ? correctedNow() > data.deadline_ms : false));
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    hydrate();

    const channel = supabase
      .channel(`rebus-session-${sessionId}`)
      .on("broadcast", { event: "lobby_update" }, () => {
        sounds.sessionStart();
        hydrate();
      })
      .on("broadcast", { event: "puzzle_started" }, ({ payload }: { payload: RebusSessionEvent & { type: "puzzle_started" } }) => {
        setStatus("live");
        setPuzzle(payload.puzzle);
        currentPuzzleIdRef.current = payload.puzzle.id;
        setDeadlineMs(payload.deadline_ms);
        puzzleStartRef.current = payload.deadline_ms - payload.puzzle.time_limit_seconds * 1000;
        setExistingAnswer(null);
        setRevealed(null);
        setSubmitError(null);
        setTimeExpired(false);
        sounds.questionFlash();
      })
      .on("broadcast", { event: "puzzle_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "puzzle_ended" } }) => {
        setStatus("reveal");
        setRevealed({ answer_text: payload.answer_text ?? "", accepted_answers: payload.accepted_answers });
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
      })
      .on("broadcast", { event: "round_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "round_ended" } }) => {
        setStatus("round_ended");
        setPuzzle(null);
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
        sounds.roundSolved();
      })
      .on("broadcast", { event: "sprint_setup" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_setup" } }) => {
        setStatus("sprint_setup");
        setSprintPlayer1(payload.player1);
        setSprintPlayer2(payload.player2);
        setSprintP1Points(0);
        setSprintP2Points(0);
        setMySlot(profile?.id === payload.player1.user_id ? 1 : profile?.id === payload.player2.user_id ? 2 : null);
        setActiveSlot(null);
      })
      .on("broadcast", { event: "sprint_player_started" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_player_started" } }) => {
        setStatus(payload.player_slot === 1 ? "sprint_p1" : "sprint_p2");
        setActiveSlot(payload.player_slot);
        setSprintDeadlineMs(payload.deadline_ms);
        setSprintExpired(false);
        setSprintFlash(null);
        setMyAttempted(0);
        sounds.buzzer();
        hydrate(); // only the acting player's own next call gets puzzle content — re-hydrate to fetch it
      })
      .on("broadcast", { event: "sprint_progress" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_progress" } }) => {
        if (payload.player_slot === 1) setSprintP1Points(payload.points);
        else setSprintP2Points(payload.points);
      })
      .on("broadcast", { event: "sprint_done" }, ({ payload }: { payload: RebusSessionEvent & { type: "sprint_done" } }) => {
        setStatus("sprint_done");
        setSprintP1Points(payload.p1_points);
        setSprintP2Points(payload.p2_points);
        setActiveSlot(null);
        setMySprintPuzzle(null);
        sounds.roundSolved();
      })
      .on("broadcast", { event: "final_started" }, ({ payload }: { payload: RebusSessionEvent & { type: "final_started" } }) => {
        setStatus("final_live");
        setFinalist(payload.finalist);
        setFinalPuzzle(payload.puzzle);
        setFinalDeadlineMs(payload.deadline_ms);
        finalStartRef.current = payload.deadline_ms - payload.puzzle.time_limit_seconds * 1000;
        setFinalExistingAnswer(null);
        setFinalRevealed(null);
        setFinalTimeExpired(false);
        sounds.sessionStart();
      })
      .on("broadcast", { event: "final_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "final_ended" } }) => {
        setStatus("final_reveal");
        setFinalRevealed({ answer_text: payload.answer_text ?? "", accepted_answers: payload.accepted_answers });
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
        if (payload.finalist_result) {
          setFinalExistingAnswer(payload.finalist_result);
          if (payload.finalist_result.is_correct) sounds.winner();
          else sounds.wrong();
        } else {
          sounds.noAnswer();
        }
      })
      .on("broadcast", { event: "session_ended" }, ({ payload }: { payload: RebusSessionEvent & { type: "session_ended" } }) => {
        setStatus("ended");
        setLeaderboard(payload.leaderboard);
        setTeamLeaderboard(payload.team_leaderboard);
        setSessionCompleted(payload.completed);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Lobby BGM only while genuinely waiting for the host to begin.
  useEffect(() => {
    if (status === "lobby") lobbyMusic.start();
    else lobbyMusic.stop();
    return () => lobbyMusic.stop();
  }, [status]);

  // Correct/wrong sound on reveal, once per puzzle.
  const playedResultForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!revealed || !puzzle) return;
    if (playedResultForRef.current === puzzle.id) return;
    playedResultForRef.current = puzzle.id;
    if (!existingAnswer) {
      sounds.noAnswer();
    } else if (existingAnswer.is_correct) {
      sounds.correct();
    } else {
      sounds.wrong();
    }
  }, [revealed, existingAnswer, puzzle]);

  // Session-end sound + personal winner/loser cue.
  const playedEndSoundRef = useRef(false);
  const latestEndDataRef = useRef({ leaderboard, myId: profile?.id });
  latestEndDataRef.current = { leaderboard, myId: profile?.id };
  useEffect(() => {
    if (status !== "ended" || playedEndSoundRef.current) return;
    playedEndSoundRef.current = true;
    sounds.playSessionEnd(sessionCompleted, () => {
      const { leaderboard: lb, myId } = latestEndDataRef.current;
      const mine = lb.find((e) => e.user_id === myId);
      if (!mine) return;
      if (mine.rank <= 3) sounds.winner();
      else sounds.loser();
    });
  }, [status, sessionCompleted]);

  // Each of these three used to invoke() with no try/catch around it —
  // fine as long as the call resolved with a normal {data, error} pair,
  // but a thrown exception (a dropped connection, an edge function cold
  // start timing out, anything short of a clean HTTP response) went
  // completely unhandled: no setSubmitError, no state change of any kind,
  // just a silent rejection while the TypedAnswerBox above sat locked and
  // the reveal timer kept counting down. Found via a live playtest,
  // 2026-08-28 — a member's submit visibly "stuck" until they reloaded.
  // TypedAnswerBox itself now unlocks on any outcome (see that file), but
  // these still need to actually surface the failure rather than swallow
  // it.
  async function handleSubmitAnswer(text: string) {
    if (!puzzle || !sessionId) return;
    setSubmitError(null);
    const responseMs = Math.max(0, Date.now() - puzzleStartRef.current);
    try {
      const { data, error } = await supabase.functions.invoke("rebus-play", {
        body: { action: "submit_answer", session_id: sessionId, puzzle_id: puzzle.id, answer_text: text, response_ms: responseMs },
      });
      if (error || data?.error) {
        setSubmitError(data?.error ?? "Couldn't submit your answer. It may be too late.");
        return;
      }
      setExistingAnswer({ answer_text: text, is_correct: data.is_correct, points_awarded: data.points_awarded });
    } catch (err) {
      console.error("submit_answer failed", err);
      setSubmitError("Couldn't reach the server — check your connection and try again.");
    }
  }

  async function handleSubmitFinalAnswer(text: string) {
    if (!finalPuzzle || !sessionId) return;
    setSubmitError(null);
    const responseMs = Math.max(0, Date.now() - finalStartRef.current);
    try {
      const { data, error } = await supabase.functions.invoke("rebus-play", {
        body: { action: "submit_answer", session_id: sessionId, puzzle_id: finalPuzzle.id, answer_text: text, response_ms: responseMs },
      });
      if (error || data?.error) {
        setSubmitError(data?.error ?? "Couldn't submit your answer. It may be too late.");
        return;
      }
      setFinalExistingAnswer({ answer_text: text, is_correct: data.is_correct, points_awarded: data.points_awarded });
    } catch (err) {
      console.error("submit_answer (final) failed", err);
      setSubmitError("Couldn't reach the server — check your connection and try again.");
    }
  }

  async function handleSubmitSprintAnswer(text: string) {
    if (!sessionId) return;
    try {
      const { data, error } = await supabase.functions.invoke("rebus-play", {
        body: { action: "submit_sprint_answer", session_id: sessionId, answer_text: text },
      });
      if (error || data?.error) {
        setSprintFlash(null);
        return;
      }
      if (data.done) {
        setMySprintPuzzle(null);
        return;
      }
      setSprintFlash({ is_correct: data.is_correct, points_awarded: data.points_awarded });
      if (data.is_correct) sounds.correct();
      else sounds.wrong();
      setMySprintPuzzle(data.next_puzzle ?? null);
      setMyAttempted((a) => a + 1);
    } catch (err) {
      console.error("submit_sprint_answer failed", err);
      setSprintFlash(null);
    }
  }

  const myTeamId = leaderboard.find((e) => e.user_id === profile?.id)?.team_id ?? null;

  if (status === "loading") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (status === "lobby") {
    return (
      <div className="center-screen">
        <div className="card container--narrow text-center">
          <div style={{ fontSize: "2.5rem" }}>🍿</div>
          <h1>Get comfy!</h1>
          <p className="text-muted">Waiting for the host to start…</p>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="center-screen">
        <div className="card container--narrow">
          <h1 className="text-center">🎉 Final Results</h1>
          {gameMode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} highlightTeamId={myTeamId} />}
          <div style={{ marginTop: gameMode === "team" ? "20px" : 0 }}>
            <Leaderboard entries={leaderboard} highlightUserId={profile?.id} />
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: "20px" }} onClick={() => navigate("/")}>
            Back to games
          </button>
        </div>
      </div>
    );
  }

  if (status === "round_ended") {
    return (
      <div className="center-screen">
        <div className="card container--narrow">
          <h2 className="text-center">✅ Rounds 1-3 complete!</h2>
          {gameMode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} highlightTeamId={myTeamId} />}
          <div style={{ marginTop: gameMode === "team" ? "20px" : 0 }}>
            <Leaderboard entries={leaderboard} highlightUserId={profile?.id} />
          </div>
          <p className="text-muted text-center" style={{ marginTop: "16px" }}>
            Waiting for the host to set up the Sprint Round…
          </p>
        </div>
      </div>
    );
  }

  if (status === "sprint_setup" || status === "sprint_p1" || status === "sprint_p2" || status === "sprint_done") {
    return (
      <div className="center-screen">
        <div className="card container--narrow">
          <h2 className="text-center">⚡ Sprint Round</h2>
          <p className="text-muted text-center">Two players, 30 seconds each, as many puzzles as they can solve.</p>

          <div className="row-between" style={{ marginTop: "12px" }}>
            <div className="text-center" style={{ flex: 1 }}>
              <strong>{sprintPlayer1?.username ?? "Player 1"}</strong>
              <p style={{ fontSize: "1.4rem", fontWeight: 800, margin: "4px 0" }}>{sprintP1Points}</p>
              {activeSlot === 1 && <span className="badge badge-live">🔴 Sprinting</span>}
            </div>
            <div className="text-center" style={{ flex: 1 }}>
              <strong>{sprintPlayer2?.username ?? "Player 2"}</strong>
              <p style={{ fontSize: "1.4rem", fontWeight: 800, margin: "4px 0" }}>{sprintP2Points}</p>
              {activeSlot === 2 && <span className="badge badge-live">🔴 Sprinting</span>}
            </div>
          </div>

          {mySlot && mySlot === activeSlot ? (
            <div style={{ marginTop: "20px" }}>
              {sprintDeadlineMs && !sprintExpired && <Timer deadline={sprintDeadlineMs} onExpire={() => setSprintExpired(true)} />}
              {mySprintPuzzle && !sprintExpired ? (
                <>
                  <div className="rebus-puzzle-display" style={{ fontSize: "1.6rem", padding: "20px 12px" }}>
                    {mySprintPuzzle.display_text}
                  </div>
                  <TypedAnswerBox key={myAttempted} onSubmit={handleSubmitSprintAnswer} placeholder="Type your answer…" />
                  {sprintFlash && (
                    <p
                      className="text-center"
                      style={{ marginTop: "8px", fontWeight: 700, color: sprintFlash.is_correct ? "var(--color-success)" : "var(--color-danger)" }}
                    >
                      {sprintFlash.is_correct ? `✅ Correct! +${sprintFlash.points_awarded}` : "❌ Not quite"}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-center text-muted" style={{ marginTop: "12px" }}>
                  {sprintExpired ? "⏰ Time's up! Great sprint." : "You've cleared the whole pool — nice work!"}
                </p>
              )}
            </div>
          ) : (
            <div style={{ marginTop: "20px" }}>
              {status === "sprint_setup" && <p className="text-center text-muted">Waiting for the host to start Player 1…</p>}
              {(status === "sprint_p1" || status === "sprint_p2") && (
                <>
                  {sprintDeadlineMs && <Timer deadline={sprintDeadlineMs} />}
                  <p className="text-center text-muted" style={{ marginTop: "8px" }}>
                    {activeSlot === 1 ? sprintPlayer1?.username : sprintPlayer2?.username} is sprinting…
                  </p>
                </>
              )}
              {status === "sprint_done" && <p className="text-center text-muted">Sprint complete — waiting for the host to move to the Final Round…</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "final_live" || status === "final_reveal") {
    const isFinalist = profile?.id === finalist?.user_id;
    return (
      <div className="center-screen">
        <div className="card container--narrow">
          <h2 className="text-center">🎇 Final Round — The Big Puzzle</h2>
          <p className="text-center text-muted">
            <strong>{finalist?.username}</strong> is going for {finalPuzzle?.points ?? 1000} points!
          </p>

          {finalPuzzle && (
            <div className="rebus-puzzle-display">{finalPuzzle.display_text}</div>
          )}

          {status === "final_live" && !finalTimeExpired && finalDeadlineMs && (
            <Timer deadline={finalDeadlineMs} onExpire={() => setFinalTimeExpired(true)} />
          )}

          {status === "final_live" && isFinalist && !finalTimeExpired && !finalExistingAnswer && (
            <div style={{ marginTop: "16px" }}>
              <TypedAnswerBox onSubmit={handleSubmitFinalAnswer} placeholder="Type your answer…" />
              {submitError && <p className="error-text text-center">{submitError}</p>}
            </div>
          )}

          {status === "final_live" && isFinalist && finalExistingAnswer && (
            <p className="text-center text-muted" style={{ marginTop: "12px" }}>Answer locked in! Waiting for the reveal…</p>
          )}

          {status === "final_live" && !isFinalist && (
            <p className="text-center text-muted" style={{ marginTop: "12px" }}>
              {finalTimeExpired ? "Time's up — waiting for the host…" : "Watching live — good luck!"}
            </p>
          )}

          {status === "final_reveal" && finalRevealed && (
            <div className="stack" style={{ marginTop: "16px" }}>
              {finalExistingAnswer ? (
                <p className="text-center" style={{ fontWeight: 700, color: finalExistingAnswer.is_correct ? "var(--color-success)" : "var(--color-danger)" }}>
                  {finalExistingAnswer.is_correct ? `✅ Nailed it! +${finalExistingAnswer.points_awarded} pts` : "❌ So close!"}
                </p>
              ) : (
                <p className="text-center text-muted" style={{ fontWeight: 700 }}>⌛ No answer in time.</p>
              )}
              <p className="text-muted text-center">
                The answer was: <strong>{finalRevealed.answer_text}</strong>
              </p>
              <h3 className="text-center" style={{ marginTop: "8px" }}>Final Standings</h3>
              {gameMode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} highlightTeamId={myTeamId} />}
              <div style={{ marginTop: gameMode === "team" ? "12px" : 0 }}>
                <Leaderboard entries={leaderboard} highlightUserId={profile?.id} />
              </div>
              <p className="text-muted text-center">Waiting for the host to end the session…</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // status === "live" | "reveal" — rounds 1-3
  if (!puzzle) return null;

  return (
    <div className="center-screen">
      <div className="card container--narrow">
        <div className="row-between">
          <span className="badge badge-neutral">
            Puzzle {puzzle.order_index + 1} / {puzzle.total_puzzles}
          </span>
          <span className="badge badge-live">🔴 Live</span>
        </div>

        <div className="rebus-puzzle-display">{puzzle.display_text}</div>

        {mode === "hard" && (
          <p className="text-center hint" style={{ marginBottom: "8px" }}>
            ✅ +{puzzle.points + 300} · ❌ −{puzzle.penalty_points} · ⌛ −{Math.round(puzzle.points * 0.25)}
          </p>
        )}

        {!revealed && deadlineMs && <Timer deadline={deadlineMs} onExpire={() => setTimeExpired(true)} />}

        {!revealed && (
          <div style={{ marginTop: "16px" }}>
            {existingAnswer ? (
              <p className="text-muted text-center">Answer locked in! Waiting for the reveal…</p>
            ) : timeExpired ? (
              <p className="text-muted text-center">⏰ Time's up! Waiting for the host…</p>
            ) : (
              <TypedAnswerBox key={puzzle.id} onSubmit={handleSubmitAnswer} placeholder="Type what you see…" />
            )}
            {submitError && <p className="error-text text-center">{submitError}</p>}
          </div>
        )}

        {revealed && (
          <div className="stack" style={{ marginTop: "16px" }}>
            {!existingAnswer && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-text-muted)" }}>
                ⌛ You didn't answer in time.
              </p>
            )}
            {existingAnswer?.is_correct === true && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-success)" }}>
                ✅ Correct! +{existingAnswer.points_awarded} pts
              </p>
            )}
            {existingAnswer?.is_correct === false && (
              <p className="text-center" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                ❌ Not quite — that wasn't it.
                {mode === "hard" && <> {existingAnswer.points_awarded} pts</>}
              </p>
            )}

            <p className="text-muted text-center">
              The answer was: <strong>{revealed.answer_text}</strong>
            </p>

            <h3 className="text-center" style={{ marginTop: "8px" }}>Standings</h3>
            {gameMode === "team" && teamLeaderboard && <RebusTeamLeaderboard entries={teamLeaderboard} highlightTeamId={myTeamId} />}
            <div style={{ marginTop: gameMode === "team" ? "12px" : 0 }}>
              <Leaderboard entries={leaderboard} highlightUserId={profile?.id} />
            </div>
            <p className="text-muted text-center">Waiting for the host to continue…</p>
          </div>
        )}
      </div>
    </div>
  );
}
