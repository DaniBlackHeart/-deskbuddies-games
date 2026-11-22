import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { STAMP_ART } from "../lib/stampArt";
import { useBuddybook, type BuddyEntry, type BuddybookData, type KeepsakeEntry, type Stamp } from "../lib/useBuddybook";

// Buddybook: your private, read-only record. Follows the "Debbie Buddybook" design
// and brief: a flip book you open with the tabs, the page corners or the buttons,
// and a plain list as the fallback (the default on phones). It is calm on purpose:
// no progress bars, no to-do items, no "x of y". Only what you have earned is
// counted. Visitors never see it; they only see the Brag Shelf on your desk.
//
// Everything comes from the buddybook Edge Function. Not built yet: the Side Quests
// tab (there is no Side Quest wheel yet), Firsts whose features do not exist yet,
// "new" badges, and entry detail popups.

const SPREADS = 5; // 0 closed, 1 contents, 2 firsts, 3 buddy collection, 4 buddy collection + keepsakes
const STATE_LABEL = ["Closed book", "Cover and contents", "Firsts", "Buddy Collection", "Buddy Collection and Keepsakes"];
const TABS: { label: string; spread: number }[] = [
  { label: "Contents", spread: 1 },
  { label: "Firsts", spread: 2 },
  { label: "Buddy Collection", spread: 3 },
  { label: "Keepsakes", spread: 4 },
];
const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold" } as const;
const BUDDIES_PER_PAGE = 6;

