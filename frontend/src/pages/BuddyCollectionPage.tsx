import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BuddySprite from "../components/BuddySprite";
import { useAuth } from "../contexts/AuthContext";
import { useBuddyCollection, type CollectionBuddy } from "../lib/useBuddyCollection";

// Buddy Collection. Follows the "Debbie Buddy Collection" design: every buddy as a tile, found ones
// in full, the rest as a shape with a broad hint. Opened from "Your companions" on My Desk.
// - The server says which buddies are found (and when). Nothing here says how to earn one: no
//   requirements, counters or scarcity beyond the broad hint.
// - "New" is a small per-device nicety: a buddy found in the last 7 days that you haven't opened yet.
// - Art and names are placeholders from the design.

type Filter = "all" | "found" | "locked";
const FILTERS: [Filter, string][] = [["all", "All"], ["found", "Found"], ["locked", "Not yet found"]];
const WEEK = 7 * 24 * 3600 * 1000;

function foundOn(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return "Found " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Manila" });
}

function useSeen(userId: string | undefined) {
  const key = `debbie.buddies.seen.${userId ?? "anon"}`;
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setSeen(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch { setSeen(new Set()); }
  }, [key]);
  const mark = (id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* storage unavailable: fine */ }
      return next;
    });
  };
  return { seen, mark };
}

export default function BuddyCollectionPage() {
  const { profile } = useAuth();
  const { buddies, failed, reload } = useBuddyCollection();
  const { seen, mark } = useSeen(profile?.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(null);

  const foundCount = buddies?.filter((b) => b.found).length ?? 0;
  const list = useMemo(
    () => (buddies ?? []).filter((b) => (filter === "all" ? true : filter === "found" ? b.found : !b.found)),
    [buddies, filter],
  );
  const isNew = (b: CollectionBuddy) =>
    b.found && !seen.has(b.key) && !!b.found_at && Date.now() - new Date(b.found_at).getTime() < WEEK;

  const cur = list.find((b) => b.key === sel) ?? list[0] ?? null;

  const pick = (b: CollectionBuddy) => {
    setSel(b.key);
    if (b.found) mark(b.key);
  };

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page bc-page" id="buddy-collection">
        <Link className="av-back" to="/my-desk">‹ Back to My Desk</Link>
        <div className="av-head">
          <div className="av-eyebrow">BUDDY COLLECTION</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Your buddies</h1>
          <p className="text-muted" style={{ margin: "4px 0 0" }}>Little companions you find along the way. No rush, and none are ever taken away.</p>
        </div>

        {failed ? (
          <div className="av-card" role="alert">
            <p style={{ margin: 0 }}>Couldn’t open your collection. Check your connection and try again.</p>
            <div><button type="button" className="bc-chip" onClick={() => void reload()}>Try again</button></div>
          </div>
        ) : !buddies ? (
          <p className="text-muted" role="status">Opening your collection…</p>
        ) : (
          <>
            <div className="bc-bar">
              <div role="radiogroup" aria-label="Show" className="bc-chips">
                {FILTERS.map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={filter === k} className={"bc-chip" + (filter === k ? " bc-chip--on" : "")} onClick={() => setFilter(k)}>{label}</button>
                ))}
              </div>
              <p className="bc-count" role="status">{foundCount} {foundCount === 1 ? "buddy" : "buddies"} found</p>
            </div>

            <div className="bc-grid">
              {list.length === 0 ? (
                <p className="text-muted bc-empty">{filter === "found" ? "No buddies found yet. Your first one is earned, not handed out." : "You have found every buddy."}</p>
              ) : (
                <ul className="bc-tiles">
                  {list.map((b) => {
                    const on = cur?.key === b.key;
                    const nw = isNew(b);
                    return (
                      <li key={b.key} style={{ display: "flex" }}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={(b.found ? `${b.name}${nw ? ", new" : ""}` : `Not yet found, ${b.hint}${b.limited ? ", limited" : ""}`) + (on ? ", selected" : "")}
                          className={"bc-tile" + (b.found ? "" : " bc-tile--locked") + (on ? " bc-tile--on" : "")}
                          onClick={() => pick(b)}
                        >
                          <span className="bc-art" aria-hidden="true">
                            <BuddySprite id={b.key} found={b.found} size={64} />
                            {!b.found && <svg className="bc-lock" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>}
                            {nw && <span className="bc-badge bc-badge--new">NEW</span>}
                            {b.limited && <span className={"bc-badge bc-badge--lim" + (nw ? " bc-badge--right" : "")}>LIMITED</span>}
                          </span>
                          <span className={"bc-name" + (b.found ? "" : " text-muted")}>{b.found ? b.name : "Not yet found"}</span>
                          <span className="text-muted bc-sub">{b.found ? foundOn(b.found_at) : b.hint}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {cur && (
                <aside className="av-card bc-detail" aria-labelledby="bc-d-h">
                  <div className="bc-detail__art" aria-hidden="true"><BuddySprite id={cur.key} found={cur.found} size={128} /></div>
                  <h2 id="bc-d-h" className="av-h2" style={{ margin: 0 }}>{cur.found ? cur.name : "Not yet found"}</h2>
                  <p className="bc-state">{cur.found ? "In your collection" : "Not yet found"}{cur.limited ? " · Limited" : ""}</p>
                  <p style={{ margin: 0 }}>{cur.found ? cur.line ?? "Glad to have you both here." : `${cur.hint}.`}</p>
                  {cur.found && cur.found_at && <p className="text-muted bc-sub" style={{ margin: 0 }}>{foundOn(cur.found_at)}</p>}
                </aside>
              )}
            </div>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>Buddy art and names are placeholders, not final.</p>
          </>
        )}
      </main>
    </div>
  );
}
