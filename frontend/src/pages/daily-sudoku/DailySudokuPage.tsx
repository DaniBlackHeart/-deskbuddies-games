import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import DailySudokuRulesModal from "../../components/DailySudokuRulesModal";
import { useDailySudoku } from "../../lib/useDailySudoku";

// Number Nook (the daily sudoku): one grid a day, five mistakes allowed (the 5th ends it), ranked later by
// fastest solve. The server holds the grid, checks every number, keeps the clock and pays the reward; this
// page only shows what it is told. Pencil notes are kept here on screen only. Placeholder look: plain
// cells, no final art. The timer is a plain number (no animation) and the mistake count is written out.

function rewardLine(xp: number, deskbits: number) {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} Buddy XP`);
  if (deskbits > 0) parts.push(`+${deskbits} deskbits`);
  return parts.join(" · ");
}

function clock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 && m < 10 ? `0${m}` : `${m}`;
  return `${h > 0 ? `${h}:` : ""}${mm}:${s < 10 ? "0" : ""}${s}`;
}

const label = (cell: number, given: boolean, value: string) => {
  const r = Math.floor(cell / 9) + 1;
  const c = (cell % 9) + 1;
  return `Row ${r}, column ${c}, ${value !== "0" ? `${value}${given ? ", given" : ""}` : "empty"}`;
};

export default function DailySudokuPage() {
  const { state, error, busy, startedAt, start, place, giveUp } = useDailySudoku();
  const [showRules, setShowRules] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [notesOn, setNotesOn] = useState(false);
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [message, setMessage] = useState("");
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const resultRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const status = state?.status;
  const running = status === "in_progress";
  const finished = status === "solved" || status === "unsolved";
  const puzzle = state?.puzzle ?? "";
  const board = state?.board ?? "";
  const solution = state?.solution ?? "";
  const mistakes = state?.mistakes ?? 0;
  const max = state?.max_mistakes ?? 5;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (finished) resultRef.current?.focus();
  }, [finished]);

  // New day or new attempt: clear the notes and selection.
  useEffect(() => {
    setNotes({});
    setSelected(null);
    setConfirmGiveUp(false);
  }, [state?.sudoku_date, running]);

  const elapsed = running && startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  const focusCell = (i: number) => {
    setSelected(i);
    cellRefs.current[i]?.focus();
  };

  const clearNotesFor = (cell: number, digit: number) => {
    // A correct number in a cell removes that digit from the notes in its row, column and box.
    const r = Math.floor(cell / 9);
    const c = cell % 9;
    setNotes((prev) => {
      const next: Record<number, number[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        const sameUnit =
          Math.floor(idx / 9) === r || idx % 9 === c ||
          (Math.floor(Math.floor(idx / 9) / 3) === Math.floor(r / 3) && Math.floor((idx % 9) / 3) === Math.floor(c / 3));
        const list = idx === cell ? [] : sameUnit ? v.filter((d) => d !== digit) : v;
        if (list.length) next[idx] = list;
      }
      return next;
    });
  };

  const enter = async (digit: number) => {
    if (!running || busy || selected === null) return;
    if (puzzle[selected] !== "0") { setMessage("That's one of the starting numbers."); return; }
    if (board[selected] !== "0") { setMessage("That cell already has its number."); return; }
    if (notesOn) {
      setNotes((prev) => {
        const cur = prev[selected] ?? [];
        const list = cur.includes(digit) ? cur.filter((d) => d !== digit) : [...cur, digit].sort();
        const next = { ...prev };
        if (list.length) next[selected] = list; else delete next[selected];
        return next;
      });
      return;
    }
    const cell = selected;
    const outcome = await place(cell, digit);
    if (outcome === "ok") { setMessage(""); clearNotesFor(cell, digit); }
    else if (outcome === "wrong") setMessage(`${digit} doesn't go there. That's a mistake.`);
    else if (outcome === "closed") setMessage("A new day has started. Here is today's grid.");
    else if (outcome === "filled" || outcome === "given") setMessage("That cell is already filled.");
  };

  const eraseNotes = () => {
    if (!running || selected === null) return;
    setNotes((prev) => { const n = { ...prev }; delete n[selected]; return n; });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key >= "1" && e.key <= "9") { e.preventDefault(); void enter(Number(e.key)); return; }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); eraseNotes(); return; }
    if (e.key === "n" || e.key === "N") { e.preventDefault(); setNotesOn((v) => !v); return; }
    const cur = selected ?? 0;
    let next = cur;
    if (e.key === "ArrowRight") next = cur % 9 < 8 ? cur + 1 : cur;
    else if (e.key === "ArrowLeft") next = cur % 9 > 0 ? cur - 1 : cur;
    else if (e.key === "ArrowDown") next = cur + 9 <= 80 ? cur + 9 : cur;
    else if (e.key === "ArrowUp") next = cur - 9 >= 0 ? cur - 9 : cur;
    else return;
    e.preventDefault();
    focusCell(next);
  };

  const reward = state?.reward && state.reward.statuses.includes("granted") ? rewardLine(state.reward.xp, state.reward.deskbits) : "";
  const selectedDigit = selected !== null && board[selected] && board[selected] !== "0" ? board[selected] : "";

  const renderGrid = (cells: string, locked: boolean) => (
    <div className="sk-grid" role="group" aria-label="Sudoku grid" onKeyDown={locked ? undefined : onKeyDown}>
      {Array.from({ length: 81 }, (_, i) => {
        const v = cells[i] ?? "0";
        const given = puzzle[i] !== "0";
        const wrongSolved = locked && solution && v === "0";
        const shown = v !== "0" ? v : wrongSolved ? solution[i] : "";
        const cellNotes = !locked ? notes[i] : undefined;
        const r = Math.floor(i / 9);
        const c = i % 9;
        const cls = [
          "sk-cell",
          given ? "sk-cell--given" : v !== "0" ? "sk-cell--filled" : "",
          wrongSolved ? "sk-cell--revealed" : "",
          selected === i && !locked ? "sk-cell--selected" : "",
          selectedDigit && v === selectedDigit && !locked ? "sk-cell--same" : "",
          c % 3 === 2 && c !== 8 ? "sk-cell--rbox" : "",
          r % 3 === 2 && r !== 8 ? "sk-cell--bbox" : "",
        ].filter(Boolean).join(" ");
        return (
          <button
            key={i}
            type="button"
            ref={(el) => { cellRefs.current[i] = el; }}
            className={cls}
            tabIndex={locked ? -1 : (selected ?? 0) === i ? 0 : -1}
            aria-label={label(i, given, shown || "0") + (cellNotes?.length ? `, notes ${cellNotes.join(" ")}` : "")}
            onClick={() => !locked && setSelected(i)}
            disabled={locked}
          >
            {shown ? <span>{shown}</span> : cellNotes?.length ? <span className="sk-notes" aria-hidden="true">{cellNotes.join("")}</span> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dp-page" id="daily-sudoku">
        <Link to="/games" className="page-back">‹ Back to Reality Break</Link>
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Number Nook</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>Today's sudoku. New grid at midnight, Manila time.</p>
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
              There's no time limit, but your time counts. The clock starts when you press Start and keeps going if you leave the page. You can make {max - 1} mistakes; the {max}th ends the game.
            </p>
            <div className="dt-actions">
              <button type="button" className="dt-btn dt-btn--primary" onClick={() => void start()} disabled={busy}>Start</button>
            </div>
          </div>
        )}

        {running && state && (
          <div className="dt-card">
            <div className="row-between" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
              <span className="dt-label">TIME <strong style={{ fontVariantNumeric: "tabular-nums" }}>{clock(elapsed)}</strong></span>
              <span className="dt-label" role="status" aria-live="polite">MISTAKES {mistakes} OF {max}</span>
            </div>

            {renderGrid(board, false)}

            <p className="text-muted t-body-sm" role="status" aria-live="polite" style={{ margin: 0, minHeight: "1.5em" }}>
              {message || (selected === null ? "Pick a cell, then a number." : "")}
            </p>

            <div className="sk-pad" role="group" aria-label="Number pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} type="button" className="dp-key" onClick={() => void enter(d)} disabled={busy || selected === null}>{d}</button>
              ))}
            </div>
            <div className="dt-actions">
              <button type="button" className={`dt-btn${notesOn ? " dt-btn--primary" : ""}`} aria-pressed={notesOn} onClick={() => setNotesOn((v) => !v)}>
                Notes {notesOn ? "on" : "off"}
              </button>
              <button type="button" className="dt-btn" onClick={eraseNotes} disabled={selected === null}>Clear notes</button>
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
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>Keyboard: arrow keys move, 1 to 9 enter a number, N toggles notes, Backspace clears notes. Notes aren't saved.</p>
          </div>
        )}

        {finished && state && (
          <div className="dt-card" ref={resultRef} tabIndex={-1} aria-live="polite">
            <h2 className="t-h2" style={{ margin: 0 }}>
              {status === "solved" ? "Solved!" : state.end_reason === "gave_up" ? "You gave up" : "Out of mistakes"}
            </h2>
            {status === "solved" && state.solve_ms != null && (
              <p style={{ margin: 0 }}>
                You solved it in <strong>{clock(Math.floor(state.solve_ms / 1000))}</strong> with {mistakes} {mistakes === 1 ? "mistake" : "mistakes"}.
              </p>
            )}
            {status === "unsolved" && <p className="text-muted" style={{ margin: 0 }}>Here's the finished grid (revealed numbers are marked).</p>}
            {renderGrid(board, true)}
            {reward && <p className="dt-notice" style={{ margin: 0 }}>{reward}</p>}
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>A new grid arrives at midnight, Manila time.</p>
          </div>
        )}
      </main>
      {showRules && <DailySudokuRulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