function prettyDate(ymd: string | null) {
  if (!ymd) return "";
  const d = new Date(ymd + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function StampSprite({ stampKey, locked }: { stampKey: string; locked: boolean }) {
  const art = STAMP_ART[stampKey];
  if (!art) return <span className="bb-stamp__blank" aria-hidden="true" />;
  return (
    <svg
      aria-hidden="true"
      width={64}
      height={64}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={"bb-stamp__art" + (locked ? " bb-stamp__art--locked" : "")}
    >
      {art.map(([fill, d], i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </svg>
  );
}

function Silhouette() {
  return (
    <svg aria-hidden="true" width={64} height={64} viewBox="0 0 16 16" shapeRendering="crispEdges" className="bb-sil">
      <path className="bb-sil__body" d="M4 3h2v1h-2zM10 3h2v1h-2zM4 4h8v1h-8zM3 5h10v7h-10zM4 12h8v1h-8z" />
      <path className="bb-sil__lock" d="M7 6h2v1h-2zM6 7h1v1h-1zM9 7h1v1h-1zM6 8h4v3h-4z" />
    </svg>
  );
}

function StampCard({ s }: { s: Stamp }) {
  return (
    <li className={"bb-stamp" + (s.earned ? "" : " bb-stamp--locked")}>
      <StampSprite stampKey={s.key} locked={!s.earned} />
      <b className="bb-stamp__name">{s.earned ? s.name : "A stamp for later"}</b>
      <span className="bb-stamp__line">
        {s.earned ? (
          <>
            {s.line}
            {s.earned_on && <span className="bb-stamp__date"> · {prettyDate(s.earned_on)}</span>}
          </>
        ) : (
          "Not earned yet"
        )}
      </span>
    </li>
  );
}

function BuddyTile({ b }: { b: BuddyEntry }) {
  return (
    <li className={"bb-buddy" + (b.owned ? "" : " bb-buddy--locked")}>
      {b.owned ? (
        <img className="bb-buddy__img" src={`/desk/scene-${b.key}.png`} alt="" width={120} height={84} />
      ) : (
        <Silhouette />
      )}
      <b className="bb-buddy__name">{b.owned ? b.name : "Not found yet"}</b>
      <span className="bb-buddy__line">{b.owned ? b.line : b.hint}</span>
    </li>
  );
}

function KeepsakeRow({ k }: { k: KeepsakeEntry }) {
  return (
    <li className="bb-keep">
      <span className={"bb-keep__disc bb-keep__disc--" + k.tier} aria-hidden="true">✓</span>
      <span>
        <b>{k.name}</b>
        <span className="bb-keep__tier"> · {TIER_LABEL[k.tier]}</span>
        <span className="bb-keep__cat">{k.category}</span>
      </span>
    </li>
  );
}

function FirstsGrid({ d }: { d: BuddybookData }) {
  if (d.firsts.length === 0) return <p className="bb-quiet">Firsts will appear here as they open up.</p>;
  return <ul className="bb-stamps">{d.firsts.map((s) => <StampCard key={s.key} s={s} />)}</ul>;
}

function BuddyGrid({ items }: { items: BuddyEntry[] }) {
  if (items.length === 0) return null;
  return <ul className="bb-buddies">{items.map((b) => <BuddyTile key={b.key} b={b} />)}</ul>;
}

function KeepsakeList({ d }: { d: BuddybookData }) {
  if (d.keepsakes.length === 0) {
    return <p className="bb-quiet">Nothing yet. Keepsakes you earn in Beyond the Desk are kept here.</p>;
  }
  return <ul className="bb-keeps">{d.keepsakes.map((k) => <KeepsakeRow key={k.key} k={k} />)}</ul>;
}

function PrivateNote() {
  return (
    <p className="bb-private">
      <PixelIcon name="section-firsts" size={16} /> Only you can see your Buddybook. Visitors see just the Brag Shelf on your desk.
    </p>
  );
}

function Contents({ d, go }: { d: BuddybookData; go?: (spread: number) => void }) {
  const rows = [
    { label: "Firsts", count: d.counts.stamps, noun: "earned", spread: 2 },
    { label: "Buddy Collection", count: d.counts.buddies, noun: "found", spread: 3 },
    { label: "Keepsakes", count: d.counts.keepsakes, noun: "earned", spread: 4 },
  ];
  return (
    <ul className="bb-contents">
      {rows.map((r) => (
        <li key={r.label}>
          {go ? (
            <button type="button" className="bb-contents__row" onClick={() => go(r.spread)}>
              <span>{r.label}</span>
              <span className="bb-contents__n">{r.count} {r.noun}</span>
            </button>
          ) : (
            <span className="bb-contents__row">
              <span>{r.label}</span>
              <span className="bb-contents__n">{r.count} {r.noun}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Page({ side, visible, children, label }: { side: "left" | "right"; visible: boolean; children: ReactNode; label: string }) {
  return (
    <section className={"bb-page bb-page--" + side} aria-label={label} inert={!visible}>
      {children}
    </section>
  );
}

function ListView({ d }: { d: BuddybookData }) {
  return (
    <div className="bb-list">
      <section aria-labelledby="bbl-contents">
        <h2 className="t-h2" id="bbl-contents">Contents</h2>
        <Contents d={d} />
      </section>
      <section aria-labelledby="bbl-firsts">
        <h2 className="t-h2" id="bbl-firsts">Firsts</h2>
        <FirstsGrid d={d} />
      </section>
      <section aria-labelledby="bbl-buddies">
        <h2 className="t-h2" id="bbl-buddies">Buddy Collection</h2>
        {d.buddies.length === 0 ? <p className="bb-quiet">No buddies found yet.</p> : <BuddyGrid items={d.buddies} />}
      </section>
      <section aria-labelledby="bbl-keeps">
        <h2 className="t-h2" id="bbl-keeps">Keepsakes</h2>
        <KeepsakeList d={d} />
        <p className="bb-quiet"><Link to="/beyond-the-desk">See them in Beyond the Desk</Link></p>
      </section>
      <PrivateNote />
    </div>
  );
}

function Book({ d, spread, setSpread }: { d: BuddybookData; spread: number; setSpread: (n: number) => void }) {
  const pages: BuddyEntry[][] = [];
  for (let i = 0; i < d.buddies.length; i += BUDDIES_PER_PAGE) pages.push(d.buddies.slice(i, i + BUDDIES_PER_PAGE));
  const [p1, p2, p3] = [pages[0] ?? [], pages[1] ?? [], pages.slice(2).flat()];

  const vis = (leaf: number, face: "front" | "back") => (face === "front" ? spread === leaf : spread === leaf + 1);
  const leafCls = (i: number) => "bb-leaf" + (spread > i ? " bb-leaf--turned" : "");
  const z = (i: number) => (spread > i ? i + 1 : SPREADS - i);

  return (
    <div className={"bb-book" + (spread === 0 ? " bb-book--closed" : "")} data-spread={spread}>
      <div className="bb-stage">
        {/* leaf 0: cover / inside cover */}
        <div className={leafCls(0)} style={{ zIndex: z(0) }}>
          <div className="bb-face bb-face--front bb-cover" inert={!vis(0, "front")}>
            <PixelIcon name="buddybook" size={64} />
            <h2 className="bb-cover__title">Buddybook</h2>
            <p className="bb-cover__sub">Open the cover, then use the tabs, the page corners or the buttons to turn pages.</p>
            <p className="bb-private bb-private--cover">Only you can see your Buddybook. Visitors see just the Brag Shelf on your desk.</p>
            <button type="button" className="bb-btn bb-btn--primary" onClick={() => setSpread(1)}>Open the book</button>
          </div>
          <div className="bb-face bb-face--back" inert={!vis(0, "back")}>
            <Page side="left" visible={vis(0, "back")} label="Welcome">
              <h2 className="bb-h">Your Buddybook</h2>
              <p className="bb-quiet">A quiet record of the things you have done and the buddies you have found. Nothing here is a to-do list.</p>
              <PrivateNote />
            </Page>
          </div>
        </div>

        {/* leaf 1: contents / firsts intro */}
        <div className={leafCls(1)} style={{ zIndex: z(1) }}>
          <div className="bb-face bb-face--front" inert={!vis(1, "front")}>
            <Page side="right" visible={vis(1, "front")} label="Contents">
              <h2 className="bb-h">Contents</h2>
              <Contents d={d} go={setSpread} />
            </Page>
          </div>
          <div className="bb-face bb-face--back" inert={!vis(1, "back")}>
            <Page side="left" visible={vis(1, "back")} label="Firsts introduction">
              <h2 className="bb-h">Firsts</h2>
              <p className="bb-quiet">A stamp for the first time you do each thing. Each one is kept for good.</p>
              <p className="bb-count">{d.counts.stamps} earned</p>
            </Page>
          </div>
        </div>

        {/* leaf 2: firsts stamps / buddies page 1 */}
        <div className={leafCls(2)} style={{ zIndex: z(2) }}>
          <div className="bb-face bb-face--front" inert={!vis(2, "front")}>
            <Page side="right" visible={vis(2, "front")} label="Firsts stamps">
              <FirstsGrid d={d} />
            </Page>
          </div>
          <div className="bb-face bb-face--back" inert={!vis(2, "back")}>
            <Page side="left" visible={vis(2, "back")} label="Buddy Collection, first page">
              <h2 className="bb-h">Buddy Collection</h2>
              {d.buddies.length === 0 ? <p className="bb-quiet">No buddies found yet.</p> : <BuddyGrid items={p1} />}
            </Page>
          </div>
        </div>

        {/* leaf 3: buddies page 2 / buddies page 3 */}
        <div className={leafCls(3)} style={{ zIndex: z(3) }}>
          <div className="bb-face bb-face--front" inert={!vis(3, "front")}>
            <Page side="right" visible={vis(3, "front")} label="Buddy Collection, second page">
              <BuddyGrid items={p2} />
            </Page>
          </div>
          <div className="bb-face bb-face--back" inert={!vis(3, "back")}>
            <Page side="left" visible={vis(3, "back")} label="Buddy Collection, last page">
              <BuddyGrid items={p3} />
            </Page>
          </div>
        </div>

        {/* leaf 4: keepsakes / back cover */}
        <div className={leafCls(4)} style={{ zIndex: z(4) }}>
          <div className="bb-face bb-face--front" inert={!vis(4, "front")}>
            <Page side="right" visible={vis(4, "front")} label="Keepsakes">
              <h2 className="bb-h">Keepsakes</h2>
              <KeepsakeList d={d} />
              <p className="bb-quiet"><Link to="/beyond-the-desk">See them in Beyond the Desk</Link></p>
              <PrivateNote />
            </Page>
          </div>
          <div className="bb-face bb-face--back bb-backcover" aria-hidden="true" inert />
        </div>
      </div>

      {spread > 0 && (
        <button type="button" className="bb-corner bb-corner--prev" tabIndex={-1} aria-hidden="true" onClick={() => setSpread(spread - 1)} />
      )}
      {spread > 0 && spread < SPREADS - 1 && (
        <button type="button" className="bb-corner bb-corner--next" tabIndex={-1} aria-hidden="true" onClick={() => setSpread(spread + 1)} />
      )}

      {spread > 0 && (
        <nav className="bb-tabs" aria-label="Buddybook sections">
          {TABS.map((t) => {
            const current = t.spread === spread;
            return (
              <button
                key={t.label}
                type="button"
                className={"bb-tab" + (current ? " bb-tab--on" : "")}
                aria-current={current ? "page" : undefined}
                onClick={() => setSpread(t.spread)}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default function BuddybookPage() {
  const { data, loading, error, reload } = useBuddybook();
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
        <div className="bb-title">
          <PixelIcon name="buddybook" size={48} />
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Buddybook</h1>
            <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>
              Your stamps, buddies and keepsakes, kept in one quiet place that is just yours.
            </p>
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
              <ListView d={data} />
            ) : (
              <>
                <Book d={data} spread={spread} setSpread={setSpread} />
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
