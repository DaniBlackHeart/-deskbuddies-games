import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ActiveGameStatus from "../components/ActiveGameStatus";
import DailyCheckInCard from "../components/DailyCheckInCard";
import PixelIcon from "../components/PixelIcon";
import ComingUpPanel from "../components/ComingUpPanel";
import HomeTodayPanel from "../components/HomeTodayPanel";
import WhosAroundPanel from "../components/WhosAroundPanel";
import { useAuth } from "../contexts/AuthContext";
import { useDailyCheckIn } from "../lib/useDailyCheckIn";
import { useMyDesk } from "../lib/useMyDesk";
import { buddyName } from "../lib/deskCatalog";

// Home answers three questions in about ten seconds: where am I (my desk),
// what can I do today, and who else is here. Layout follows the Debbie Home
// concept. Only real data is shown: the check-in and streak come from the
// server; Today runs a real Focus Block (Brain Break is a labelled placeholder
// until its puzzle exists); Who's around shows real Focus Block presence and
// Find a member. The six live games stay one tap away.

const GAMES = [
  { to: "/trivia", icon: "game-trivia" as const, name: "Trivia Night" },
  { to: "/feud/lobby", icon: "game-family-feud" as const, name: "Family Feud" },
  { to: "/uno/lobby", icon: "game-uno" as const, name: "UNO" },
  { to: "/impostor/lobby", icon: "game-impostor-who" as const, name: "Impostor WHO?" },
  { to: "/wheel/lobby", icon: "game-wheel-of-fortune" as const, name: "Wheel of Fortune" },
  { to: "/rebus/lobby", icon: "game-type-what-you-see" as const, name: "Type What You See" },
];

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function HomeDeskCard() {
  const { saved, loading } = useMyDesk();
  const names = saved.companions.map(buddyName);
  const scene = `/desk/scene-${saved.companions[0] ?? "none"}.png`;
  const line =
    names.length > 1
      ? `${names.join(" and ")} are keeping your seat.`
      : names.length === 1
        ? `${names[0]} is keeping your seat.`
        : "Your companion spot is waiting for your first buddy. Your first one is earned, not handed out.";
  return (
    <section className="db-panel db-home__desk md-home" aria-labelledby="home-desk">
      <div className="row-between" style={{ alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div>
          <h2 id="home-desk" className="t-h2" style={{ margin: 0 }}>
            My Desk
          </h2>
          <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
            Your own little corner of DeskBuddies.
          </p>
        </div>
        <div className="md-actions">
          <Link to="/my-desk?decorate=1" className="btn btn-secondary">
            Decorate
          </Link>
          <Link to="/my-desk" className="btn btn-primary">
            Open My Desk
          </Link>
        </div>
      </div>
      <div className="md-scene">
        <img
          src={scene}
          alt={loading ? "" : names.length ? `Your desk with ${names.join(" and ")} on the companion mat` : "Your desk with an empty spot for a companion"}
          width={160}
          height={112}
          className="md-scene__img"
        />
      </div>
      <div className="md-stage__bar">
        <p className="t-body-sm" style={{ margin: 0, flex: "1 1 320px", minWidth: 0 }}>
          {line}
        </p>
        <div role="group" aria-label="Change View" className="md-views__row">
          <button type="button" aria-pressed="true" className="md-seg md-seg--on">Desktop</button>
          <button type="button" aria-disabled="true" aria-label="Workspace, locked" className="md-seg md-seg--locked">🔒 Workspace</button>
          <button type="button" aria-disabled="true" aria-label="Room, locked" className="md-seg md-seg--locked">🔒 Room</button>
        </div>
      </div>
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

        <ComingUpPanel />

        <ActiveGameStatus />

        <div className="db-home-cols">
          <div className="db-home-main">
            <HomeDeskCard />

            <section className="db-panel db-home__rb" id="reality-break" aria-labelledby="rb">
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
                    <span className="db-game__tile" aria-hidden="true">
                      <PixelIcon name={g.icon} size={32} />
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
            <HomeTodayPanel className="db-home__today" />
            <WhosAroundPanel className="db-home__who" />
          </div>
        </div>
      </main>
    </div>
  );
}
