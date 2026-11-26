import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PixelIcon, { type PixelIconName } from "../components/PixelIcon";
import { useAuth } from "../contexts/AuthContext";
import { GAME_CATALOG } from "../lib/gameCatalog";
import { useLiveGames } from "../lib/useLiveGames";

// Reality Break (the /games route): the games, one tap away. Follows the "Debbie
// Reality Break" design, with the game icons from Game Icons v1.1. Only the six
// games in GAMES exist. The Brain Breaks (daily puzzles) and the two "coming
// later" games have no mechanics yet, so their buttons are disabled and say so:
// nothing here counts, tracks or pays anything. When one ships, move it into
// GAMES (see claude/adding-a-new-game.md).

// The six live games come from GAME_CATALOG (lib/gameCatalog.ts). Every member can
// host one: one live session per game, so up to six can run at once, and each
// member can be in one game (hosting or playing) and watch one game at a time.

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
  const { games: live } = useLiveGames();

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
              MOD Dashboard
            </Link>
          )}
        </div>

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
            <p className="text-muted t-body" style={{ margin: "4px 0 0" }}>Open a game to join one that is running, watch it, or host your own. Each game runs one session at a time.</p>
          </div>
          <div className="rb-grid">
            {GAME_CATALOG.map((g) => {
              const row = (live ?? []).find((l) => l.game === g.key);
              return (
                <article key={g.key} className="rb-card">
                  <span className="rb-icon" aria-hidden="true">
                    <PixelIcon name={g.icon} size={64} />
                  </span>
                  <div className="rb-card__text">
                    <h3 className="rb-card__title">{g.title}</h3>
                    <p className="t-body text-muted" style={{ margin: 0 }}>{g.blurb}</p>
                  </div>
                  <span className="rb-tag">
                    {row
                      ? `${row.status === "lobby" ? "Lobby open" : "In progress"} · ${row.player_count} ${row.player_count === 1 ? "player" : "players"}${row.host_username ? ` · hosted by ${row.host_username}` : ""}`
                      : "Nobody's playing yet"}
                  </span>
                  <Link to={g.lobbyPath} className="rb-open" aria-label={`Open ${g.title}`}>
                    Open game
                  </Link>
                </article>
              );
            })}
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
