import { useEffect, useRef, useState, type ReactNode } from "react";
import AppHeader from "../components/AppHeader";
import TrophyIcon from "../components/TrophyIcon";
import { useBuddyBoards, type BoardRow } from "../lib/useBuddyBoards";

// Buddy Boards (Debbie Buddy Boards design, 26-28 Nov 2026). Layout follows the design: five tabs,
// the Overall card (top ten in two columns, your place pinned under it), Your places, The month so far,
// Last month's podium and Your records. Only the Overall board has a data source today. Every other board
// and card shows an honest "not live yet" state, never sample numbers. Placing rewards are not built.

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
      {r.rank <= 3 ? <span className="bbd-trophy"><TrophyIcon place={r.rank as 1 | 2 | 3} size={32} /></span> : <span className="bbd-trophy" aria-hidden="true" />}
      <span className="bbd-rank">{ordinal(r.rank)}</span>
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

type TabId = "overall" | "games" | "brain" | "habits" | "community";

const TABS: { id: TabId; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "games", label: "Games" },
  { id: "brain", label: "Brain Breaks" },
  { id: "habits", label: "Focus and habits" },
  { id: "community", label: "Community" },
];

type Soon = { title: string; sub: string; tag: string };

// Boards that are designed but have no data source yet. They are listed so the page has its final
// shape; none of them shows a name or a number.
const SOON: Record<Exclude<TabId, "overall">, { heading: string; sub: string; boards: Soon[] }> = {
  games: {
    heading: "Games",
    sub: "One board per game. Season points, reset each month.",
    boards: ["UNO", "Family Feud", "Trivia Night", "Impostor WHO?", "Wheel of Fortune", "Type What You See"].map((t) => ({
      title: t,
      sub: "Season points. Playing counts, wins count more.",
      tag: "Monthly",
    })),
  },
  brain: {
    heading: "Brain Breaks",
    sub: "Fastest solve today. Resets at midnight Manila time.",
    boards: [
      { title: "Five Tiles", sub: "Fewest tries first, then fastest.", tag: "Today" },
      { title: "Minute Quiz", sub: "Fastest correct answer.", tag: "Today" },
      { title: "Letter Shuffle", sub: "Fastest solve.", tag: "Today" },
      { title: "Number Nook", sub: "Fastest solve. Same level for everyone.", tag: "Today" },
      { title: "Word Hunt", sub: "Fastest solve.", tag: "Today" },
    ],
  },
  habits: {
    heading: "Focus and habits",
    sub: "Showing up, not racing.",
    boards: [
      { title: "Focus days", sub: "Days with a finished Focus Block.", tag: "Monthly" },
      { title: "Daily streaks", sub: "Check-in days in a row, right now.", tag: "Right now" },
      { title: "Quests finished", sub: "Side quests completed.", tag: "Monthly" },
      { title: "Stamps collected", sub: "Stamps in the passport. Never resets.", tag: "All time" },
    ],
  },
  community: {
    heading: "Community",
    sub: "Kindness and company.",
    boards: [
      { title: "Stickies left", sub: "Desk Stickies left on other desks.", tag: "Monthly" },
      { title: "Games played", sub: "Rounds finished, win or lose.", tag: "Monthly" },
      { title: "Buddies collected", sub: "Buddies in the collection. Never resets.", tag: "All time" },
      { title: "Shared in the feed", sub: "Posts shared in the community feed.", tag: "Monthly" },
      { title: "Reacts given", sub: "Reactions given on community posts.", tag: "Monthly" },
      { title: "Events joined", sub: "Community events joined.", tag: "Monthly" },
    ],
  },
};

