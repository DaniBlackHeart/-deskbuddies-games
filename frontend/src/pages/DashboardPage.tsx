import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ActiveGameStatus from "../components/ActiveGameStatus";
import PixelIcon, { type PixelIconName } from "../components/PixelIcon";
import { useAuth } from "../contexts/AuthContext";

// Reality Break (the /games route): the games, one tap away. Follows the "Debbie
// Reality Break" design, with the game icons from Game Icons v1.1. Only the six
// games in GAMES exist. The Brain Breaks (daily puzzles) and the two "coming
// later" games have no mechanics yet, so their buttons are disabled and say so:
// nothing here counts, tracks or pays anything. When one ships, move it into
// GAMES (see claude/adding-a-new-game.md).

const GAMES: { to: string; icon: PixelIconName; name: string; blurb: string }[] = [
  { to: "/trivia", icon: "game-trivia", name: "Trivia Night", blurb: "Live-hosted trivia with a mix of multiple choice and typed answers." },
  { to: "/uno/lobby", icon: "game-uno", name: "UNO", blurb: "Classic card matching." },
  { to: "/feud/lobby", icon: "game-family-feud", name: "Family Feud", blurb: "Guess the most popular answers." },
  { to: "/impostor/lobby", icon: "game-impostor-who", name: "Impostor WHO?", blurb: "Work out who is bluffing." },
  { to: "/wheel/lobby", icon: "game-wheel-of-fortune", name: "Wheel of Fortune", blurb: "Spin and solve the phrase." },
  { to: "/rebus/lobby", icon: "game-type-what-you-see", name: "Type What You See", blurb: "Type it fast and get it right." },
];

const BRAIN_BREAKS: { icon: PixelIconName; name: string; blurb: string; tag: string }[] = [
  { icon: "game-daily-puzzle", name: "Daily Puzzle", blurb: "Guess today's five-letter word in six tries.", tag: "New" },
  { icon: "game-trivia", name: "Daily Trivia", blurb: "A fresh set of mixed questions every day.", tag: "Moves over from Trivia Night" },
  { icon: "game-daily-anagram", name: "Daily Anagram", blurb: "Unscramble today's word. Same word for everyone, any pace.", tag: "New" },
  { icon: "game-daily-sudoku", name: "Daily Sudoku", blurb: "One grid a day. Take as long as you like.", tag: "New" },
  { icon: "game-daily-word-search", name: "Daily Word Search", blurb: "Find today's hidden words. Fastest solvers get a mention later.", tag: "New" },
];

const LATER: { icon: PixelIconName; name: string; blurb: string }[] = [
  { icon: "game-in-between", name: "In Between", blurb: "A quick card game: will the next card land between the other two?" },
  { icon: "game-bomb-party", name: "Bomb Party", blurb: "Race to type a word before the bomb goes off." },
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

        <section aria-labelledby="rb-bb-h" className="rb-section">
          <div>
            <h2 className="t-h2" id="rb-bb-h" style={{ margin: 0 }}>Brain Breaks</h2>
            <p className="text-muted t-body" style={{ margin: "4px 0 0" }}>Small daily puzzles, played on your own.</p>
          </div>
          <div className="rb-grid">
            {BRAIN_BREAKS.map((g) => (
              <article key={g.name} className="rb-card">
                <span className="rb-icon" aria-hidden="true">
                  <PixelIcon name={g.icon} size={64} />
                </span>
                <div className="rb-card__text">
                  <h3 className="rb-card__title">{g.name}</h3>
                  <p className="t-body text-muted" style={{ margin: 0 }}>{g.blurb}</p>
                </div>
                <span className="rb-tag">{g.tag}</span>
                <button type="button" className="rb-open rb-open--off" aria-disabled="true">Coming soon</button>
              </article>
            ))}
          </div>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>
            Playing earns Buddy XP, win or lose. Practice rounds come later and don't earn extra.
          </p>
        </section>

        <section aria-labelledby="rb-games-h" className="rb-section">
          <div>
            <h2 className="t-h2" id="rb-games-h" style={{ margin: 0 }}>Games</h2>
            <p className="text-muted t-body" style={{ margin: "4px 0 0" }}>Play alone or with others. These are the games you already know, plus two on the way.</p>
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
            {LATER.map((g) => (
              <article key={g.name} className="rb-card rb-card--later">
                <span className="rb-icon" aria-hidden="true">
                  <PixelIcon name={g.icon} size={64} />
                </span>
                <div className="rb-card__text">
                  <h3 className="rb-card__title">{g.name}</h3>
                  <p className="t-body text-muted" style={{ margin: 0 }}>{g.blurb}</p>
                </div>
                <span className="rb-tag rb-tag--later">Coming later</span>
                <button type="button" className="rb-open rb-open--off" aria-disabled="true">Not ready yet</button>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="rb-gn-h" className="rb-later-note">
          <span className="rb-icon rb-icon--sm" aria-hidden="true">
            <PixelIcon name="reality-break" size={48} />
          </span>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <h2 className="t-h3" id="rb-gn-h" style={{ margin: 0 }}>Game Nights and finding players</h2>
            <p className="t-body text-muted" style={{ margin: "4px 0 0" }}>
              Hosted game nights and a way to find people to play with live in Buddy Clubs. Later.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
