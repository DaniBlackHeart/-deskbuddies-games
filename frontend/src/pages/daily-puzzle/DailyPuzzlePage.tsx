import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import DailyPuzzleRulesModal from "../../components/DailyPuzzleRulesModal";
import { useDailyPuzzle, type GuessRow } from "../../lib/useDailyPuzzle";

// Daily Puzzle: guess today's five-letter word in six tries. The server holds the word,
// the day and the marks; this page only shows what it is told. Marks use a symbol as
// well as a colour (✓ right spot, ↔ elsewhere, ✕ not in the word) so colour is never
// the only signal. Placeholder look: plain tiles, no final art.

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MARK_WORD: Record<string, string> = { c: "right spot", p: "in the word, different spot", a: "not in the word" };
const MARK_SYMBOL: Record<string, string> = { c: "✓", p: "↔", a: "✕" };

// Best known mark per letter, for colouring the on-screen keyboard.
function keyMarks(rows: GuessRow[]): Record<string, string> {
  const rank: Record<string, number> = { a: 1, p: 2, c: 3 };
  const out: Record<string, string> = {};
  for (const r of rows) {
    for (let i = 0; i < 5; i++) {
      const ch = r.guess[i];
      const m = r.marks[i];
      if (!out[ch] || rank[m] > rank[out[ch]]) out[ch] = m;
    }
  }
  return out;
}

function rewardLine(xp: number, deskbits: number) {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} Buddy XP`);
  if (deskbits > 0) parts.push(`+${deskbits} deskbits`);
  return parts.join(" · ");
}

export default function DailyPuzzlePage() {
  const { state, error, busy, submit } = useDailyPuzzle();
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const over = state?.status === "solved" || state?.status === "unsolved";
  const guesses = state?.guesses ?? [];
  const max = state?.max_guesses ?? 6;

  const send = useCallback(async () => {
    if (!state || over || busy) return;
    if (current.length < 5) {
      setMessage("Not enough letters.");
      setShake(true);
      return;
    }
    const outcome = await submit(current);
    if (outcome === "ok") {
      setCurrent("");
      setMessage("");
    } else if (outcome === "not_a_word") {
      setMessage("That's not in our word list. It didn't use a guess.");
      setShake(true);
    } else if (outcome === "closed") {
      setCurrent("");
      setMessage("A new day has started. Here is today's puzzle.");
    } else if (outcome === "finished") {
      setCurrent("");
    }
  }, [state, over, busy, current, submit]);

  const press = useCallback(
    (key: string) => {
      if (!state || over || busy) return;
      setMessage("");
      if (key === "enter") void send();
      else if (key === "back") setCurrent((c) => c.slice(0, -1));
      else if (/^[a-z]$/.test(key)) setCurrent((c) => (c.length < 5 ? c + key : c));
    },
    [state, over, busy, send]
  );

  // Physical keyboard. Ignored while the Rules modal is open or when a modifier is held.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showRules || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "A") && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Enter") { e.preventDefault(); press("enter"); }
      else if (e.key === "Backspace") press("back");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, showRules]);

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(false), 450);
    return () => window.clearTimeout(t);
  }, [shake]);

  useEffect(() => {
    if (over) resultRef.current?.focus();
  }, [over]);

  // Spoiler-free summary: marks only, no letters. (A Discord share is a later addition.)
  const summary = () => {
    const sym = { c: "🟩", p: "🟨", a: "⬛" } as Record<string, string>;
    const head = `Debbie Daily Puzzle ${state?.puzzle_date} ${state?.status === "solved" ? guesses.length : "X"}/${max}`;
    return [head, ...guesses.map((g) => [...g.marks].map((m) => sym[m]).join(""))].join("\n");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Couldn't copy. Select and copy the result by hand.");
    }
  };

  const keys = keyMarks(guesses);
  const rows = Array.from({ length: max }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r].guess, marks: guesses[r].marks, kind: "done" as const };
    if (r === guesses.length && !over) return { letters: current.padEnd(5, " "), marks: "", kind: "active" as const };
    return { letters: "     ", marks: "", kind: "empty" as const };
  });

  const reward = state?.reward && state.reward.statuses.includes("granted") ? rewardLine(state.reward.xp, state.reward.deskbits) : "";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dp-page" id="daily-puzzle">
        <Link to="/games" className="page-back">‹ Back to Reality Break</Link>
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Daily Puzzle</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>
              Guess today's five-letter word in six tries.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRules(true)}>❓ Rules</button>
        </div>

        {error && <p className="hint" role="alert" style={{ margin: 0 }}>{error}</p>}
        {!state && !error && <p className="text-muted" role="status">Loading today's puzzle…</p>}

        {state && (
          <div className="dp-board-wrap">
            <div className={`dp-board${shake ? " dp-board--shake" : ""}`} role="group" aria-label="Guesses">
              {rows.map((row, r) => (
                <div key={r} className="dp-row" role="group"
                  aria-label={row.kind === "done" ? `Guess ${r + 1}: ${row.letters.split("").map((ch, i) => `${ch}, ${MARK_WORD[row.marks[i]]}`).join("; ")}` : `Guess ${r + 1}`}>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const ch = row.letters[i]?.trim() ?? "";
                    const m = row.marks[i];
                    return (
                      <span key={i} className={`dp-tile${m ? ` dp-tile--${m}` : ch ? " dp-tile--typed" : ""}`} aria-hidden={row.kind === "done" ? true : undefined}>
                        {ch.toUpperCase()}
                        {m && <span className="dp-tile__mark" aria-hidden="true">{MARK_SYMBOL[m]}</span>}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="dp-message t-body-sm" role="status" aria-live="polite">
              {message || (!over ? `Guess ${Math.min(guesses.length + 1, max)} of ${max}` : "")}
            </p>

            {over ? (
              <div className="dt-card" ref={resultRef} tabIndex={-1} aria-live="polite">
                <h2 className="t-h2" style={{ margin: 0 }}>
                  {state.status === "solved" ? `Solved in ${guesses.length}!` : "Not this time"}
                </h2>
                <p style={{ margin: 0 }}>
                  Today's word was <strong>{(state.answer ?? "").toUpperCase()}</strong>.
                </p>
                {reward && <p className="dt-notice" style={{ margin: 0 }}>{reward}</p>}
                <p className="text-muted t-body-sm" style={{ margin: 0 }}>A new word arrives at midnight, Manila time.</p>
                <div className="dt-actions">
                  <button type="button" className="dt-btn" onClick={copy}>{copied ? "Copied!" : "Copy my result"}</button>
                  <Link to="/games" className="dt-btn" style={{ textAlign: "center", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Back to Reality Break</Link>
                </div>
              </div>
            ) : (
              <div className="dp-keyboard" role="group" aria-label="Keyboard">
                {KEY_ROWS.map((row, ri) => (
                  <div key={ri} className="dp-keys">
                    {ri === 2 && <button type="button" className="dp-key dp-key--wide" onClick={() => press("enter")} disabled={busy}>Enter</button>}
                    {[...row].map((k) => (
                      <button key={k} type="button" className={`dp-key${keys[k] ? ` dp-key--${keys[k]}` : ""}`} onClick={() => press(k)} disabled={busy}
                        aria-label={keys[k] ? `${k}, ${MARK_WORD[keys[k]]}` : k}>
                        {k.toUpperCase()}
                      </button>
                    ))}
                    {ri === 2 && <button type="button" className="dp-key dp-key--wide" onClick={() => press("back")} disabled={busy} aria-label="Delete">⌫</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      {showRules && <DailyPuzzleRulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
