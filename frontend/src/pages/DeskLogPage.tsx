import { useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { useDeskLog, type DeskLogEntry, type DeskLogKind, type DeskLogScope } from "../lib/useDeskLog";

// Desk Log. Follows the "Debbie Desk Log" design. It is the routine record, kept apart from the
// Common Room. The server writes every line and decides what each view may contain:
//   Around the desks: fellow members' check-ins, focus blocks, achievements and event
//                     check-ins. No amounts, nothing private, never your own entries.
//   My log:           your own entries, the reward each one paid, and who can see it.
// Last 7 days only. Older entries, search and a moderator view are not designed yet. The
// "hide my entries from Around the desks" switch is still undecided, so there is none.

const TABS: { key: DeskLogScope; label: string }[] = [
  { key: "around", label: "Around the desks" },
  { key: "mine", label: "My log" },
];
const FILTERS: { key: "all" | DeskLogKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "check-in", label: "Check-in" },
  { key: "focus", label: "Focus" },
  { key: "achievement", label: "Achievement" },
  { key: "activity", label: "Activity" },
];
const KIND_LABEL: Record<DeskLogKind, string> = { "check-in": "Check-in", focus: "Focus", achievement: "Achievement", activity: "Activity" };

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayTitle(d: Date, now: Date): string {
  const short = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "").toUpperCase();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return `TODAY · ${short}`;
  if (dayKey(d) === dayKey(yesterday)) return `YESTERDAY · ${short}`;
  return short;
}

function clock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function rewardText(e: DeskLogEntry): string {
  if (e.entry_key.startsWith("milestone:")) return "Reward shown on the Keepsake";
  const parts: string[] = [];
  if (e.xp && e.xp > 0) parts.push(`+${e.xp} Buddy XP`);
  if (e.deskbits && e.deskbits > 0) parts.push(`+${e.deskbits} deskbits`);
  return parts.join(" · ");
}

export default function DeskLogPage() {
  const [scope, setScope] = useState<DeskLogScope>("around");
  const [filter, setFilter] = useState<"all" | DeskLogKind>("all");
  const { entries, failed, reload } = useDeskLog(scope);
  const mine = scope === "mine";

  const days = useMemo(() => {
    if (!entries) return [];
    const now = new Date();
    const groups: { key: string; title: string; items: DeskLogEntry[] }[] = [];
    for (const e of entries) {
      if (filter !== "all" && e.kind !== filter) continue;
      const d = new Date(e.at);
      const key = dayKey(d);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, title: dayTitle(d, now), items: [] };
        groups.push(g);
      }
      g.items.push(e);
    }
    return groups;
  }, [entries, filter]);

  const empty = entries && days.length === 0;

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dl-page" id="desk-log">
        <div className="dl-head">
          <PixelIcon name="desk-log" size={48} />
          <div className="dl-head__text">
            <div className="dl-eyebrow">ACTIVITY</div>
            <h1 className="t-h1" style={{ margin: 0 }}>Desk Log</h1>
          </div>
        </div>
        <p className="text-muted" style={{ margin: 0 }}>
          Routine records of what is happening around the desks. It is separate from the Common Room, where members write their own posts.
        </p>

        <section className="dl-who" aria-labelledby="dl-who">
          <h2 id="dl-who" className="dl-who__h">Who sees what</h2>
          <ul className="dl-who__list">
            <li>Check-ins, focus blocks and achievements are visible to fellow members, not the public internet.</li>
            <li>Rewards you earn are shown only in My log.</li>
            <li>Things you log yourself stay in My log, without any details. Journals, books, habits and focus goals never appear.</li>
          </ul>
        </section>

        <div role="radiogroup" aria-label="Which log" className="dl-row">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={scope === t.key}
              className={"dl-chip" + (scope === t.key ? " dl-chip--on" : "")}
              onClick={() => { setScope(t.key); setFilter("all"); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Filter the log" className="dl-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              className={"dl-chip dl-chip--sm" + (filter === f.key ? " dl-chip--on" : "")}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!entries && !failed && (
          <ul className="dl-list" aria-hidden="true">
            {[0, 1, 2].map((i) => <li key={i} className="dl-entry dl-skel" />)}
          </ul>
        )}

        {failed && (
          <section className="dl-card" role="alert">
            <h2 className="dl-h2">We couldn’t load the Desk Log</h2>
            <p className="text-muted" style={{ margin: 0 }}>Nothing is lost. Please try again in a moment.</p>
            <div><button type="button" className="dl-chip dl-chip--on" onClick={() => void reload()}>Try again</button></div>
          </section>
        )}

        {empty && (
          <p className="text-muted" style={{ margin: 0, fontSize: "1rem", lineHeight: 1.5 }}>
            {mine
              ? "Nothing here yet. Pull up a chair or finish a focus block and it will show up here."
              : "Nothing here yet. Quiet days happen too."}
          </p>
        )}

        {days.length > 0 && (
          <div className="dl-days">
            {days.map((g) => (
              <section key={g.key} aria-label={g.title} className="dl-day">
                <h2 className="dl-day__h">{g.title}</h2>
                <ul className="dl-list">
                  {g.items.map((e) => {
                    const reward = mine ? rewardText(e) : "";
                    return (
                      <li key={e.entry_key} className="dl-entry">
                        {!mine && (
                          <span className="dl-avatar" aria-hidden="true">
                            {e.avatar_url ? (
                              <img src={e.avatar_url} alt="" width={40} height={40} referrerPolicy="no-referrer" loading="lazy" />
                            ) : (
                              (e.username[0] ?? "?").toUpperCase()
                            )}
                          </span>
                        )}
                        <span className="dl-entry__body">
                          <span className="dl-entry__line"><strong>{mine ? "You" : e.username}</strong> {e.line}</span>
                          <span className="dl-entry__meta">
                            <span className="dl-time">{clock(new Date(e.at))}</span>
                            <span className="dl-pill">{KIND_LABEL[e.kind]}</span>
                            {reward && <span className="dl-pill dl-pill--reward">{reward}</span>}
                            {mine && e.visibility && (
                              <span className={"dl-pill dl-pill--vis" + (e.visibility === "only_you" ? " dl-pill--private" : "")}>
                                {e.visibility === "only_you" ? "Only you" : "Members can see"}
                              </span>
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>Showing the last 7 days.</p>
      </main>
    </div>
  );
}
