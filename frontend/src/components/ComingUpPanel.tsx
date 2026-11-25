import { Link } from "react-router-dom";
import { useCalendar } from "../lib/useCalendar";

// Coming up (Debbie Home design): the next few Buddy Calendar events, in
// Philippine time. Real data from the same calendar function the Buddy Calendar
// page uses (this month's events; the page has the rest). It sits as a compact
// strip under the greeting and Pull Up a Chair.

const TZ = "Asia/Manila";
const MAX = 3;

function when(iso: string, live: boolean): string {
  if (live) return "Happening now";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export default function ComingUpPanel({ className }: { className?: string }) {
  const { data, loading, error } = useCalendar();
  const upcoming = (data?.events ?? [])
    .filter((e) => e.phase === "upcoming" || e.phase === "live")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, MAX);

  return (
    <section className={"db-panel db-comingup" + (className ? " " + className : "")} aria-labelledby="comingup">
      <div className="row-between" style={{ alignItems: "baseline", gap: "var(--space-3)" }}>
        <h2 id="comingup" className="t-h2" style={{ margin: 0 }}>
          Coming up
        </h2>
        <Link to="/events" className="db-link">
          See the calendar
        </Link>
      </div>
      {loading && !data && <p className="t-body-sm text-muted" style={{ margin: "8px 0 0" }}>Checking the calendar…</p>}
      {error && !data && (
        <p className="t-body-sm text-muted" style={{ margin: "8px 0 0" }}>
          Couldn't load the calendar just now.
        </p>
      )}
      {data && upcoming.length === 0 && (
        <p className="t-body-sm text-muted" style={{ margin: "8px 0 0" }}>
          Nothing coming up this month yet.
        </p>
      )}
      {upcoming.length > 0 && (
        <ul className="cu-list">
          {upcoming.map((e) => (
            <li key={e.id} className="cu-item">
              <span className="cu-item__title">{e.title}</span>
              <span className="cu-item__when">{when(e.starts_at, e.phase === "live")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
