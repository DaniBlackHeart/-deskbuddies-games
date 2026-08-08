import type { LeaderboardEntry } from "../types";

export default function Leaderboard({
  entries,
  highlightUserId,
}: {
  entries: LeaderboardEntry[];
  highlightUserId?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-muted text-center">No scores yet.</p>;
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="stack" style={{ marginTop: 0 }}>
      {entries.map((entry) => {
        const isMe = entry.user_id === highlightUserId;
        return (
          <div
            key={entry.user_id}
            className="row-between"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: isMe ? "var(--color-primary-soft)" : "var(--color-bg-alt)",
              marginTop: "8px",
            }}
          >
            <div className="row" style={{ gap: "10px" }}>
              <strong style={{ width: "28px" }}>
                {medals[entry.rank - 1] ?? `#${entry.rank}`}
              </strong>
              {entry.avatar_url && (
                <img
                  src={entry.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  style={{ borderRadius: "50%" }}
                />
              )}
              <span>{entry.username}</span>
            </div>
            <strong style={{ color: entry.total_points < 0 ? "var(--color-danger)" : undefined }}>
              {entry.total_points} pts
            </strong>
          </div>
        );
      })}
    </div>
  );
}