function CardHead({ id, title, sub, tag, big }: { id: string; title: string; sub: string; tag: string; big?: boolean }) {
  return (
    <div className="bbd-card-head">
      <div style={{ minWidth: 0 }}>
        <h3 id={id} className={"bbd-h" + (big ? " bbd-h--big" : "")}>{title}</h3>
        <p className="text-muted t-body-sm" style={{ margin: "3px 0 0" }}>{sub}</p>
      </div>
      <span className="bbd-tag">{tag}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="bbd-empty text-muted t-body" style={{ margin: 0 }}>{children}</p>;
}

function SoonBoard({ id, b }: { id: string; b: Soon }) {
  return (
    <section className="card bbd-card" aria-labelledby={id}>
      <CardHead id={id} title={b.title} sub={b.sub} tag={b.tag} />
      <Empty>Not live yet. This board fills in once it is switched on.</Empty>
    </section>
  );
}

export default function BuddyBoardsPage() {
  const { period, setPeriod, board, error, saving, setVisible, reload } = useBuddyBoards();
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState<TabId>("overall");
  const visBtn = useRef<HTMLButtonElement>(null);

  const closeDialog = () => {
    setDialog(false);
    visBtn.current?.focus();
  };

  const rows = board?.rows ?? [];
  const mine = rows.find((r) => r.is_you);
  const label = board ? monthLabel(board.month_start) : period === "this" ? "This month" : "Last month";
  const place = mine ?? board?.you ?? null;
  const soon = tab === "overall" ? null : SOON[tab];

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page bbd-page" id="buddy-boards">
        <div className="bbd-head">
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Buddy Boards</h1>
            <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>How the month is going across games, focus and the community.</p>
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
              Board visibility: {board?.hidden ? "Hidden" : "Shown"}
            </button>
          </div>
        </div>

        <div role="group" aria-label="Board category" className="bbd-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={"set-chip" + (tab === t.id ? " set-chip--on" : "")} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {soon ? (
          <>
            <div>
              <h2 className="t-h2" style={{ margin: 0 }}>{soon.heading}</h2>
              <p className="text-muted t-body" style={{ margin: "2px 0 0" }}>{soon.sub}</p>
            </div>
            <div className="bbd-boards">
              {soon.boards.map((b) => <SoonBoard key={b.title} id={`bbd-${tab}-${b.title.replace(/\W+/g, "-")}`} b={b} />)}
            </div>
          </>
        ) : error && !board ? (
          <section className="card">
            <p role="alert" className="t-body" style={{ margin: 0 }}>The boards didn’t load.</p>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => void reload()}>Try again</button>
          </section>
        ) : !board ? (
          <section className="card" aria-busy="true"><p className="text-muted t-body" style={{ margin: 0 }}>Loading the boards…</p></section>
        ) : (
          <>
            <div className="bbd-grid">
              <section className="card bbd-card" aria-labelledby="bbd-overall">
                <CardHead id="bbd-overall" title="Overall" sub={`Buddy XP earned in ${label}.`} tag={label} big />
                {rows.length === 0 ? (
                  <Empty>{period === "this" ? "Nobody has earned Buddy XP yet this month. Earn some to be the first." : "No results for that month."}</Empty>
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
                    <div aria-hidden="true" className="text-muted" style={{ textAlign: "center" }}>· · ·</div>
                    <div className="bbd-row bbd-row--you">
                      <span className="bbd-trophy" aria-hidden="true" />
                      <span className="bbd-rank">{ordinal(board.you.rank)}</span>
                      <span className="bbd-name">You</span>
                      <span className="bbd-value">{fmt(board.you.value)} XP</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="card bbd-card bbd-card--alt" aria-labelledby="bbd-yours">
                <div>
                  <h3 id="bbd-yours" className="bbd-h bbd-h--big">Your places</h3>
                  <p className="text-muted t-body-sm" style={{ margin: "3px 0 0" }}>Where you stand in {label}. Only you see this card.</p>
                </div>
                {board.hidden ? (
                  <Empty>You are hidden from the boards. Nobody sees your name or results here. Your progress, rewards and records carry on as normal.</Empty>
                ) : place ? (
                  <ul className="bbd-places">
                    <li><span>Overall</span><b>{ordinal(place.rank)}</b></li>
                  </ul>
                ) : (
                  <Empty>Your places show up here once you have earned Buddy XP in {label}.</Empty>
                )}
              </section>
            </div>

            <div className="bbd-trio">
              <section className="card bbd-card" aria-labelledby="bbd-month">
                <CardHead id="bbd-month" title="The month so far" sub="Everyone together. No ranks." tag={label} />
                <Empty>Community totals are not live yet.</Empty>
              </section>
              <section className="card bbd-card" aria-labelledby="bbd-podium">
                <CardHead id="bbd-podium" title="Last month’s podium" sub="Top three on each board, 1st to 3rd." tag="Last month" />
                <Empty>No finished seasons yet. The first podium appears after a month closes. Placing rewards are not switched on yet.</Empty>
              </section>
              <section className="card bbd-card bbd-card--alt" aria-labelledby="bbd-records">
                <CardHead id="bbd-records" title="Your records" sub="Only you see this card. Never resets." tag="All time" />
                <Empty>Your bests are not live yet.</Empty>
              </section>
            </div>
          </>
        )}
      </main>
      {dialog && board && <VisibilityDialog hidden={board.hidden} saving={saving} onSet={setVisible} onClose={closeDialog} />}
    </div>
  );
}
