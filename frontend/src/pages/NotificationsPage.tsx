import { useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { useNotifications, type Notif, type NotifKind } from "../lib/useNotifications";

// Notifications. Follows the "Debbie Notifications" design. Only the signed-in member's own
// notifications are listed (row-level security). Today only "Earned" items are written (a new
// stamp, a new buddy); Desk Sticky, reminder, social and What's new items appear once those
// features exist. Notification text is shown as plain text.

type Filter = "all" | NotifKind;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sticky", label: "Desk Stickies" },
  { key: "earned", label: "Earned" },
  { key: "reminder", label: "Reminders" },
  { key: "social", label: "Social and clubs" },
  { key: "news", label: "What’s new" },
];
const KIND_LABEL: Record<NotifKind, string> = { sticky: "Desk Sticky", earned: "Earned", reminder: "Gentle reminder", social: "Social", news: "What’s new" };
const KIND_ICON = { sticky: "my-desk", earned: "buddybook", reminder: "desk-time", social: "common-room", news: "note-for-debbie" } as const;
const EMPTY: Record<NotifKind, [string, string]> = {
  sticky: ["No Desk Stickies yet", "When another member leaves a Desk Sticky on your desk, it shows up here."],
  earned: ["Nothing earned to show yet", "New buddies, stamps and levels show up here as you collect them."],
  reminder: ["No reminders right now", "Reminders are gentle and optional. If one is useful, it shows up here."],
  social: ["No replies or club news yet", "Replies to your posts and news from clubs you follow show up here."],
  news: ["No updates yet", "Updates from Debbie show up here."],
};
const LIMIT = 6;

function when(iso: string): string {
  const t = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const { items, failed, reload, markRead, markAll } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [msg, setMsg] = useState("");

  const unread = items ? items.filter((n) => !n.read_at).length : 0;
  const filtered = items ? items.filter((n) => filter === "all" || n.kind === filter) : [];
  const cut = !showAll && filtered.length > LIMIT;
  const shown = cut ? filtered.slice(0, LIMIT) : filtered;
  const hasRem = shown.some((n) => n.kind === "reminder");

  const summary = !items ? (failed ? "" : "Loading your notifications") : items.length === 0 ? "" : unread > 0 ? `${unread} unread` : "You are all caught up.";

  const doMarkAll = async () => {
    const ok = await markAll();
    setMsg(ok ? "" : "That didn’t go through. Please try again.");
  };

  const row = (n: Notif, i: number) => {
    const isNew = !n.read_at;
    const inner = (
      <>
        <span className="ntf-ic" aria-hidden="true"><PixelIcon name={KIND_ICON[n.kind]} size={32} /></span>
        <span className="ntf-text">
          <span className="ntf-kindline">
            <span className="ntf-kind">{KIND_LABEL[n.kind]}</span>
            {isNew && <span className="ntf-new">New</span>}
          </span>
          <span className={"ntf-title" + (isNew ? " ntf-title--new" : "")}>{n.title}</span>
          {n.body && <span className="ntf-body text-muted">{n.body}</span>}
          <span className="ntf-time text-muted">{when(n.created_at)}</span>
        </span>
      </>
    );
    return (
      <li key={n.id} className={"ntf-li" + (i === 0 ? " ntf-li--first" : "") + (isNew ? " ntf-li--new" : "")}>
        {n.href ? (
          <Link className="ntf-item" to={n.href} onClick={() => { if (isNew) void markRead(n.id); }}>{inner}</Link>
        ) : (
          <button type="button" className="ntf-item" onClick={() => { if (isNew) void markRead(n.id); }}>{inner}</button>
        )}
      </li>
    );
  };

  const empty = items && shown.length === 0;
  const [et, eb] = items && items.length === 0 || filter === "all" ? ["Nothing here yet", "Desk Stickies, things you earn and updates from Debbie show up here."] : EMPTY[filter as NotifKind];

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page ntf-page" id="notifications">
        <div className="ntf-headrow">
          <div className="ntf-head">
            <div className="ntf-eyebrow">JUST FOR YOU</div>
            <h1 className="t-h1" style={{ margin: 0 }}>Notifications</h1>
          </div>
          {items && (
            <button type="button" className="ntf-btn" aria-disabled={unread === 0} onClick={() => { if (unread > 0) void doMarkAll(); }}>Mark all as read</button>
          )}
        </div>

        {items && (
          <div className="ntf-filters" role="group" aria-label="Filter notifications">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} className={"ntf-chip" + (filter === f.key ? " ntf-chip--on" : "")} onClick={() => { setFilter(f.key); setShowAll(false); }}>{f.label}</button>
            ))}
          </div>
        )}

        <p className={"ntf-summary" + (unread > 0 ? " ntf-summary--unread" : " text-muted")} role="status">{summary}{msg ? ` ${msg}` : ""}</p>

        {!items && !failed && (
          <ul className="ntf-list" aria-hidden="true">
            {[0, 1, 2].map((i) => <li key={i} className={"ntf-li ntf-skel" + (i === 0 ? " ntf-li--first" : "")} />)}
          </ul>
        )}

        {failed && (
          <section className="ntf-card ntf-empty" role="alert">
            <h2 className="ntf-h2">We couldn’t load your notifications</h2>
            <p className="text-muted" style={{ margin: 0 }}>Nothing is lost. Please try again in a moment.</p>
            <div><button type="button" className="ntf-btn ntf-btn--primary" onClick={() => void reload()}>Try again</button></div>
          </section>
        )}

        {empty && (
          <section className="ntf-card ntf-empty">
            <h2 className="ntf-h2">{et}</h2>
            <p className="text-muted" style={{ margin: 0 }}>{eb}</p>
          </section>
        )}

        {items && shown.length > 0 && <ul className="ntf-list">{shown.map(row)}</ul>}

        {cut && (
          <div><button type="button" className="ntf-btn" onClick={() => setShowAll(true)}>Show earlier notifications ({filtered.length - shown.length})</button></div>
        )}

        {hasRem && <p className="ntf-foot text-muted">Reminders are gentle and optional. You can turn them off in <Link to="/settings">Settings</Link>.</p>}
        <p className="ntf-foot text-muted">Only you can see this page.</p>
      </main>
    </div>
  );
}
