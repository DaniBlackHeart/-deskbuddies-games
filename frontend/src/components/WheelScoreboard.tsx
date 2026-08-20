import type { WheelParticipant } from "../types";

type WheelScoreboardProps = {
  roster: WheelParticipant[];
  roundScores?: Record<string, number> | null;
  activeUserId?: string | null;
  lockedOutUserIds?: string[];
};

export default function WheelScoreboard({ roster, roundScores, activeUserId, lockedOutUserIds = [] }: WheelScoreboardProps) {
  const sorted = [...roster].sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="wheel-scoreboard">
      {sorted.map((p) => {
        const isActive = activeUserId === p.user_id;
        const isLocked = lockedOutUserIds.includes(p.user_id);
        return (
          <div
            key={p.user_id}
            className={`wheel-scoreboard__row ${isActive ? "wheel-scoreboard__row--active" : ""} ${isLocked ? "wheel-scoreboard__row--locked" : ""}`}
          >
            {p.profiles?.avatar_url && (
              <img src={p.profiles.avatar_url} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />
            )}
            <span className="wheel-scoreboard__name">
              {p.profiles?.username}
              {isActive && " 🎯"}
              {isLocked && " 🔒"}
            </span>
            {roundScores && (
              <span className="wheel-scoreboard__round">+{roundScores[p.user_id] ?? 0}</span>
            )}
            <span className="wheel-scoreboard__total">{p.total_points}</span>
          </div>
        );
      })}
    </div>
  );
}
