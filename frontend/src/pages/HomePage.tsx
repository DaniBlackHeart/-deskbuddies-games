import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ActiveGameStatus from "../components/ActiveGameStatus";
import DailyCheckInCard from "../components/DailyCheckInCard";
import PixelIcon from "../components/PixelIcon";
import { useAuth } from "../contexts/AuthContext";
import { useDailyCheckIn } from "../lib/useDailyCheckIn";

// Home answers three questions in about ten seconds: where am I (my desk),
// what can I do today, and who else is here. Layout follows the Debbie Home
// concept. Only real data is shown: the check-in and streak come from the
// server; Level, XP, deskbits, the desk, Focus Block, Brain Break and Who's
// around have no backend yet, so they appear as clearly labelled "Coming soon"
// panels rather than sample numbers. The six live games stay one tap away.

// Placeholder tints until each game gets its own pixel icon.
const GAMES = [
  { to: "/trivia", emoji: "🧠", name: "Trivia Night", tint: "#F2C766" },
  { to: "/feud/lobby", emoji: "🎙️", name: "Family Feud", tint: "#8FA98A" },
  { to: "/uno/lobby", emoji: "🎴", name: "UNO", tint: "#E8A598" },
  { to: "/impostor/lobby", emoji: "🕵️", name: "Impostor WHO?", tint: "#C8A9D9" },
  { to: "/wheel/lobby", emoji: "🎡", name: "Wheel of Fortune", tint: "#F6EBD9" },
  { to: "/rebus/lobby", emoji: "🔤", name: "Type What You See", tint: "#A8C7D6" },
];

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ComingSoonPanel({ title, blurb, note }: { title: string; blurb: string; note: string }) {
  return (
    <section className="db-panel" aria-label={title}>
      <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div>
          <h2 className="t-h2" style={{ margin: 0 }}>
            {title}
          </h2>
          <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
            {blurb}
          </p>
        </div>
        <span className="badge badge-neutral">Coming soon</span>
      </div>
      <p className="t-body-sm text-muted" style={{ margin: "var(--space-3) 0 0" }}>
        {note}
      </p>
    </section>
  );
}

export default function HomePage() {
  const { profile } = useAuth();
  const { status, busy, error, claim } = useDailyCheckIn();
  const name = profile?.username ?? "";

  // Came back after a gap: the streak reset, but nothing earned is lost.
  const returning = !!status && !status.checked_in_today && status.current_streak === 0 && status.total_checkins > 0;
  const streak = status?.current_streak ?? 0;

  const title = returning ? "Your Seat's Still Here." : `${timeOfDayGreeting()}${name ? `, ${name}` : ""}.`;
  const body = returning
    ? `Welcome back${name ? `, ${name}` : ""}. Nothing you've earned was taken away while you were out.`
    : "Pick up wherever feels right.";
  const streakText = !status
    ? "…"
    : streak > 0
      ? `${streak} ${streak === 1 ? "day" : "days"}`
      : status.total_checkins === 0
        ? "starts today"
        : "fresh start";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page db-home">
        <section className="db-panel db-greeting" aria-labelledby="greeting">
          <div className="db-greeting__main">
            <h1 id="greeting" className="t-h1" style={{ margin: 0 }}>
              {title}
            </h1>
            <p className="t-subtitle text-muted" style={{ margin: 0 }}>
              {body}
            </p>
            <div className="db-chips">
              <span className="db-chip" role="img" aria-label={`Buddy Streak, ${streakText}`}>
                <PixelIcon name="buddy-streak" size={32} />
                {streakText}
              </span>
            </div>
          </div>
          <DailyCheckInCard status={status} busy={busy} error={error} onClaim={claim} />
        </section>

        <ActiveGameStatus />

        <div className="db-home-cols">
          <div className="db-home-main">
            <ComingSoonPanel
              title="My Desk"
              blurb="Your own little corner of DeskBuddies."
              note="Your desk and first companion will live here."
            />

            <section className="db-panel" id="reality-break" aria-labelledby="rb">
              <div className="row-between" style={{ alignItems: "baseline", gap: "var(--space-3)" }}>
                <div>
                  <h2 id="rb" className="t-h2" style={{ margin: 0 }}>
                    Reality Break
                  </h2>
                  <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
                    Your game nights, all in one place.
                  </p>
                </div>
                <Link to="/games" className="db-link">
                  See all games
                </Link>
              </div>
              <div className="db-games">
                {GAMES.map((g) => (
                  <Link key={g.to} to={g.to} className="db-game">
                    <span className="db-game__tile" aria-hidden="true" style={{ background: g.tint }}>
                      {g.emoji}
                    </span>
                    <span className="t-body-sm" style={{ fontWeight: 700 }}>
                      {g.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className="db-home-side">
            <ComingSoonPanel
              title="Today"
              blurb="A couple of good ways to spend it."
              note="Focus Blocks and the daily Brain Break are on their way."
            />
            <ComingSoonPanel
              title="Who's around"
              blurb="A little company while you work."
              note="This will show people in a Focus Block once those exist."
            />
          </div>
        </div>
      </main>
    </div>
  );
}
