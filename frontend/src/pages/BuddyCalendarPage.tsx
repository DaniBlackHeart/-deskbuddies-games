import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import { Link } from "react-router-dom";
import PixelIcon from "../components/PixelIcon";
import { timeRange } from "../lib/calendarFormat";
import { useCalendar, type CalEvent, type Category } from "../lib/useCalendar";

// Buddy Calendar. Follows the "Debbie Buddy Calendar" design and
// claude/Debbie_Buddy_Calendar_System_Decisions_v1.md. Everything comes from the calendar
// Edge Function: Discord's scheduled events (fetched once for everyone, never per visitor),
// the phase of each event, and the check-in. Times are stored in UTC and shown in
// Asia/Manila, labelled "Philippine time". Host codes only reach Mods and the host.
//
// Not built: reminders or RSVP, "Add to my calendar", and expanding a repeating event into
// future dates (Discord only lists the next one, so each date appears once it is listed).

const TZ = "Asia/Manila";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORY_LABEL: Record<Category, string> = { coworking: "Coworking", reading: "Reading", games: "Games", career: "Career Series" };
const FILTERS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "coworking", label: "Coworking" },
  { key: "reading", label: "Reading" },
  { key: "games", label: "Games" },
  { key: "career", label: "Career Series" },
];
const LOCK_TEXT = "Too many tries for now. Wait a few minutes, then try again, or ask the host.";
const DONE_TEXT = "You are checked in. Thanks for showing up.";
const OFFSET = 8 * 3_600_000;

const manilaDate = (ts: number) => new Date(ts + OFFSET).toISOString().slice(0, 10); // YYYY-MM-DD
const fmt = (ts: number | string, o: Intl.DateTimeFormatOptions, zone = TZ) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, ...o }).format(new Date(ts));

function viewerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || TZ;
  } catch {
    return TZ;
  }
}

function syncLine(last: string | null, failed: boolean, now: string) {
  if (!last) return failed ? "The schedule hasn't been fetched yet." : "";
  if (failed) return `Last updated ${fmt(last, { hour: "numeric", minute: "2-digit" })} Philippine time.`;
  const mins = Math.max(0, Math.round((Date.parse(now) - Date.parse(last)) / 60000));
  if (mins < 1) return "Schedule updated just now.";
  if (mins === 1) return "Schedule updated 1 minute ago.";
  if (mins < 60) return `Schedule updated ${mins} minutes ago.`;
  const h = Math.floor(mins / 60);
  return `Schedule updated ${h} ${h === 1 ? "hour" : "hours"} ago.`;
}

