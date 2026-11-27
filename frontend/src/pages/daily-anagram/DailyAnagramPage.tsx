import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import DailyAnagramRulesModal from "../../components/DailyAnagramRulesModal";
import { useDailyAnagram } from "../../lib/useDailyAnagram";

// Letter Shuffle (the daily anagram): one long scrambled word a day, four minutes from Start. The server
// holds the word, the clock, the grading and the reward; this page only shows what it is told. The time is
// shown as a number and a bar (no animation) and read out to screen readers only at a few points. The
// "Shuffle tiles" button only reorders the tiles on this screen. Placeholder look: plain tiles, no final art.

function rewardLine(xp: number, deskbits: number) {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} Buddy XP`);
  if (deskbits > 0) parts.push(`+${deskbits} deskbits`);
  return parts.join(" · ");
}

function clock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function seconds(ms: number) {
  return (ms / 1000).toFixed(1);
}

export default function DailyAnagramPage() {
  const { state, error, busy, deadline, start, guess, reload } = useDailyAnagram();
  const [showRules, setShowRules] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const resultRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const status = state?.status;
  const running = status === "in_progress";
  const limit = state?.time_limit_seconds ?? 240;
  const scrambled = state?.scrambled ?? "";

  // Tile order on screen: the scramble as given, until the member shuffles the tiles.
  useEffect(() => {
    setOrder(Array.from({ length: scrambled.length }, (_, i) => i));
  }, [scrambled]);

  const shuffleTiles = () =>
    setOrder((o) => {
      const a = [...o];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);

  const secondsLeft = running && deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  // When the time is up, ask the server to settle it (it allows a couple of seconds for the network).
  const settled = useRef(false);
  useEffect(() => {
    if (!running) { settled.current = false; return; }
    if (secondsLeft === 0 && !settled.current) {
      settled.current = true;
      const t = window.setTimeout(() => void reload(), 2600);
      return () => window.clearTimeout(t);
    }
  }, [running, secondsLeft, reload]);

  useEffect(() => {
    if (running) inputRef.current?.focus();
  }, [running]);

  useEffect(() => {
    if (status === "solved" || status === "unsolved") resultRef.current?.focus();
  }, [status]);

  const submit = async () => {
    const g = text.trim().toLowerCase();
    if (!running || busy || secondsLeft === 0 || !g) return;
    const outcome = await guess(g);
    if (outcome === "wrong") setMessage("Not that one. Keep going.");
    else if (outcome === "wrong_letters") setMessage("Those aren't the same letters as the tiles.");
    else if (outcome === "closed") setMessage("A new day has started. Here is today's word.");
    else if (outcome === "ok") setMessage("");
    if (outcome !== "ok") { setText(""); inputRef.current?.focus(); }
  };

  const srTime = secondsLeft === 120 || secondsLeft === 60 || secondsLeft === 30 || secondsLeft === 10 ? `${secondsLeft} seconds left` : "";
  const finished = status === "solved" || status === "unsolved";
  const reward = state?.reward && state.reward.statuses.includes("granted") ? rewardLine(state.reward.xp, state.reward.deskbits) : "";
  const tiles = useMemo(() => order.map((i) => scrambled[i] ?? ""), [order, scrambled]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dp-page" id="daily-anagram">
        <Link to="/games" className="page-back">‹ Back to Reality Break</Link>
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Letter Shuffle</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>Unscramble today's word. New word at midnight, Manila time.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRules(true)}>❓ Rules</button>
        </div>

        {error && <p className="hint" role="alert" style={{ margin: 0 }}>{error}</p>}
        {!state && !error && <p className="text-muted" role="status">Loading today's word…</p>}

        {status === "no_word" && (
          <div className="dt-card"><p style={{ margin: 0 }}>There's no word for today yet. Check back soon.</p></div>
        )}

        {status === "not_started" && (
          <div className="dt-card">
            <h2 className="t-h2" style={{ margin: 0 }}>Ready for today's word?</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              It has {state?.letter_count} letters. You'll have {clock(limit)} from the moment you press Start, and the clock keeps going if you leave the page.
            </p>
            <div className="dt-actions">
              <button type="button" className="dt-btn dt-btn--primary" onClick={() => void start()} disabled={busy}>Start</button>
            </div>
          </div>
        )}

        {running && state && (
          <div className="dt-card">
            <div className="row-between" style={{ gap: "var(--space-3)" }}>
              <span className="dt-label">TODAY'S WORD · {state.letter_count} LETTERS</span>
              <strong aria-hidden="true" style={{ fontVariantNumeric: "tabular-nums" }}>{clock(secondsLeft)}</strong>
            </div>
            <div className="dtr-bar" aria-hidden="true">
              <div className="dtr-bar__fill" style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / limit) * 100))}%` }} />
            </div>
            <p className="dtr-sr" role="status" aria-live="polite">{srTime}</p>

            <div className="ls-tiles" role="img" aria-label={`Letters: ${tiles.join(", ")}`}>
              {tiles.map((c, i) => <span key={i} className="dp-tile" aria-hidden="true">{c.toUpperCase()}</span>)}
            </div>
            <div className="dt-actions">
              <button type="button" className="dt-btn" onClick={shuffleTiles}>Shuffle tiles</button>
            </div>

            <div className="field">
              <label htmlFor="ls-answer">Your answer</label>
              <input id="ls-answer" ref={inputRef} type="text" value={text} maxLength={20} autoComplete="off" autoCapitalize="off" spellCheck={false}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                disabled={busy || secondsLeft === 0} />
            </div>
            <p className="text-muted t-body-sm" role="status" aria-live="polite" style={{ margin: 0, minHeight: "1.5em" }}>
              {message || (state.guess_count ? `${state.guess_count} ${state.guess_count === 1 ? "guess" : "guesses"} so far` : "")}
            </p>
            <div className="dt-actions">
              <button type="button" className="dt-btn dt-btn--primary" onClick={() => void submit()} disabled={busy || secondsLeft === 0 || !text.trim()}>Submit</button>
            </div>
            {secondsLeft === 0 && <p className="text-muted" role="status" style={{ margin: 0 }}>Time's up. Checking…</p>}
          </div>
        )}

        {finished && state && (
          <div className="dt-card" ref={resultRef} tabIndex={-1} aria-live="polite">
            <h2 className="t-h2" style={{ margin: 0 }}>{status === "solved" ? "Solved!" : "Time's up"}</h2>
            <p style={{ margin: 0 }}>Today's word was <strong>{(state.answer ?? "").toUpperCase()}</strong>.</p>
            {status === "solved" && state.solve_ms != null && (
              <p className="text-muted" style={{ margin: 0 }}>
                You solved it in {seconds(state.solve_ms)} seconds{state.guess_count ? ` with ${state.guess_count} ${state.guess_count === 1 ? "guess" : "guesses"}` : ""}.
              </p>
            )}
            {reward && <p className="dt-notice" style={{ margin: 0 }}>{reward}</p>}
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>A new word arrives at midnight, Manila time.</p>
          </div>
        )}
      </main>
      {showRules && <DailyAnagramRulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
