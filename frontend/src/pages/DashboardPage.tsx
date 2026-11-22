import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ActiveGameStatus from "../components/ActiveGameStatus";
import PixelIcon, { type PixelIconName } from "../components/PixelIcon";
import { useAuth } from "../contexts/AuthContext";

// Reality Break (the /games route): the games, one tap away. Follows the "Debbie
// Reality Break" design, with the game icons from Game Icons v1.1. Only games
// that exist are listed. The board's Brain Breaks (daily puzzles), the two
// "coming later" games and the Game Nights card are not built yet, so they are
// not shown. Add a card here when a game ships (see claude/adding-a-new-game.md).

const GAMES: { to: string; icon: PixelIconName; name: string; blurb: string }[] = [
  { to: "/trivia", icon: "game-trivia", name: "Trivia Night", blurb: "Live-hosted trivia with a mix of multiple choice and typed answers." },
  { to: "/uno/lobby", icon: "game-uno", name: "UNO", blurb: "Classic card matching." },
  { to: "/feud/lobby", icon: "game-family-feud", name: "Family Feud", blurb: "Guess the most popular answers." },
  { to: "/impostor/lobby", icon: "game-impostor-who", name: "Impostor WHO?", blurb: "Work out who is bluffing." },
  { to: "/wheel/lobby", icon: "game-wheel-of-fortune", name: "Wheel of Fortune", blurb: "Spin and solve the phrase." },
  { to: "/rebus/lobby", icon: "game-type-what-you-see", name: "Type What You See", blurb: "Type it fast and get it right." },
];

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page rb-page" id="reality-break">
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Reality Break</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>
              Step away from the to-do list for a few minutes. Play something small, on your own or with company.
            </p>
          </div>
          {profile?.is_mod && (
            <Link to="/mod" className="btn btn-secondary btn-sm">
              🛠️ MOD Dashboard
            </Link>
          )}
        </div>

        <ActiveGameStatus />

        <section aria-labelledby="rb-games-h" className="rb-section">
          <div>
            <h2 className="t-h2" id="rb-games-h" style={{ margin: 0 }}>Games</h2>
            <p className="text-muted t-body" style={{ margin: "4px 0 0" }}>Play alone or with others.</p>
          </div>
          <div className="rb-grid">
            {GAMES.map((g) => (
              <article key={g.to} className="rb-card">
                <span className="rb-icon" aria-hidden="true">
                  <PixelIcon name={g.icon} size={64} />
                </span>
                <div className="rb-card__text">
                  <h3 className="rb-card__title">{g.name}</h3>
                  <p className="t-body text-muted" style={{ margin: 0 }}>{g.blurb}</p>
                </div>
                <span className="rb-tag">Live now</span>
                <Link to={g.to} className="rb-open" aria-label={`Open ${g.name}`}>
                  Open game
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