function EventCard({
  e,
  open,
  onToggle,
  isMod,
  busy,
  act,
  reward,
}: {
  e: CalEvent;
  open: boolean;
  onToggle: () => void;
  isMod: boolean;
  busy: boolean;
  act: ReturnType<typeof useCalendar>["act"];
  reward: { xp: number; deskbits: number } | null;
}) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [codeEdit, setCodeEdit] = useState("");
  const zone = useMemo(viewerZone, []);
  const member = e.kind === "member";
  // The window runs to the end of the Manila day the event ends on.
  const lastMinute = Date.parse(e.window_ends_at) - 60_000;
  const winTime = fmt(lastMinute, { hour: "numeric", minute: "2-digit" });
  const lastDay = new Date(lastMinute).toISOString();
  const winDay = fmt(lastDay, { weekday: "short", month: "short", day: "numeric" });
  const canType = !e.checked_in && e.code_set && (e.phase === "live" || e.phase === "after");
  const pill = { live: "Happening now", after: "Check-in open", closed: "Ended", upcoming: "", cancelled: "Cancelled" }[e.phase];

  let info = "";
  if (!e.checked_in) {
    if (e.phase === "cancelled") info = "This event was cancelled.";
    else if (!e.code_set && e.phase !== "closed") info = "Check-in is not set up for this event. Ask the host or the Mod team.";
    else if (e.phase === "upcoming") info = `Check-in opens when the event starts and stays open until ${winTime} that day (Philippine time).`;
    else if (e.phase === "closed") info = `Check-in is closed. It stayed open until ${winTime} on ${winDay} (Philippine time).`;
  }

  let local = "";
  if (zone !== TZ) {
    try {
      const a = fmt(e.starts_at, { weekday: "short", hour: "numeric", minute: "2-digit" }, zone);
      const b = e.ends_at ? fmt(e.ends_at, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }, zone) : "";
      local = `Your time (${zone.split("/").pop()?.replace(/_/g, " ")}): ${a}${b ? " – " + b : ""}`;
    } catch {
      local = "";
    }
  }

  const submit = async () => {
    if (e.locked) return setMsg(LOCK_TEXT);
    if (!code.trim()) return setMsg("Type the code the host shared.");
    const s = await act("checkin", { event_id: e.id, code });
    if (s === "ok" || s === "already") {
      setMsg("");
      setCode("");
    } else if (s === "wrong") setMsg("That code does not match. Check with the host.");
    else if (s === "locked") setMsg(LOCK_TEXT);
    else if (s === "closed") setMsg("Check-in is closed for this event.");
    else if (s === "not_set") setMsg("Check-in is not set up for this event. Ask the host or the Mod team.");
    else if (s === "not_available" || s === "not_found") setMsg("That event isn't available for check-in.");
    else if (s === "empty") setMsg("Type the code the host shared.");
    else setMsg("That didn't go through. Try again.");
  };

  const shownMsg = e.locked && !e.checked_in ? LOCK_TEXT : msg;
  const when = `${WEEKDAYS[new Date(Date.parse(e.starts_at) + OFFSET).getUTCDay()]}, ${fmt(e.starts_at, { month: "short", day: "numeric" })}, ${timeRange(e.starts_at, e.ends_at)} (Philippine time)`;
  const hid = `cal-ev-${e.id}`;

  return (
    <article className={"cal-event" + (open ? " cal-event--open" : "") + (e.phase === "cancelled" ? " cal-event--cancelled" : "")}>
      <button type="button" className="cal-event__head" aria-expanded={open} aria-controls={hid} onClick={onToggle}>
        <span className="cal-event__main">
          <span className="cal-chips">
            <span className="cal-time">{timeRange(e.starts_at, e.ends_at)}</span>
            {pill && <span className={"cal-pill" + (e.phase === "closed" || e.phase === "cancelled" ? " cal-pill--quiet" : "")}>{pill}</span>}
            {e.category && <span className="cal-tag">{CATEGORY_LABEL[e.category]}</span>}
            <span className={"cal-tag" + (member ? " cal-tag--member" : "")}>{member ? "Member-hosted" : "Official"}</span>
          </span>
          <span className="cal-event__title">{e.title}</span>
        </span>
        <span aria-hidden="true" className="cal-event__chev">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="cal-event__body" id={hid}>
          {e.description && <p className="cal-text">{e.description}</p>}
          {member && <p className="cal-note">Run by a member and approved by a DeskBuddies moderator.</p>}
          <div className="cal-facts">
            {e.host && <span><b>Host:</b> {e.host}</span>}
            <span><b>Where:</b> {e.location ?? "Shown on the event in Discord"}</span>
            <span><b>When:</b> {when}</span>
            {local && <span className="text-muted">{local}</span>}
          </div>

          {e.checked_in && (
            <div className="cal-panel" role="status">
              <b>{DONE_TEXT}</b>
              {!member && reward && (
                <span className="cal-reward">
                  {reward.xp > 0 && <span className="cal-reward__item"><PixelIcon name="buddy-xp" size={16} /> +{reward.xp} Buddy XP</span>}
                  {reward.deskbits > 0 && <span className="cal-reward__item"><PixelIcon name="deskbits" size={16} /> +{reward.deskbits} deskbits</span>}
                </span>
              )}
            </div>
          )}

          {canType && (
            <div className="cal-panel">
              <label htmlFor={`code-${e.id}`} className="cal-panel__label">Check in with the host’s code</label>
              <span className="cal-note">The host shares the code during the event. Check-in is open until {winTime} on {winDay} (Philippine time).</span>
              <div className="cal-row">
                <input
                  id={`code-${e.id}`}
                  className="cal-input"
                  type="text"
                  autoComplete="off"
                  maxLength={40}
                  value={code}
                  aria-describedby={`msg-${e.id}`}
                  onChange={(ev) => setCode(ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === "Enter") void submit(); }}
                />
                <button type="button" className="cal-btn cal-btn--primary" aria-disabled={busy || e.locked} onClick={() => { if (!busy) void submit(); }}>
                  Check in
                </button>
              </div>
              <span id={`msg-${e.id}`} role="status" className={shownMsg ? "cal-msg" : "cal-msg cal-msg--empty"}>{shownMsg}</span>
            </div>
          )}

          {info && <div className="cal-info">{info}</div>}

          <div className="cal-row">
            {e.discord_url && (
              <a className="cal-btn" href={e.discord_url} target="_blank" rel="noopener noreferrer">Open in Discord</a>
            )}
          </div>

          {isMod && (
            <fieldset className="cal-mod">
              <legend>Mods only</legend>
              <div className="cal-row">
                <label className="cal-mod__field">
                  <span>Category</span>
                  <select
                    className="cal-input"
                    value={e.category ?? ""}
                    disabled={busy}
                    onChange={(ev) => void act("moderate", { series_id: e.series_id, category: ev.target.value || null })}
                  >
                    <option value="">None</option>
                    {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </label>
                <label className="cal-mod__field">
                  <span>Run by</span>
                  <select
                    className="cal-input"
                    value={e.kind}
                    disabled={busy}
                    onChange={(ev) => void act("moderate", { series_id: e.series_id, kind: ev.target.value })}
                  >
                    <option value="official">Official</option>
                    <option value="member">Member</option>
                  </select>
                </label>
              </div>
              <p className="cal-note" style={{ margin: 0 }}>
                Host code: <b>{e.host_code ?? "not set"}</b>. One code covers every date of a repeating event. Members never see it.
              </p>
              <div className="cal-row">
                <input
                  className="cal-input"
                  type="text"
                  autoComplete="off"
                  maxLength={40}
                  placeholder="New code"
                  aria-label="New host code"
                  value={codeEdit}
                  onChange={(ev) => setCodeEdit(ev.target.value)}
                />
                <button
                  type="button"
                  className="cal-btn"
                  aria-disabled={busy || codeEdit.trim().length < 3}
                  onClick={async () => {
                    if (busy || codeEdit.trim().length < 3) return;
                    const s = await act("set_code", { series_id: e.series_id, code: codeEdit });
                    if (s) setCodeEdit("");
                  }}
                >
                  Save new code
                </button>
                <button type="button" className="cal-btn" disabled={busy} onClick={() => void act("moderate", { series_id: e.series_id, state: "hidden" })}>
                  Hide from calendar
                </button>
              </div>
            </fieldset>
          )}
        </div>
      )}
    </article>
  );
}

