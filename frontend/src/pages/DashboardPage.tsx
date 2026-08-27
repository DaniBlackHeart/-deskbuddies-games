import AppHeader from "../components/AppHeader";
import GameCard from "../components/GameCard";

export default function DashboardPage() {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <h1>Game Night</h1>
        <p className="text-muted">Pick a game to jump into.</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "16px",
            marginTop: "24px",
          }}
        >
          <GameCard
            to="/trivia"
            emoji="🧠"
            title="Trivia Night"
            description="Live-hosted trivia with a mix of multiple choice and typed answers."
          />
          <GameCard
            to="/feud/lobby"
            emoji="🎙️"
            title="Family Feud"
            description="Face-off, steal the board, and go for the Fast Money grand prize."
          />
          <GameCard
            to="/uno/lobby"
            emoji="🎴"
            title="UNO"
            description="Draw stacking, jump-in, and the Wild Draw Four challenge — up to 10 players."
          />
          <GameCard
            to="/impostor/lobby"
            emoji="🕵️"
            title="Impostor WHO?"
            description="Everyone gets a secret word except one Impostor. Give clues, then vote them out."
          />
          <GameCard
            to="/wheel/lobby"
            emoji="🎡"
            title="Wheel of Fortune"
            description="Buzz in, spin the wheel, call letters, and solve the puzzle — 5 rounds plus a Bonus Round."
          />
          <GameCard
            to="/rebus/lobby"
            emoji="🔤"
            title="Type What You See"
            description="Decode rebus puzzles under the clock — Warm-Up, two scored rounds, a head-to-head Sprint, and one Big Puzzle finale."
          />
        </div>
      </div>
    </div>
  );
}
