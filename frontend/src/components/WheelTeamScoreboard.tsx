import type { WheelTeam } from "../types";

type WheelTeamScoreboardProps = {
  teams: WheelTeam[];
  roundScores?: Record<string, number> | null;
  activeTeamId?: string | null;
  lockedOutTeamIds?: string[];
};

export default function WheelTeamScoreboard({ teams, roundScores, activeTeamId, lockedOutTeamIds = [] }: WheelTeamScoreboardProps) {
  const sorted = [...teams].sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="wheel-team-scoreboard">
      {sorted.map((t) => {
        const isActive = activeTeamId === t.id;
        const isLocked = lockedOutTeamIds.includes(t.id);
        const repUserId = t.members.find((m) => m.line_position === t.current_rep_index)?.user_id;
        return (
          <div key={t.id} className={`wheel-team-scoreboard__team ${isActive ? "wheel-team-scoreboard__team--active" : ""} ${isLocked ? "wheel-team-scoreboard__team--locked" : ""}`}>
            <div className="row-between">
              <span className="wheel-team-scoreboard__name">
                {t.name}
                {isActive && " 🎯"}
                {isLocked && " 🔒"}
              </span>
              <div className="row" style={{ gap: "8px" }}>
                {roundScores && <span className="wheel-scoreboard__round">+{roundScores[t.id] ?? 0}</span>}
                <span className="wheel-scoreboard__total">{t.total_points}</span>
              </div>
            </div>
            <div className="wheel-team-scoreboard__members">
              {t.members.map((m) => (
                <span key={m.user_id} className={`wheel-team-scoreboard__member ${m.user_id === repUserId ? "wheel-team-scoreboard__member--up" : ""}`}>
                  {m.user_id === repUserId && "▶ "}
                  {m.profiles?.username}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
