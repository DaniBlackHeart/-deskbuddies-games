import { useEffect, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useBuddyBoards, type BoardRow } from "../lib/useBuddyBoards";

// Buddy Boards (Debbie Buddy Boards design, 26-27 Nov 2026). First version: the Overall board only.
// Top ten by Buddy XP earned in the month, your own place pinned under the list when you are lower,
// a This month / Last month switch and a Board visibility popup. The other tabs, The month so far,
// Last month's podium, Your records and every placing reward are not built yet.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthLabel(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function ordinal(n: number) {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 < 4 ? n % 10 : 0]}`;
}

const fmt = (n: number) => n.toLocaleString("en-US");

function Face({ name, avatar }: { name: string; avatar: string | null }) {
  return avatar ? (
    <img className="bbd-face" src={avatar} alt="" width={32} height={32} referrerPolicy="no-referrer" />
  ) : (
    <span className="bbd-face bbd-face--initial" aria-hidden="true">{(name.trim()[0] ?? "?").toUpperCase()}</span>
  );
}

function Row({ r }: { r: BoardRow }) {
  return (
    <li className={"bbd-row" + (r.is_you ? " bbd-row--you" : "")}>
      <span className="bbd-rank">{r.rank}</span>
      <Face name={r.name} avatar={r.avatar_url} />
      <span className="bbd-name">
        {r.name}
        {r.is_you && <span className="badge badge-neutral bbd-you">You</span>}
      </span>
      <span className="bbd-value">{fmt(r.value)} XP</span>
    </li>
  );
}

function VisibilityDialog({ hidden, saving, onSet, onClose }: { hidden: boolean; saving: boolean; onSet: (visible: boolean) => Promise<boolean>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Modal behaviour: focus moves in, Tab stays inside, Escape closes.
  useEffect(() => {
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = !hidden;
  return (
    <div className="bbd-backdrop" onClick={onClose} role="presentation">
      <div className="card bbd-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="bbd-vis-h" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2 id="bbd-vis-h" className="t-h2" style={{ margin: 0 }}>Board visibility</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="t-body">Everyone appears on the boards by default. Turn this off and your name and results are left out of every board. Everyone below you moves up.</p>
        <p className="t-body text-muted">Your progress, rewards and records carry on as normal. Hiding never pauses earning. Members who are hidden are also left out of any placing rewards.</p>
        <button
          type="button"
          className={"set-chip" + (visible ? " set-chip--on" : "")}
          aria-pressed={visible}
          disabled={saving}
          onClick={async () => setFailed(!(await onSet(!visible)))}
        >
          {visible ? "Showing me on the boards" : "Hidden from the boards"}
        </button>
        {failed && <p role="alert" className="text-muted t-body-sm">That didn’t save. Please try again.</p>}
      </div>
    </div>
  );
}

export default function BuddyBoardsPage() {
  const { period, setPeriod, board, error, saving, setVisible, reload } = useBuddyBoards();
  const [dialog, setDialog] = useState(false);
  const visBtn = useRef<HTMLButtonElement>(null);

  const closeDialog = () => {
    setDialog(false);
    visBtn.current?.focus();
  };

  const rows = board?.rows ?? [];
  const mine = rows.find((r) => r.is_you);
  const label = board ? monthLabel(board.month_start) : period === "this" ? "This month" : "Last month";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page bbd-page" id="buddy-boards">
        <div className="bbd-head">
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Buddy Boards</h1>
            <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>How the month is going across the community.</p>
          </div>
          <div className="bbd-controls">
            <div role="group" aria-label="Period" className="set-row">
              {(["this", "last"] as const).map((p) => (
                <button key={p} type="button" className={"set-chip" + (period === p ? " set-chip--on" : "")} aria-pressed={period === p} onClick={() => setPeriod(p)}>
                  {p === "this" ? "This month" : "Last month"}
                </button>
              ))}
            </div>
            <button ref={visBtn} type="button" className="set-chip" aria-haspopup="dialog" disabled={!board} onClick={() => setDialog(true)}>
              {board?.hidden ? "Hidden from boards" : "Board visibility"}
            </button>
          </div>
        </div>

        {error && !board ? (
          <section className="card">
            <p role="alert" className="t-body" style={{ margin: 0 }}>The boards didn’t load.</p>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => void reload()}>Try again</button>
          </section>
        ) : !board ? (
          <section className="card" aria-busy="true"><p className="text-muted t-body" style={{ margin: 0 }}>Loading the boards…</p></section>
        ) : (
          <div className="bbd-grid">
            <section className="card bbd-card" aria-labelledby="bbd-overall">
              <div className="row-between">
                <div>
                  <h2 id="bbd-overall" className="t-h2" style={{ margin: 0 }}>Overall</h2>
                  <p className="text-muted t-body-sm" style={{ margin: "2px 0 0" }}>Buddy XP earned in {label}.</p>
                </div>
                <span className="badge badge-neutral">{label}</span>
              </div>
              {rows.length === 0 ? (
                <p className="text-muted t-body" style={{ margin: 0 }}>
                  {period === "this" ? "Nobody has earned Buddy XP yet this month. The board fills in as the month gets going." : "No results for that month."}
                </p>
              ) : (
                <div className="bbd-cols">
                  <ol className="bbd-list" aria-label={`Places ${rows[0].rank} to ${rows[Math.min(4, rows.length - 1)].rank}`}>
                    {rows.slice(0, 5).map((r, i) => <Row key={i} r={r} />)}
                  </ol>
                  {rows.length > 5 && (
                    <ol className="bbd-list" aria-label={`Places ${rows[5].rank} to ${rows[rows.length - 1].rank}`}>
                      {rows.slice(5).map((r, i) => <Row key={i} r={r} />)}
                    </ol>
                  )}
                </div>
              )}
              {board.you && (
                <div className="bbd-pinned">
                  <div aria-hidden="true" className="text-muted">· · ·</div>
                  <div className="bbd-row bbd-row--you">
                    <span className="bbd-rank">{board.you.rank}</span>
                    <span className="bbd-name">You<span className="sr-only"> are in {ordinal(board.you.rank)} place</span></span>
                    <span className="bbd-value">{fmt(board.you.value)} XP</span>
                  </div>
                </div>
              )}
            </section>

            <section className="card bbd-card" aria-labelledby="bbd-yours">
              <div>
                <h2 id="bbd-yours" className="t-h2" style={{ margin: 0 }}>Your places</h2>
                <p className="text-muted t-body-sm" style={{ margin: "2px 0 0" }}>Where you stand in {label}. Only you see this card.</p>
              </div>
              {board.hidden ? (
                <p className="t-body" style={{ margin: 0 }}>You are hidden from the boards. Nobody sees your name or results here. Your progress, rewards and records carry on as normal.</p>
              ) : mine || board.you ? (
                <ul className="bbd-places">
                  <li><span>Overall</span><b>{ordinal((mine ?? board.you)!.rank)}</b></li>
                </ul>
              ) : (
                <p className="text-muted t-body" style={{ margin: 0 }}>Your places show up here once you have earned Buddy XP in {label}.</p>
              )}
            </section>
          </div>
        )}
      </main>
      {dialog && board && <VisibilityDialog hidden={board.hidden} saving={saving} onSet={setVisible} onClose={closeDialog} />}
    </div>
  );
}
