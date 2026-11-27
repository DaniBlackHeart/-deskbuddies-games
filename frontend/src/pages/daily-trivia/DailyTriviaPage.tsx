import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import DailyTriviaRulesModal from "../../components/DailyTriviaRulesModal";
import { useDailyTrivia } from "../../lib/useDailyTrivia";

// Daily Trivia: one question a day, one minute from Start. The server holds the question, the
// clock, the grading and the reward; this page only shows what it is told. The time left is
// shown as a number and a bar (no animation), and read out to screen readers only at a few
// points, not every second. Placeholder look: plain cards, no final art.

function rewardLine(xp: number, deskbits: number) {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} Buddy XP`);
  if (deskbits > 0) parts.push(`+${deskbits} deskbits`);
  return parts.join(" · ");
}

const RESULT_TITLE = { correct: "Correct!", incorrect: "Not this time", timed_out: "Time's up" } as const;

export default function DailyTriviaPage() {
  const { state, error, busy, deadline, start, answerChoice, answerText, reload } = useDailyTrivia();
  const [showRules, setShowRules] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const resultRef = useRef<HTMLDivElement>(null);
  const status = state?.status;
  const running = status === "in_progress";
  const limit = state?.time_limit_seconds ?? 60;

  // Tick once a second while the clock is running.
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);

  const secondsLeft = running && deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  // When the minute is up, ask the server to settle it (it allows a couple of seconds for the network).
  const settled = useRef(false);
  useEffect(() => {
    if (!running) { settled.current = false; return; }
    if (secondsLeft === 0 && !settled.current) {
      settled.current = true;
      const t = window.setTimeout(() => void reload(), 2600);
      return () => window.clearTimeout(t);
    }
  }, [running, secondsLeft, reload]);

  // New question state: reset the inputs.
  useEffect(() => {
    setPicked(null);
    setText("");
  }, [state?.trivia_date, status]);

  useEffect(() => {
    if (status === "correct" || status === "incorrect" || status === "timed_out") resultRef.current?.focus();
  }, [status]);

  const submit = () => {
    if (!running || busy || secondsLeft === 0) return;
    if (state?.type === "multiple_choice") {
      if (picked !== null) void answerChoice(picked);
    } else if (text.trim()) void answerText(text.trim());
  };

  // Screen readers hear the time at 30 and 10 seconds, not every tick.
  const srTime = secondsLeft === 30 || secondsLeft === 10 ? `${secondsLeft} seconds left` : "";

  const finished = status === "correct" || status === "incorrect" || status === "timed_out";
  const reward = state?.reward && state.reward.statuses.includes("granted") ? rewardLine(state.reward.xp, state.reward.deskbits) : "";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dp-page" id="daily-trivia">
        <Link to="/games" className="page-back">‹ Back to Reality Break</Link>
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Daily Trivia</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>One question a day. One minute to answer.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRules(true)}>❓ Rules</button>
        </div>

        {error && <p className="hint" role="alert" style={{ margin: 0 }}>{error}</p>}
        {!state && !error && <p className="text-muted" role="status">Loading today's question…</p>}

        {status === "no_question" && (
          <div className="dt-card">
            <p style={{ margin: 0 }}>There's no trivia question for today yet. Check back soon.</p>
          </div>
        )}

        {status === "not_started" && (
          <div className="dt-card">
            <h2 className="t-h2" style={{ margin: 0 }}>Ready for today's question?</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              You'll have {limit} seconds from the moment you press Start. The clock keeps going if you leave the page.
              {state?.type === "typed" ? " Today's answer is typed." : " Today's question is multiple choice."}
            </p>
            <div className="dt-actions">
              <button type="button" className="dt-btn dt-btn--primary" onClick={() => void start()} disabled={busy}>Start</button>
            </div>
          </div>
        )}

        {running && state && (
          <div className="dt-card">
            <div className="row-between" style={{ gap: "var(--space-3)" }}>
              <span className="dt-label">{state.category ? state.category.toUpperCase() : "TODAY'S QUESTION"}</span>
              <strong aria-hidden="true" style={{ fontVariantNumeric: "tabular-nums" }}>{secondsLeft}s</strong>
            </div>
            <div className="dtr-bar" aria-hidden="true">
              <div className="dtr-bar__fill" style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / limit) * 100))}%` }} />
            </div>
            <p className="dtr-sr" role="status" aria-live="polite">{srTime}</p>
            <h2 className="t-h2" style={{ margin: 0 }}>{state.prompt}</h2>

            {state.type === "multiple_choice" ? (
              <div className="dtr-choices" role="group" aria-label="Choices">
                {(state.choices ?? []).map((c, i) => (
                  <button key={i} type="button" className={`dtr-choice${picked === i ? " dtr-choice--on" : ""}`} aria-pressed={picked === i}
                    onClick={() => setPicked(i)} disabled={busy || secondsLeft === 0}>
                    <span className="dtr-choice__letter" aria-hidden="true">{"ABCDEF"[i]}</span> {c}
                  </button>
                ))}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="dtr-answer">Your answer</label>
                <input id="dtr-answer" type="text" value={text} maxLength={200} autoComplete="off" autoCapitalize="off" spellCheck={false}
                  onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  disabled={busy || secondsLeft === 0} />
              </div>
            )}

            <div className="dt-actions">
              <button type="button" className="dt-btn dt-btn--primary" onClick={submit}
                disabled={busy || secondsLeft === 0 || (state.type === "multiple_choice" ? picked === null : !text.trim())}>
                Lock in answer
              </button>
            </div>
            {secondsLeft === 0 && <p className="text-muted" role="status" style={{ margin: 0 }}>Time's up. Checking…</p>}
          </div>
        )}

        {finished && state && (
          <div className="dt-card" ref={resultRef} tabIndex={-1} aria-live="polite">
            <h2 className="t-h2" style={{ margin: 0 }}>{RESULT_TITLE[status as keyof typeof RESULT_TITLE]}</h2>
            <p style={{ margin: 0 }}>{state.prompt}</p>
            {state.type === "multiple_choice" && state.your_choice != null && state.choices && (
              <p className="text-muted" style={{ margin: 0 }}>Your answer: {state.choices[state.your_choice]}</p>
            )}
            {state.type === "typed" && state.your_answer && (
              <p className="text-muted" style={{ margin: 0 }}>Your answer: {state.your_answer}</p>
            )}
            {status === "timed_out" && <p className="text-muted" style={{ margin: 0 }}>You didn't answer in time.</p>}
            <p style={{ margin: 0 }}>The answer was <strong>{state.correct_answer}</strong>.</p>
            {reward && <p className="dt-notice" style={{ margin: 0 }}>{reward}</p>}
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>A new question arrives at midnight, Manila time.</p>
          </div>
        )}
      </main>
      {showRules && <DailyTriviaRulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