export default function BuddyCalendarPage() {
  const { data, loading, error, busy, act, goMonth, reload } = useCalendar();
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [day, setDay] = useState<string | null>(null); // YYYY-MM-DD (Manila)
  const [open, setOpen] = useState("");

  const month = data?.month ?? null;
  const today = data ? manilaDate(Date.parse(data.now)) : "";

  // Pick a day when the month changes: today if it is in this month, otherwise the first day with an event.
  useEffect(() => {
    if (!data || !month) return;
    setDay((cur) => {
      if (cur && cur.startsWith(month)) return cur;
      if (today.startsWith(month)) return today;
      const firstWith = data.events.map((e) => manilaDate(Date.parse(e.starts_at))).sort()[0];
      return firstWith ?? `${month}-01`;
    });
  }, [data, month, today]);

  const shown = useMemo(
    () => (data ? data.events.filter((e) => filter === "all" || e.category === filter) : []),
    [data, filter],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of shown) {
      const k = manilaDate(Date.parse(e.starts_at));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [shown]);

  const head = (
    <>
    <Link to="/common-room" className="page-back">
      <span aria-hidden="true">‹</span> Back to The Common Room
    </Link>
    <div className="cal-title">
      <PixelIcon name="buddy-calendar" size={48} />
      <div>
        <div className="cal-eyebrow">WHAT’S ON</div>
        <h1 className="t-h1" style={{ margin: 0 }}>Buddy Calendar</h1>
        <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>
          Events you can join, with times in Philippine time (Asia/Manila).
        </p>
        {data && <p className="text-muted cal-sync">{syncLine(data.sync.last_synced_at, data.sync.failed, data.now)}</p>}
      </div>
    </div>
    </>
  );

  if (loading && !data) {
    return (
      <div className="app-shell">
        <AppHeader />
        <main className="container db-page cal-page" id="buddy-calendar">
          {head}
          <p className="text-muted t-body" role="status">Opening the calendar…</p>
        </main>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="app-shell">
        <AppHeader />
        <main className="container db-page cal-page" id="buddy-calendar">
          {head}
          <div className="cal-card" role="alert">
            <p className="t-body" style={{ margin: 0 }}>{error ?? "Couldn't load the calendar."}</p>
            <div><button type="button" className="cal-btn cal-btn--primary" onClick={reload}>Try again</button></div>
          </div>
        </main>
      </div>
    );
  }

  const [yy, mm] = data.month.split("-").map(Number);
  const lead = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 6) % 7;
  const nd = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const total = lead + nd > 35 ? 42 : 35;
  const selected = day && day.startsWith(data.month) ? day : `${data.month}-01`;
  const dayEvents = byDay.get(selected) ?? [];
  const sel = new Date(selected + "T00:00:00Z");
  const dayTitle = `${WEEKDAYS[sel.getUTCDay()]}, ${MON3[sel.getUTCMonth()]} ${sel.getUTCDate()}`;
  const shift = (d: number) => {
    const x = new Date(Date.UTC(yy, mm - 1 + d, 1));
    void goMonth(`${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`);
    setOpen("");
  };

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page cal-page" id="buddy-calendar">
        {head}

        {data.sync.failed && (
          <div className="cal-notice" role="status">
            <span><b>Couldn’t update the schedule just now.</b> What you see may be out of date.</span>
            <button type="button" className="cal-btn" onClick={reload}>Try again</button>
          </div>
        )}

        {data.is_mod && (
          <section className="cal-card" aria-labelledby="cal-mod-h">
            <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
              <h2 className="cal-h2" id="cal-mod-h" style={{ margin: 0 }}>For Mods</h2>
              <button type="button" className="cal-btn" disabled={busy} onClick={() => void act("refresh")}>Refresh now</button>
            </div>
            {data.pending.length === 0 ? (
              <p className="cal-note" style={{ margin: 0 }}>No events are waiting to be shown. Events made by the team appear on their own.</p>
            ) : (
              <>
                <p className="cal-note" style={{ margin: 0 }}>These Discord events were not made by the team. Show one to add it to the calendar.</p>
                <ul className="cal-pending">
                  {data.pending.map((p) => (
                    <li key={p.series_id} className="cal-pending__row">
                      <span style={{ minWidth: 0 }}>
                        <b>{p.title}</b>
                        <span className="cal-note"> {p.starts_at ? fmt(p.starts_at, { month: "short", day: "numeric" }) : ""}{p.host ? `, by ${p.host}` : ""}{p.recurring ? ", repeats" : ""}</span>
                      </span>
                      <span className="cal-row">
                        <button type="button" className="cal-btn" disabled={busy} onClick={() => void act("moderate", { series_id: p.series_id, state: "shown", kind: "member" })}>Show as member-hosted</button>
                        <button type="button" className="cal-btn" disabled={busy} onClick={() => void act("moderate", { series_id: p.series_id, state: "shown", kind: "official" })}>Show as official</button>
                        <button type="button" className="cal-btn" disabled={busy} onClick={() => void act("moderate", { series_id: p.series_id, state: "hidden" })}>Hide</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {!data.has_any_events ? (
          <section className="cal-empty" aria-labelledby="cal-empty-h">
            <PixelIcon name="buddy-calendar" size={48} />
            <h2 className="cal-h2" id="cal-empty-h" style={{ margin: 0 }}>No events scheduled yet</h2>
            <ul className="cal-empty__list">
              <li>Events appear here once they’re scheduled.</li>
              <li>When one is on, the host shares a code during it. Type it in to check in.</li>
              <li>If you miss one, nothing is lost.</li>
            </ul>
            {data.discord_server_url && (
              <a className="cal-btn" href={data.discord_server_url} target="_blank" rel="noopener noreferrer">See events in Discord</a>
            )}
          </section>
        ) : (
          <>
            <div role="group" aria-label="Filter events" className="cal-filters">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} className={"cal-chip" + (filter === f.key ? " cal-chip--on" : "")} onClick={() => { setFilter(f.key); setOpen(""); }}>
                  {f.label}
                </button>
              ))}
            </div>

            {data.birthdays.configured && (
              <section className="cal-card" aria-labelledby="cal-bd-h">
                <h2 className="cal-h2" id="cal-bd-h" style={{ margin: 0 }}>Birthdays in {MONTHS[mm - 1]}</h2>
                <div className="cal-mat">
                  <img className="cal-art cal-art--light" src="/calendar/birthday-card-light.svg" alt="The sixteen buddies in a row, with Foundie holding a cake" width={940} height={92} />
                  <img className="cal-art cal-art--dark" src="/calendar/birthday-card-dark.svg" alt="" width={940} height={92} />
                </div>
                <p className="cal-names">
                  {data.birthdays.names.length ? `Celebrating: ${data.birthdays.names.join(", ")}` : "No one has shared a birthday month for this month."}
                </p>
                <p className="cal-note" style={{ margin: 0 }}>
                  Members who shared their birth month. This is not an event, so there is nothing to join or check in to. You can still leave a Desk Sticky on their desk to greet them.
                </p>
              </section>
            )}

            <div className="cal-cols">
              <section className="cal-card" aria-label="Month">
                <div className="row-between">
                  <button type="button" className="cal-btn cal-nav" aria-label="Previous month" aria-disabled={data.month <= data.earliest_month} onClick={() => { if (data.month > data.earliest_month) shift(-1); }}>‹</button>
                  <h2 className="cal-h2" aria-live="polite" style={{ margin: 0, fontSize: "1.5rem" }}>{MONTHS[mm - 1]} {yy}</h2>
                  <button type="button" className="cal-btn cal-nav" aria-label="Next month" aria-disabled={data.month >= data.latest_month} onClick={() => { if (data.month < data.latest_month) shift(1); }}>›</button>
                </div>
                <div className="cal-grid" aria-hidden="true">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="cal-dow">{d}</span>)}
                </div>
                <div className="cal-grid">
                  {Array.from({ length: total }, (_, i) => {
                    const n = i - lead + 1;
                    if (n < 1 || n > nd) return <span key={i} className="cal-cell cal-cell--blank" aria-hidden="true" />;
                    const key = `${data.month}-${String(n).padStart(2, "0")}`;
                    const has = (byDay.get(key) ?? []).length > 0;
                    const isSel = key === selected;
                    const isToday = key === today;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={"cal-cell" + (isSel ? " cal-cell--sel" : "") + (isToday ? " cal-cell--today" : "")}
                        aria-pressed={isSel}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${MON3[mm - 1]} ${n}${has ? ", has an event" : ""}${isToday ? ", today" : ""}`}
                        onClick={() => { setDay(key); setOpen(""); }}
                      >
                        <span>{n}</span>
                        <span aria-hidden="true" className={"cal-dot" + (has ? " cal-dot--on" : "")} />
                      </button>
                    );
                  })}
                </div>
                <p className="cal-note" style={{ margin: 0 }}>A dot means there is an event that day. Today is outlined.</p>
              </section>

              <section className="cal-day" aria-labelledby="cal-day-h">
                <h2 className="cal-h2" id="cal-day-h" style={{ margin: 0, fontSize: "1.5rem" }}>{dayTitle}</h2>
                {dayEvents.length === 0 && (
                  <p className="t-body text-muted" style={{ margin: 0 }}>
                    No events this day.{filter !== "all" ? " Try “All” to see everything." : ""}
                  </p>
                )}
                {dayEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    e={e}
                    open={open === e.id}
                    onToggle={() => setOpen(open === e.id ? "" : e.id)}
                    isMod={data.is_mod}
                    busy={busy}
                    act={act}
                    reward={data.checkin_reward}
                  />
                ))}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
