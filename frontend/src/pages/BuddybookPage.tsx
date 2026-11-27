import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BuddySprite from "../components/BuddySprite";
import { useAuth } from "../contexts/AuthContext";
import PixelIcon from "../components/PixelIcon";
import { BOOK_ART } from "../lib/bookArt";
import { STAMP_ART } from "../lib/stampArt";
import { inkFor } from "../lib/questInk";
import { useBuddybook, type BuddyEntry, type BuddybookData, type KeepsakeEntry, type QuestMark, type Stamp } from "../lib/useBuddybook";

// Buddybook: your private, read-only record. Follows the "Debbie Buddybook" design
// and brief: a flip book you open with the tabs, the page corners or the buttons,
// and a plain list as the fallback (the default on phones). It is calm on purpose:
// no progress bars, no to-do items, no "x of y". Only what you have earned is
// counted. Visitors never see it; they only see the Brag Shelf on your desk.
//
// Everything comes from the buddybook Edge Function. "New" means earned in the last 7 days and not
// yet looked at; what you have looked at is remembered on this device only. Not built yet: entry
// detail popups. Art and some wording (stamp hints, keepsake step lines) are placeholders.

const SPREADS = 6; // 0 closed, 1 contents, 2 firsts, 3 side quests, 4 buddy collection, 5 buddy collection + keepsakes
const STATE_LABEL = ["Closed book", "Cover and contents", "Firsts", "Side Quests", "Buddy Collection", "Buddy Collection and Keepsakes"];
const TABS: { label: string; spread: number; tone: string; art: string }[] = [
  { label: "Contents", spread: 1, tone: "contents", art: "contents" },
  { label: "Firsts", spread: 2, tone: "firsts", art: "firsts" },
  { label: "Side Quests", spread: 3, tone: "sidequests", art: "sidequests" },
  { label: "Buddy Collection", spread: 4, tone: "collection", art: "collection" },
  { label: "Keepsakes", spread: 5, tone: "keepsakes", art: "keepsakes" },
];
const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold" } as const;
const BUDDIES_PER_PAGE = 6;
const FIRSTS_LEFT = 4; // stamps on the left page; the rest go on the right
const QUESTS_LEFT = 4;
const WEEK = 7 * 24 * 3600 * 1000;
// Page numbers printed in the contents (they match the pages of the book).
const PAGE_OF = { firsts: 2, quests: 4, buddies: 6, keeps: 9 } as const;
// What a blank stamp asks for, in plain words (placeholder wording).
const STAMP_TODO: Record<string, string> = {
  stamp_first_hello: "Check in for the first time",
  stamp_first_block: "Finish a first Focus Block",
  stamp_first_brain_break: "Finish your first Five Tiles",
  stamp_first_detour: "Try a first Daily Detour",
  stamp_first_game: "Finish a first live game",
  stamp_first_win: "Finish a first Weekly Win",
  stamp_made_it_mine: "Save a first desk customisation",
};
// What a keepsake step says it was for (placeholder wording).
function stepLine(k: KeepsakeEntry): string {
  const n = k.threshold;
  switch (k.key) {
    case "keep_streak": return `Kept a ${n}-day streak`;
    case "keep_seat": return `Checked in on ${n} different days`;
    case "keep_seasons": return `Checked in across ${n} different months`;
    case "keep_welcome_back": return "Came back after 7 or more days away";
    case "keep_focus": return `Finished ${n} Focus Blocks`;
    case "keep_long_haul": return `Finished a Focus Block on ${n} different days`;
    case "keep_brain_break": return `Finished Five Tiles on ${n} different days`;
    case "keep_detour": return `Tried ${n} Daily Detours`;
    case "keep_many_detours": return `Tried ${n} different detour prompts`;
    case "keep_wins": return `Finished a goal in ${n} different weeks`;
    case "keep_full_week": return `Finished 3 or more goals in ${n} weeks`;
    default: return k.name;
  }
}

