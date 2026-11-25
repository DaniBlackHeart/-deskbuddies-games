import { Link } from "react-router-dom";
import PixelIcon from "./PixelIcon";
import { useCalendar, type Category } from "../lib/useCalendar";
import { TZ, timeRange } from "../lib/calendarFormat";

// Buddy Calendar card on The Common Room (Debbie nav v4: the calendar is a
// subpage of the Common Room). Shows the next two events from the same calendar
// function the Buddy Calendar page uses, in Philippine time, and opens the page.

const CATEGORY_LABEL: Record<Category, string> = { coworking: "Coworking", reading: "Reading", games: "Games", career: "Career Series" };

export default function CommonRoomCalendarCard() {
  const { data, loading, error } = useCalendar();
  const next = (data?.events ?? [])
    .filter((e) => e.phase === "upcoming" || e.phase === "live")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, 2);

  return (
    <section className="cr-cal" aria-labelledby="cr-cal-h">
      <div className="cr-cal__head">
        <span className="cr-cal__icon" aria-hidden="true">
          <PixelIcon name="buddy-calendar" size={32} />
        </span>
        <div>
          <h2 id="cr-cal-h" className="t-h3" style={{ margin: 0 }}>Buddy Calendar</h2>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>What’s on in the community</p>
        </div>
      </div>

      <div className="cr-cal__box">
        <span className="cr-cal__eyebrow">COMING UP</span>
        {loading && !data && <p className="t-body-sm text-muted" style={{ margin: 0 }}>Checking the calendar…</p>}
        {error && !data && <p className="t-body-sm text-muted" style={{ margin: 0 }}>Couldn’t load the calendar just now.</p>}
        {data && next.length === 0 && <p className="t-body-sm text-muted" style={{ margin: 0 }}>Nothing coming up this month yet.</p>}
        {next.map((e) => {
          const d = new Date(e.starts_at);
          const wd = d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" }).toUpperCase();
          const day = d.toLocaleDateString("en-US", { timeZone: TZ, day: "numeric" });
          return (
            <div key={e.id} className="cr-cal__ev">
              <span className="cr-cal__date" aria-hidden="true">
                <span>{wd}</span>
                <b>{day}</b>
              </span>
              <span className="cr-cal__text">
                <b>{e.title}</b>
                <span className="text-muted">
                  {e.phase === "live" ? "Happening now · " : ""}
                  {timeRange(e.starts_at, e.ends_at)}
                  {e.category ? ` · ${CATEGORY_LABEL[e.category]}` : ""}
                </span>
              </span>
            </div>
          );
        })}
        <span className="t-caption text-muted">Times are Philippine time. Join late or leave early.</span>
      </div>

      <Link to="/events" className="cr-btn cr-cal__open">
        Open Buddy Calendar
      </Link>
    </section>
  );
}
