type TeamScoreboardProps = {
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  highlightTeam?: "A" | "B" | null;
};

export default function TeamScoreboard({ teamAName, teamBName, teamAScore, teamBScore, highlightTeam }: TeamScoreboardProps) {
  return (
    <div className="feud-scoreboard">
      <div className={`feud-scoreboard__team ${highlightTeam === "A" ? "feud-scoreboard__team--active" : ""}`}>
        <span className="feud-scoreboard__name">{teamAName}</span>
        <span className="feud-scoreboard__score">{teamAScore}</span>
      </div>
      <div className="feud-scoreboard__vs">VS</div>
      <div className={`feud-scoreboard__team ${highlightTeam === "B" ? "feud-scoreboard__team--active" : ""}`}>
        <span className="feud-scoreboard__name">{teamBName}</span>
        <span className="feud-scoreboard__score">{teamBScore}</span>
      </div>
    </div>
  );
}