function BookIcon({ name, size = 32 }: { name: string; size?: number }) {
  const a = BOOK_ART[name];
  if (!a) return null;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${a.grid} ${a.grid}`} shapeRendering="crispEdges" style={{ display: "block", flex: "none" }}>
      {a.layers.map(([fill, d], i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "block", flex: "none", marginTop: 2 }}>
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function shortDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: iso.length === 10 ? "UTC" : "Asia/Manila" });
}
const isRecent = (iso: string | null) => !!iso && Date.now() - new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso).getTime() < WEEK;

/** What you have already looked at, kept on this device only. */
function useSeen(userId: string | undefined) {
  const key = `debbie.book.seen.${userId ?? "anon"}`;
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setSeen(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch { setSeen(new Set()); }
  }, [key]);
  const mark = (ids: string[]) => {
    if (ids.length === 0) return;
    setSeen((prev) => {
      if (ids.every((i) => prev.has(i))) return prev;
      const next = new Set(prev);
      ids.forEach((i) => next.add(i));
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* storage unavailable: fine */ }
      return next;
    });
  };
  return { seen, mark };
}

type NewItem = { id: string; name: string; spread: number };
function newItemsOf(d: BuddybookData, seen: ReadonlySet<string>): NewItem[] {
  const out: NewItem[] = [];
  for (const s of d.firsts) if (s.earned && isRecent(s.earned_on) && !seen.has("stamp:" + s.key)) out.push({ id: "stamp:" + s.key, name: s.name, spread: 2 });
  for (const q of d.quests) if (isRecent(q.done_on) && !seen.has("quest:" + q.key)) out.push({ id: "quest:" + q.key, name: q.name, spread: 3 });
  for (const b of d.buddies) if (b.owned && isRecent(b.found_at) && !seen.has("buddy:" + b.key)) out.push({ id: "buddy:" + b.key, name: b.name ?? "", spread: 4 });
  return out;
}

function StampSprite({ stampKey, locked }: { stampKey: string; locked: boolean }) {
  const art = STAMP_ART[stampKey];
  if (!art) return <span className="bb-stamp__blank" aria-hidden="true" />;
  return (
    <svg aria-hidden="true" width={64} height={64} viewBox="0 0 16 16" shapeRendering="crispEdges" className={"bb-stamp__art" + (locked ? " bb-stamp__art--locked" : "")}>
      {art.map(([fill, d], i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </svg>
  );
}

function NewBadge() {
  return <span className="bb-new" aria-hidden="true">NEW</span>;
}

function StampCard({ s, isNew }: { s: Stamp; isNew: boolean }) {
  return (
    <li className={"bb-card" + (s.earned ? "" : " bb-card--locked") + (isNew ? " bb-card--new" : "")} aria-label={`${s.name}, ${s.earned ? "earned" : "not earned yet"}${isNew ? ", new" : ""}`}>
      {isNew && <NewBadge />}
      <StampSprite stampKey={s.key} locked={!s.earned} />
      <b className="bb-card__name">{s.name}</b>
      <span className="bb-card__line">{s.earned ? s.line : STAMP_TODO[s.key] ?? "A first to try"}</span>
      <span className="bb-card__meta">{s.earned ? `Earned ${shortDay(s.earned_on)}` : "Not earned yet"}</span>
    </li>
  );
}

function QuestInk({ q, isNew }: { q: QuestMark; isNew: boolean }) {
  const ink = inkFor(q.key, q.theme);
  return (
    <li className={"bb-card" + (isNew ? " bb-card--new" : "")} aria-label={`${q.name}, ${q.theme}, earned ${shortDay(q.done_on)}${isNew ? ", new" : ""}`}>
      {isNew && <NewBadge />}
      <svg aria-hidden="true" width={64} height={64} viewBox="0 0 16 16" shapeRendering="crispEdges" style={{ display: "block" }}>
        {ink && <path d={ink[1]} fill={ink[0]} />}
      </svg>
      <b className="bb-card__name">{q.name}</b>
      <span className="bb-card__line">{q.theme}</span>
      <span className="bb-card__meta">Earned {shortDay(q.done_on)}</span>
    </li>
  );
}

function BuddyTile({ b, isNew }: { b: BuddyEntry; isNew: boolean }) {
  return (
    <li className={"bb-card" + (b.owned ? "" : " bb-card--locked") + (isNew ? " bb-card--new" : "")} aria-label={b.owned ? `${b.name}, earned ${shortDay(b.found_at)}${isNew ? ", new" : ""}` : `Not yet found, ${b.hint}${b.limited ? ", limited" : ""}`}>
      <span className="bb-card__art" aria-hidden="true">
        <BuddySprite id={b.key} found={b.owned} size={64} />
        {!b.owned && <span className="bb-card__lock"><LockIcon /></span>}
        {isNew && <NewBadge />}
        {b.limited && <span className="bb-lim">LIMITED</span>}
      </span>
      <b className={"bb-card__name"}>{b.owned ? b.name : "Not yet found"}</b>
      <span className="bb-card__line">{b.owned ? `Earned ${shortDay(b.found_at)}` : b.hint}</span>
    </li>
  );
}

function KeepsakeRow({ k }: { k: KeepsakeEntry }) {
  return (
    <li className="bb-keep">
      <span className={"bb-keep__disc bb-keep__disc--" + k.tier} aria-hidden="true" />
      <span className="bb-keep__body">
        <span className="bb-keep__top"><b>{k.name}</b><span className="bb-keep__chip">{TIER_LABEL[k.tier]}</span></span>
        <span className="bb-keep__line">{stepLine(k)}</span>
        {k.earned_at && <span className="bb-keep__date">Earned {shortDay(k.earned_at)}</span>}
      </span>
      <Link className="bb-keep__see" to="/beyond-the-desk" aria-label={`See progress for ${k.name} on Beyond the Desk`}>See progress →</Link>
    </li>
  );
}

function PageHead({ art, title, sub }: { art: string; title: string; sub: string }) {
  return (
    <div className="bb-pagehead">
      <BookIcon name={art} />
      <div>
        <h2 className="bb-h">{title}</h2>
        <p className="bb-quiet">{sub}</p>
      </div>
    </div>
  );
}

function CardGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <ul className={"bb-cards bb-cards--" + cols}>{children}</ul>;
}

function PrivateNote() {
  return (
    <p className="bb-private">
      <LockIcon /> Only you can see your Buddybook. Visitors see just the Brag Shelf on your desk.
    </p>
  );
}

function Contents({ d, go }: { d: BuddybookData; go?: (spread: number) => void }) {
  const rows = [
    { label: "Firsts", art: "firsts", count: d.counts.stamps, spread: 2, page: PAGE_OF.firsts },
    { label: "Side Quests", art: "sidequests", count: d.counts.quests, spread: 3, page: PAGE_OF.quests },
    { label: "Buddy Collection", art: "collection", count: d.counts.buddies, spread: 4, page: PAGE_OF.buddies },
    { label: "Keepsakes earned", art: "keepsakes", count: d.counts.keepsakes, spread: 5, page: PAGE_OF.keeps },
  ];
  return (
    <ul className="bb-toc">
      {rows.map((r) => {
        const inner = (
          <>
            <BookIcon name={r.art} />
            <span className="bb-toc__label">{r.label}</span>
            <span className="bb-toc__dots" aria-hidden="true" />
            <span className="bb-toc__n">{r.count} earned</span>
            {go && <span className="bb-toc__page" aria-label={`page ${r.page}`}>{r.page}</span>}
          </>
        );
        return (
          <li key={r.label}>
            {go ? (
              <button type="button" className="bb-toc__row" onClick={() => go(r.spread)}>{inner}</button>
            ) : (
              <span className="bb-toc__row">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BeyondNote() {
  return <p className="bb-quiet">Looking for progress or next steps? Those live on <Link to="/beyond-the-desk">Beyond the Desk</Link>.</p>;
}

function Page({ side, visible, children, label }: { side: "left" | "right"; visible: boolean; children: ReactNode; label: string }) {
  return (
    <section className={"bb-page bb-page--" + side} aria-label={label} inert={!visible}>
      {children}
    </section>
  );
}

// Round arrow buttons at the foot of each page, and the page number, as in the design.
// Previous sits on the left page, next on the right. They live on the page face (not
// inside the scrolling page) so they stay put, and they are inert with a hidden face.
function PageNav({ num, onPrev, onNext }: { num?: number; onPrev?: () => void; onNext?: () => void }) {
  return (
    <>
      {num !== undefined && <span className="bb-pageno" aria-label={`Page ${num}`}>{num}</span>}
      {onPrev && (
        <button type="button" className="bb-arrow bb-arrow--prev" aria-label="Previous page" onClick={onPrev}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M13 8H3M7 4L3 8l4 4" /></svg>
        </button>
      )}
      {onNext && (
        <button type="button" className="bb-arrow bb-arrow--next" aria-label="Next page" onClick={onNext}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </button>
      )}
    </>
  );
}

function split(d: BuddybookData) {
  const regular = d.buddies.filter((b) => !b.limited);
  const limited = d.buddies.filter((b) => b.limited);
  const pages: BuddyEntry[][] = [];
  for (let i = 0; i < regular.length; i += BUDDIES_PER_PAGE) pages.push(regular.slice(i, i + BUDDIES_PER_PAGE));
  return { b1: pages[0] ?? [], b2: pages[1] ?? [], b3: pages.slice(2).flat(), limited };
}

function ListView({ d, seen }: { d: BuddybookData; seen: ReadonlySet<string> }) {
  return (
    <div className="bb-list">
      <section aria-labelledby="bbl-contents">
        <h2 className="t-h2" id="bbl-contents">Contents</h2>
        <Contents d={d} />
        <BeyondNote />
      </section>
      <section aria-labelledby="bbl-firsts">
        <h2 className="t-h2" id="bbl-firsts">Firsts</h2>
        {d.firsts.length === 0 ? <p className="bb-quiet">Firsts will appear here as they open up.</p> : (
          <CardGrid>{d.firsts.map((s) => <StampCard key={s.key} s={s} isNew={s.earned && isRecent(s.earned_on) && !seen.has("stamp:" + s.key)} />)}</CardGrid>
        )}
      </section>
      <section aria-labelledby="bbl-quests">
        <h2 className="t-h2" id="bbl-quests">Side Quests</h2>
        {d.quests.length === 0 ? <p className="bb-quiet">No Side Quests inked yet. Marks you earn will be kept here.</p> : (
          <CardGrid>{d.quests.map((q) => <QuestInk key={q.key} q={q} isNew={isRecent(q.done_on) && !seen.has("quest:" + q.key)} />)}</CardGrid>
        )}
      </section>
      <section aria-labelledby="bbl-buddies">
        <h2 className="t-h2" id="bbl-buddies">Buddy Collection</h2>
        <CardGrid cols={3}>{d.buddies.map((b) => <BuddyTile key={b.key} b={b} isNew={b.owned && isRecent(b.found_at) && !seen.has("buddy:" + b.key)} />)}</CardGrid>
      </section>
      <section aria-labelledby="bbl-keeps">
        <h2 className="t-h2" id="bbl-keeps">Keepsakes earned</h2>
        {d.keepsakes.length === 0 ? <p className="bb-quiet">Nothing yet. Keepsakes you earn are kept here.</p> : <ul className="bb-keeps">{d.keepsakes.map((k) => <KeepsakeRow key={k.key} k={k} />)}</ul>}
        <p className="bb-quiet">Progress lives on Beyond the Desk. This page only keeps what you have earned.</p>
      </section>
      <PrivateNote />
    </div>
  );
}

function Book({ d, spread, setSpread, seen }: { d: BuddybookData; spread: number; setSpread: (n: number) => void; seen: ReadonlySet<string> }) {
  const { b1, b2, b3, limited } = split(d);
  const fresh = newItemsOf(d, seen);
  const stampNew = (s: Stamp) => s.earned && isRecent(s.earned_on) && !seen.has("stamp:" + s.key);
  const questNew = (q: QuestMark) => isRecent(q.done_on) && !seen.has("quest:" + q.key);
  const buddyNew = (b: BuddyEntry) => b.owned && isRecent(b.found_at) && !seen.has("buddy:" + b.key);

  const vis = (leaf: number, face: "front" | "back") => (face === "front" ? spread === leaf : spread === leaf + 1);
  const leafCls = (i: number) => "bb-leaf" + (spread > i ? " bb-leaf--turned" : "");
  const z = (i: number) => (spread > i ? i + 1 : SPREADS - i);
  const prev = () => setSpread(Math.max(0, spread - 1));
  const next = () => setSpread(Math.min(SPREADS - 1, spread + 1));
  const counts: { label: string; n: number; art: string }[] = [
    { label: "Stamps", n: d.counts.stamps + d.counts.quests, art: "firsts" },
    { label: "Desk Buddies", n: d.counts.buddies, art: "collection" },
    { label: "Keepsake steps", n: d.counts.keepsakes, art: "keepsakes" },
  ];
  const firstsL = d.firsts.slice(0, FIRSTS_LEFT);
  const firstsR = d.firsts.slice(FIRSTS_LEFT);
  const questsL = d.quests.slice(0, QUESTS_LEFT);
  const questsR = d.quests.slice(QUESTS_LEFT);

  return (
    <div className={"bb-book" + (spread === 0 ? " bb-book--closed" : "")} data-spread={spread}>
      <div className="bb-stage">
        <div className="bb-board bb-board--left" aria-hidden="true" />
        <div className="bb-board bb-board--right" aria-hidden="true" />

        {/* leaf 0: cover / inside cover */}
        <div className={leafCls(0)} style={{ zIndex: z(0) }}>
          <div className="bb-face bb-face--front bb-cover" inert={!vis(0, "front")}>
            <span className="bb-cover__spine" aria-hidden="true" />
            <div className="bb-cover__mid">
              <span className="bb-cover__tile"><PixelIcon name="buddybook" size={64} /></span>
              <div>
                <h2 className="bb-cover__title">Buddybook</h2>
                <p className="bb-cover__sub">A record kept by Debbie</p>
              </div>
            </div>
            <button type="button" className="bb-cover__open" onClick={() => setSpread(1)}>Open the book</button>
          </div>
          <div className="bb-face bb-face--back" inert={!vis(0, "back")}>
            <Page side="left" visible={vis(0, "back")} label="Your Buddybook">
              <div className="bb-intro">
                <span className="bb-intro__tile"><PixelIcon name="buddybook" size={64} /></span>
                <div>
                  <h2 className="bb-h">Your Buddybook</h2>
                  <p className="bb-quiet">A quiet record of what you have done and the companions you have found.</p>
                </div>
              </div>
              <ul className="bb-tally">
                {counts.map((c) => (
                  <li key={c.label}>
                    <BookIcon name={c.art} />
                    <span className="bb-tally__n">{c.n}</span>
                    <span className="bb-quiet">{c.label}</span>
                  </li>
                ))}
              </ul>
              {fresh.length > 0 && (
                <div className="bb-newrow">
                  <span className="bb-newrow__n">{fresh.length} new</span>
                  {fresh.slice(0, 3).map((n) => (
                    <button key={n.id} type="button" className="bb-newrow__link" onClick={() => setSpread(n.spread)}>{n.name}</button>
                  ))}
                </div>
              )}
              <PrivateNote />
            </Page>
            <PageNav onPrev={prev} />
          </div>
        </div>

        {/* leaf 1: contents / firsts, first page */}
        <div className={leafCls(1)} style={{ zIndex: z(1) }}>
          <div className="bb-face bb-face--front" inert={!vis(1, "front")}>
            <Page side="right" visible={vis(1, "front")} label="Contents">
              <div>
                <p className="bb-eyebrow">CONTENTS</p>
                <h2 className="bb-h">Inside this book</h2>
              </div>
              <Contents d={d} go={setSpread} />
              <BeyondNote />
            </Page>
            <PageNav num={1} onNext={next} />
          </div>
          <div className="bb-face bb-face--back" inert={!vis(1, "back")}>
            <Page side="left" visible={vis(1, "back")} label="Firsts">
              <PageHead art="firsts" title="Firsts" sub="Small marks for doing something for the first time." />
              <CardGrid>{firstsL.map((s) => <StampCard key={s.key} s={s} isNew={stampNew(s)} />)}</CardGrid>
            </Page>
            <PageNav num={2} onPrev={prev} />
          </div>
        </div>

        {/* leaf 2: firsts, second page / side quests, first page */}
        <div className={leafCls(2)} style={{ zIndex: z(2) }}>
          <div className="bb-face bb-face--front" inert={!vis(2, "front")}>
            <Page side="right" visible={vis(2, "front")} label="Firsts, continued">
              {firstsR.length > 0 && <CardGrid>{firstsR.map((s) => <StampCard key={s.key} s={s} isNew={stampNew(s)} />)}</CardGrid>}
              <p className="bb-quiet">Blank marks fill in as you go.</p>
            </Page>
            <PageNav num={3} onNext={next} />
          </div>
          <div className="bb-face bb-face--back" inert={!vis(2, "back")}>
            <Page side="left" visible={vis(2, "back")} label="Side Quests">
              <PageHead art="sidequests" title="Side Quests" sub="One ink mark for each side quest you finish." />
              {questsL.length === 0 ? <p className="bb-quiet">No Side Quests inked yet. Marks you earn will be kept here.</p> : <CardGrid>{questsL.map((q) => <QuestInk key={q.key} q={q} isNew={questNew(q)} />)}</CardGrid>}
            </Page>
            <PageNav num={4} onPrev={prev} />
          </div>
        </div>

        {/* leaf 3: side quests, second page / buddy collection, first page */}
        <div className={leafCls(3)} style={{ zIndex: z(3) }}>
          <div className="bb-face bb-face--front" inert={!vis(3, "front")}>
            <Page side="right" visible={vis(3, "front")} label="Side Quests, continued">
              {questsR.length > 0 && <CardGrid>{questsR.map((q) => <QuestInk key={q.key} q={q} isNew={questNew(q)} />)}</CardGrid>}
              <p className="bb-quiet">Only finished side quests show here. One you were dealt but have not finished stays open on <Link to="/beyond-the-desk">Beyond the Desk</Link>.</p>
            </Page>
            <PageNav num={5} onNext={next} />
          </div>
          <div className="bb-face bb-face--back" inert={!vis(3, "back")}>
            <Page side="left" visible={vis(3, "back")} label="Buddy Collection">
              <PageHead art="collection" title="Buddy Collection" sub="Companions that have found your desk." />
              <CardGrid cols={3}>{b1.map((b) => <BuddyTile key={b.key} b={b} isNew={buddyNew(b)} />)}</CardGrid>
            </Page>
            <PageNav num={6} onPrev={prev} />
          </div>
        </div>

        {/* leaf 4: buddies, second page / buddies, last page and the limited one */}
        <div className={leafCls(4)} style={{ zIndex: z(4) }}>
          <div className="bb-face bb-face--front" inert={!vis(4, "front")}>
            <Page side="right" visible={vis(4, "front")} label="Buddy Collection, continued">
              <p className="bb-quiet">Buddy Collection, continued</p>
              <CardGrid cols={3}>{b2.map((b) => <BuddyTile key={b.key} b={b} isNew={buddyNew(b)} />)}</CardGrid>
            </Page>
            <PageNav num={7} onNext={next} />
          </div>
          <div className="bb-face bb-face--back" inert={!vis(4, "back")}>
            <Page side="left" visible={vis(4, "back")} label="Buddy Collection, last page">
              <p className="bb-quiet">Buddy Collection, continued</p>
              <CardGrid cols={3}>{b3.map((b) => <BuddyTile key={b.key} b={b} isNew={buddyNew(b)} />)}</CardGrid>
              {limited.length > 0 && (
                <>
                  <p className="bb-eyebrow">LIMITED</p>
                  <CardGrid cols={3}>{limited.map((b) => <BuddyTile key={b.key} b={b} isNew={buddyNew(b)} />)}</CardGrid>
                </>
              )}
            </Page>
            <PageNav num={8} onPrev={prev} />
          </div>
        </div>

        {/* leaf 5: keepsakes / back cover */}
        <div className={leafCls(5)} style={{ zIndex: z(5) }}>
          <div className="bb-face bb-face--front" inert={!vis(5, "front")}>
            <Page side="right" visible={vis(5, "front")} label="Keepsakes">
              <PageHead art="keepsakes" title="Keepsakes earned" sub="The highest step on each card." />
              {d.keepsakes.length === 0 ? (
                <p className="bb-quiet">Nothing yet. Keepsakes you earn are kept here.</p>
              ) : (
                <ul className="bb-keeps">{d.keepsakes.map((k) => <KeepsakeRow key={k.key} k={k} />)}</ul>
              )}
              <p className="bb-quiet">Progress lives on Beyond the Desk. This page only keeps what you have earned.</p>
              <PrivateNote />
            </Page>
            <PageNav num={9} />
          </div>
          <div className="bb-face bb-face--back bb-backcover" aria-hidden="true" inert />
        </div>

        <nav className="bb-tabs" aria-label="Buddybook sections">
          {TABS.map((t, i) => {
            const current = t.spread === spread;
            return (
              <button
                key={t.label}
                type="button"
                className={"bb-tab bb-tab--" + t.tone + (current ? " bb-tab--on" : "")}
                style={{ top: 72 + i * 60 }}
                aria-current={current ? "page" : undefined}
                aria-label={t.label}
                onClick={() => setSpread(t.spread)}
              >
                <BookIcon name={t.art} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function BuddybookPage() {
  const { data, loading, error, reload } = useBuddybook();
  const { profile } = useAuth();
  const { seen, mark } = useSeen(profile?.id);
  const [spread, setSpread] = useState(0);
  const [mode, setMode] = useState<"book" | "list">("book");
  // On narrow screens the book is too small to read, so the list is used instead.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const view = narrow ? "list" : mode;

  // Things you have looked at stop being "new" a moment after their pages are open.
  const looked = useMemo(() => {
    if (!data) return [] as string[];
    return newItemsOf(data, new Set()).filter((n) => (spread === 3 ? n.id.startsWith("quest:") : spread === 4 || spread === 5 ? n.id.startsWith("buddy:") : spread === 2 ? n.id.startsWith("stamp:") : false)).map((n) => n.id);
  }, [data, spread]);
  useEffect(() => {
    if (view !== "book" || looked.length === 0) return;
    const t = window.setTimeout(() => mark(looked), 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, looked]);

  // Left/right arrows turn pages while the book view is open.
  useEffect(() => {
    if (view !== "book") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") setSpread((s) => Math.min(SPREADS - 1, s + 1));
      if (e.key === "ArrowLeft") setSpread((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page bb-page-wrap" id="buddybook">
        <Link to="/beyond-the-desk" className="page-back">
          <span aria-hidden="true">‹</span> Back to Beyond the Desk
        </Link>
        <div className="bb-title">
          <PixelIcon name="buddybook" size={48} />
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Buddybook</h1>
            <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>
              Open the cover, then use the tabs, the arrows or the buttons to turn pages.
            </p>
            <p className="bb-lock"><LockIcon /> Only you can see your Buddybook. Visitors see just the Brag Shelf on your desk.</p>
          </div>
        </div>

        {loading && !data ? (
          <p className="text-muted t-body" role="status">Opening your Buddybook…</p>
        ) : error && !data ? (
          <div className="bb-error" role="alert">
            <p className="t-body" style={{ margin: 0 }}>{error}</p>
            <button type="button" className="bb-btn bb-btn--primary" onClick={reload}>Try again</button>
          </div>
        ) : data ? (
          <>
            {!narrow && (
              <div className="bb-modebar" role="group" aria-label="How to read your Buddybook">
                <button type="button" className={"bb-chip" + (view === "book" ? " bb-chip--on" : "")} aria-pressed={view === "book"} onClick={() => setMode("book")}>Book view</button>
                <button type="button" className={"bb-chip" + (view === "list" ? " bb-chip--on" : "")} aria-pressed={view === "list"} onClick={() => setMode("list")}>List view</button>
              </div>
            )}

            {view === "list" ? (
              <ListView d={data} seen={seen} />
            ) : (
              <>
                <Book d={data} spread={spread} setSpread={setSpread} seen={seen} />
                <div className="bb-controls">
                  <button type="button" className="bb-btn" disabled={spread === 0} onClick={() => setSpread(spread - 1)}>Previous</button>
                  <span className="bb-state" role="status" aria-live="polite">{STATE_LABEL[spread]}</span>
                  <button type="button" className="bb-btn" disabled={spread === SPREADS - 1} onClick={() => setSpread(spread + 1)}>Next</button>
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
