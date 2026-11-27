import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import DailyWordSearchRulesModal from "../../components/DailyWordSearchRulesModal";
import { levelName } from "../../lib/dailyLevel";
import { useDailyWordSearch } from "../../lib/useDailyWordSearch";

// Word Hunt (the daily word search): a 10x10 grid with 8 hidden words, five minutes from Start. The server
// holds the grid, the word positions, the checking, the clock and the reward; this page only shows what it is
// told. Pick a word by choosing its first letter, then its last letter (works with a tap, a click or the
// keyboard). Time is shown as a number and a bar (no animation) and read out only at a few points.
// Placeholder look: plain cells, no final art.

const N = 10;

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

function cellsBetween(a: number, b: number): number[] {
  const dr = Math.sign(Math.floor(b / N) - Math.floor(a / N));
  const dc = Math.sign((b % N) - (a % N));
  const len = Math.max(Math.abs(Math.floor(b / N) - Math.floor(a / N)), Math.abs((b % N) - (a % N)));
  return Array.from({ length: len + 1 }, (_, i) => a + i * (dr * N + dc));
}

export default function DailyWordSearchPage() {
  const { state, error, busy, deadline, start, find, giveUp, reload } = useDailyWordSearch();
  const [showRules, setShowRules] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focusCell, setFocusCell] = useState(0);
  const [message, setMessage] = useState("");
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const resultRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const status = state?.status;
  const running = status === "in_progress";
  const finished = status === "solved" || status === "unsolved";
  const limit = state?.time_limit_seconds ?? 300;
  const grid = state?.grid ?? "";
  const words = state?.words ?? [];
  const found = useMemo(() => state?.found ?? [], [state?.found]);

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
    if (finished) resultRef.current?.focus();
  }, [finished]);

  useEffect(() => {
    setAnchor(null);
    setConfirmGiveUp(false);
  }, [state?.search_date, running]);

  const foundCells = useMemo(() => {
    const m = new Map<number, number>();
    for (const f of found) for (const c of cellsBetween(f.start, f.end)) m.set(c, f.i);
    return m;
  }, [found]);

  const pick = async (cell: number) => {
    if (!running || busy || secondsLeft === 0) return;
    if (anchor === null) { setAnchor(cell); setMessage("First letter marked. Now pick the last letter."); return; }
    if (anchor === cell) { setAnchor(null); setMessage(""); return; }
    const a = anchor;
    setAnchor(null);
    const outcome = await find(a, cell);
    if (outcome === "found") setMessage("Found one!");
    else if (outcome === "miss") setMessage("That's not one of the words. Try again.");
    else if (outcome === "already") setMessage("You already found that one.");
    else if (outcome === "closed") setMessage("A new day has started. Here is today's grid.");
    else if (outcome === "time_up") setMessage("Time's up.");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = focusCell;
    if (e.key === "ArrowRight") next = focusCell % N < N - 1 ? focusCell + 1 : focusCell;
    else if (e.key === "ArrowLeft") next = focusCell % N > 0 ? focusCell - 1 : focusCell;
    else if (e.key === "ArrowDown") next = focusCell + N < N * N ? focusCell + N : focusCell;
    else if (e.key === "ArrowUp") next = focusCell - N >= 0 ? focusCell - N : focusCell;
    else if (e.key === "Escape") { setAnchor(null); setMessage(""); return; }
    else return;
    e.preventDefault();
    setFocusCell(next);
    cellRefs.current[next]?.focus();
  };

  const srTime = secondsLeft === 240 || secondsLeft === 120 || secondsLeft === 60 || secondsLeft === 30 || secondsLeft === 10 ? `${secondsLeft} seconds left` : "";
  const reward = state?.reward && state.reward.statuses.includes("granted") ? rewardLine(state.reward.xp, state.reward.deskbits) : "";
  const foundIdx = new Set(found.map((f) => f.i));
  const placements = state?.placements ?? [];

  const renderGrid = (marks: Map<number, "found" | "missed">, locked: boolean) => (
    <div className="ws-grid" role="group" aria-label="Word search grid" onKeyDown={locked ? undefined : onKeyDown}>
      {Array.from({ length: N * N }, (_, i) => {
        const mark = marks.get(i);
        const cls = ["ws-cell", mark === "found" ? "ws-cell--found" : "", mark === "missed" ? "ws-cell--missed" : "", anchor === i ? "ws-cell--anchor" : ""].filter(Boolean).join(" ");
        return (
          <button
            key={i}
            type="button"
            ref={(el) => { cellRefs.current[i] = el; }}
            className={cls}
            tabIndex={locked ? -1 : focusCell === i ? 0 : -1}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, ${grid[i]}${mark === "found" ? ", in a found word" : mark === "missed" ? ", in a missed word" : ""}${anchor === i ? ", first letter marked" : ""}`}
            onClick={() => { setFocusCell(i); if (!locked) void pick(i); }}
            disabled={locked}
          >
            {grid[i]}
          </button>
        );
      })}
    </div>
  );

  const liveMarks = new Map<number, "found" | "missed">();
  for (const c of foundCells.keys()) liveMarks.set(c, "found");

  const endMarks = new Map<number, "found" | "missed">();
  for (const p of placements) for (const c of cellsBetween(p.start, p.end)) {
    if (p.found) endMarks.set(c, "found");
    else if (!endMarks.has(c)) endMarks.set(c, "missed");
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dp-page" id="daily-word-search">
        <Link to="/games" className="page-back">‹ Back to Reality Break</Link>
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Word Hunt</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>Find today's hidden words. New grid at midnight, Manila time.</p>
            {state?.difficulty && <p className="t-body-sm" style={{ margin: "4px 0 0" }}><strong>Today's level: {levelName(state.difficulty)}</strong></p>}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRules(true)}>❓ Rules</button>
        </div>

        {error && <p className="hint" role="alert" style={{ margin: 0 }}>{error}</p>}
        {!state && !error && <p className="text-muted" role="status">Loading today's grid…</p>}

        {status === "no_puzzle" && (
          <div className="dt-card"><p style={{ margin: 0 }}>There's no grid for today yet. Check back soon.</p></div>
        )}

        {status === "not_started" && (
          <div className="dt-card">
            <h2 className="t-h2" style={{ margin: 0 }}>Ready for today's grid?</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              Find 8 hidden words in a 10×10 grid. You'll have {clock(limit)} from the moment you press Start, and the clock keeps going if you leave the page.
            </p>
            <div className="dt-actions">
              <button type="button" className="dt-btn dt-btn--primary" onClick={() => void start()} disabled={busy}>Start</button>
            </div>
          </div>
        )}

        {running && state && (
          <div className="dt-card">
            <div className="row-between" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
              <span className="dt-label">FOUND {found.length} OF {words.length}</span>
              <strong aria-hidden="true" style={{ fontVariantNumeric: "tabular-nums" }}>{clock(secondsLeft)}</strong>
            </div>
            <div className="dtr-bar" aria-hidden="true">
              <div className="dtr-bar__fill" style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / limit) * 100))}%` }} />
            </div>
            <p className="dtr-sr" role="status" aria-live="polite">{srTime}</p>

            {renderGrid(liveMarks, false)}

            <p className="text-muted t-body-sm" role="status" aria-live="polite" style={{ margin: 0, minHeight: "1.5em" }}>
              {message || "Pick a word's first letter, then its last letter."}
            </p>

            <ul className="ws-words" aria-label="Words to find">
              {words.map((w, idx) => {
                const done = foundIdx.has(idx + 1);
                return <li key={w} className={done ? "ws-word ws-word--done" : "ws-word"}>{w}{done && <span className="dtr-sr"> (found)</span>}{done && <span aria-hidden="true"> ✓</span>}</li>;
              })}
            </ul>

            <div className="dt-actions">
              {anchor !== null && <button type="button" className="dt-btn" onClick={() => { setAnchor(null); setMessage(""); }}>Cancel pick</button>}
              {!confirmGiveUp && <button type="button" className="dt-btn" onClick={() => setConfirmGiveUp(true)}>Give up</button>}
            </div>
            {confirmGiveUp && (
              <div role="alertdialog" aria-label="Confirm give up" className="sk-confirm">
                <p style={{ margin: 0 }}>Give up today's grid? It ends as unsolved, and you can't play it again today.</p>
                <div className="dt-actions">
                  <button type="button" className="dt-btn" onClick={() => setConfirmGiveUp(false)} autoFocus>Keep playing</button>
                  <button type="button" className="dt-btn dt-btn--primary" onClick={() => void giveUp()} disabled={busy}>Yes, give up</button>
                </div>
              </div>
            )}
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>Keyboard: arrow keys move, Enter or Space picks a letter, Escape cancels a pick.</p>
            {secondsLeft === 0 && <p className="text-muted" role="status" style={{ margin: 0 }}>Time's up. Checking…</p>}
          </div>
        )}

        {finished && state && (
          <div className="dt-card" ref={resultRef} tabIndex={-1} aria-live="polite">
            <h2 className="t-h2" style={{ margin: 0 }}>
              {status === "solved" ? "All found!" : state.end_reason === "gave_up" ? "You gave up" : "Time's up"}
            </h2>
            {status === "solved" && state.solve_ms != null ? (
              <p style={{ margin: 0 }}>You found all {placements.length || 8} words in <strong>{clock(Math.floor(state.solve_ms / 1000))}</strong>.</p>
            ) : (
              <p className="text-muted" style={{ margin: 0 }}>You found {state.found_count ?? 0} of {placements.length || 8}. The words you missed are marked below.</p>
            )}
            {renderGrid(endMarks, true)}
            <ul className="ws-words" aria-label="Words">
              {placements.map((p) => (
                <li key={p.i} className={p.found ? "ws-word ws-word--done" : "ws-word ws-word--missed"}>
                  {p.word} <span>{p.found ? "(found)" : "(missed)"}</span>
                </li>
              ))}
            </ul>
            {reward && <p className="dt-notice" style={{ margin: 0 }}>{reward}</p>}
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>A new grid arrives at midnight, Manila time.</p>
          </div>
        )}
      </main>
      {showRules && <DailyWordSearchRulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
