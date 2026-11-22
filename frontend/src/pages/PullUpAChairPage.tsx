import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { resetText } from "../lib/checkInReset";
import { usePullUpAChair, type CheckInOverview } from "../lib/usePullUpAChair";

// Pull Up a Chair: the daily check-in, and nothing else. Follows the "Debbie Pull Up a Chair"
// design. Reached from the Home card; it is not in the menu and Home stays highlighted.
// - Days you were not here are left blank: no crosses, no red, no "missed" wording.
// - The day, the streak, the days checked in and every reward come from the server (Asia/Manila
//   community day). The browser never decides any of them.
// - Reward amounts shown for milestones are the earning draft's initial values and are labelled
//   as samples. Today's reward is shown only if the server actually paid one.
// - The Breather (streak freeze) is not decided, so there is none. Nothing here animates.
// - Only the member sees this page. Other members see Buddy Level and Buddy Streak elsewhere.

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MS = 864e5;

const parse = (s: string) => new Date(s + "T00:00:00Z");
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const monIndex = (d: Date) => (d.getUTCDay() + 6) % 7;
const plural = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

function rewardText(xp: number, deskbits: number): string {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} Buddy XP`);
  if (deskbits > 0) parts.push(`+${deskbits} deskbits`);
  return parts.join(" · ");
}

function Week({ o }: { o: CheckInOverview }) {
  const today = parse(o.today);
  const start = new Date(today.getTime() - monIndex(today) * DAY_MS);
  const here = new Set(o.dates);
  return (
    <div className="pu-week">
      {DOW.map((dow, i) => {
        const d = new Date(start.getTime() + i * DAY_MS);
        const key = ymd(d);
        const isToday = key === o.today;
        const future = key > o.today;
        const present = here.has(key) || (isToday && o.checked_in_today);
        const label = `${dow} ${d.getUTCDate()} ${fmt(d, { month: "short" })}, ${present ? "you were here" : isToday ? "today, not checked in yet" : future ? "coming up" : "no check-in"}${isToday && present ? ", today" : ""}`;
        return (
          <div key={key} role="img" aria-label={label} className={"pu-wday" + (present ? " pu-wday--here" : "") + (isToday ? " pu-wday--today" : "") + (future ? " pu-wday--future" : "")}>
            <span className="pu-wday__dow">{dow}</span>
            <span className="pu-wday__n">{d.getUTCDate()}</span>
            <span aria-hidden="true" className="pu-wday__tick">{present ? "✓" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function Month({ o }: { o: CheckInOverview }) {
  const today = parse(o.today);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const lead = monIndex(first);
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + count) / 7) * 7;
  const here = new Set(o.dates);
  const cells = Array.from({ length: total }, (_, i) => i - lead + 1);
  return (
    <section className="pu-card" aria-labelledby="pu-mo">
      <h2 id="pu-mo" className="pu-h2">Days you were here · {fmt(first, { month: "long", year: "numeric" })}</h2>
      <div className="pu-month" aria-hidden="true">
        {DOW.map((d) => <span key={d} className="pu-month__dow">{d}</span>)}
      </div>
      <div className="pu-month">
        {cells.map((n, i) => {
          if (n < 1 || n > count) return <div key={i} className="pu-cell pu-cell--blank" />;
          const key = ymd(new Date(Date.UTC(y, m, n)));
          const isToday = key === o.today;
          const future = key > o.today;
          const present = here.has(key) || (isToday && o.checked_in_today);
          const label = `${fmt(first, { month: "short" })} ${n}, ${present ? "you were here" : future ? "coming up" : isToday ? "today, not checked in yet" : "no check-in"}`;
          return (
            <div key={i} role="img" aria-label={label} className={"pu-cell" + (present ? " pu-cell--here" : "") + (isToday ? " pu-cell--today" : "") + (future ? " pu-cell--future" : "")}>
              {n}
            </div>
          );
        })}
      </div>
      <p className="text-muted pu-note">Filled days are days you checked in. Today is outlined.</p>
    </section>
  );
}

export default function PullUpAChairPage() {
  const { overview: o, failed, busy, claimError, claim, reload } = usePullUpAChair();

  const shell = (children: React.ReactNode) => (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page pu-page" id="pull-up-a-chair">
        <Link className="pu-back" to="/">‹ Back to Home</Link>
        <div className="pu-head">
          <div className="pu-eyebrow">DAILY CHECK-IN</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Pull Up a Chair</h1>
          <p className="text-muted" style={{ margin: "4px 0 0" }}>Say you’re here for today. That’s all it takes.</p>
        </div>
        {children}
      </main>
    </div>
  );

  if (failed) {
    return shell(
      <section className="pu-card" role="alert">
        <h2 className="pu-h2">We couldn’t load your check-in</h2>
        <p className="text-muted" style={{ margin: 0 }}>Nothing is lost. Please try again in a moment.</p>
        <div><button type="button" className="pu-btn pu-btn--primary" onClick={() => void reload()}>Try again</button></div>
      </section>,
    );
  }
  if (!o) return shell(<p className="text-muted" role="status" style={{ margin: 0 }}>Loading your check-in…</p>);

  const returning = !o.checked_in_today && o.current_streak === 0 && o.total_checkins > 0;
  const first = o.total_checkins === 0;
  const streak = o.current_streak;
  const reward = o.today_reward && (o.today_reward.xp > 0 || o.today_reward.deskbits > 0) ? rewardText(o.today_reward.xp, o.today_reward.deskbits) : "";

  return shell(
    <>
      {returning && (
        <section className="pu-back-card" aria-label="Welcome back">
          <h2 className="pu-h2 pu-h2--sm">Your Seat’s Still Here.</h2>
          <p style={{ margin: 0, lineHeight: 1.5 }}>Your streak starts fresh. Your XP, items, stamps and access are all still here.</p>
        </section>
      )}

      <div className="pu-cols">
        <div className="pu-col">
          <section className="pu-card pu-today" aria-labelledby="pu-ci">
            <div className="pu-today__head">
              <PixelIcon name="pull-up-a-chair" size={48} />
              <h2 id="pu-ci" className="pu-h2">Today</h2>
            </div>
            {!o.checked_in_today && (
              <>
                <p style={{ margin: 0, lineHeight: 1.45 }}>{first ? "Welcome. Say you’re here to start your Buddy Streak." : "Say you’re here for today. That’s all it takes."}</p>
                <button type="button" className="btn btn-primary pu-cta" onClick={() => void claim()} disabled={busy}>{busy ? "Checking in…" : "i’m here!"}</button>
                {claimError && <p role="alert" style={{ margin: 0, fontWeight: 700, color: "var(--color-danger)" }}>Couldn’t check you in. Please try again.</p>}
              </>
            )}
            <div role="status" className={o.checked_in_today ? "pu-done" : undefined}>
              {o.checked_in_today && (
                <>
                  <p className="pu-done__line">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                    You’re here. See you tomorrow.
                  </p>
                  <p className="text-muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>{resetText()}</p>
                  {reward && <p className="pu-reward">{reward} earned today</p>}
                </>
              )}
            </div>
          </section>

          <section className="pu-card" aria-labelledby="pu-bs">
            <h2 id="pu-bs" className="pu-eyebrow pu-eyebrow--h">BUDDY STREAK</h2>
            <div className="pu-big">
              {streak > 0 ? (
                <>
                  <span className="pu-big__n">{streak}</span>
                  <span className="text-muted pu-big__sub">{streak === 1 ? "day" : "days"} in a row</span>
                </>
              ) : (
                <>
                  <span className="pu-big__n pu-big__n--sm">Starts today</span>
                  {returning && <span className="text-muted pu-big__sub">A fresh start</span>}
                </>
              )}
            </div>
            {o.longest_streak > 0 && <p style={{ margin: 0, fontWeight: 700 }}>Best so far: {plural(o.longest_streak)}</p>}
            <p className="text-muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>Missing a day only resets the streak. Your XP, items, stamps and access stay.</p>
          </section>
        </div>

        <div className="pu-col">
          <section className="pu-card" aria-labelledby="pu-wk">
            <h2 id="pu-wk" className="pu-h2 pu-h2--sm">This week</h2>
            <Week o={o} />
            <p className="text-muted pu-note">A ticked day means you were here. The week starts on Monday.</p>
          </section>

          {o.milestones.length > 0 && (
            <section className="pu-card" aria-labelledby="pu-ms">
              <h2 id="pu-ms" className="pu-h2 pu-h2--sm">Streak milestones</h2>
              <ul className="pu-miles">
                {o.milestones.map((m) => (
                  <li key={m.days} className="pu-mile">
                    <span className="pu-mile__text">
                      <span className="pu-mile__title">{m.days}-day streak</span>
                      {rewardText(m.xp, m.deskbits) && <span className="text-muted pu-mile__sub">Sample reward: {rewardText(m.xp, m.deskbits)}</span>}
                    </span>
                    <span className={"pu-pill" + (m.reached ? " pu-pill--on" : "")}>{m.reached ? "✓ Reached" : `${plural(Math.max(1, m.days - streak))} to go`}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted pu-note">Each milestone pays once, the first time you reach it.</p>
            </section>
          )}
        </div>
      </div>

      <Month o={o} />

      <p className="text-muted pu-private">
        <PixelIcon name="lock" size={16} />
        <span>Only you see this page. Other members see your Buddy Level and Buddy Streak number on your profile, nothing else.</span>
      </p>
      <p className="text-muted pu-note">Reward amounts are the initial draft and can change. The check-in window and the Breather are not decided.</p>
    </>,
  );
}
