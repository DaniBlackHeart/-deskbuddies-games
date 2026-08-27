import type { RebusTeamLeaderboardEntry } from "../types";

// A simple ranked team list — like Leaderboard.tsx but for team_id/name
// entries instead of individual users. Family Feud's TeamScoreboard is a
// fixed A-vs-B layout and doesn't generalize to Rebus's N self-selected
// teams, so this is its own small component rather than a reuse.
export default function RebusTeamLeaderboard({
  entries,
  highlightTeamId,
}: {
  entries: RebusTeamLeaderboardEntry[];
  highlightTeamId?: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-muted text-center">No teams yet.</p>;
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="stack" style={{ marginTop: 0 }}>
      {entries.map((entry) => {
        const isMine = entry.team_id === highlightTeamId;
        return (
          <div
            key={entry.team_id}
            className="row-between"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: isMine ? "var(--color-primary-soft)" : "var(--color-bg-alt)",
              marginTop: "8px",
            }}
          >
            <div className="row" style={{ gap: "10px" }}>
              <strong style={{ width: "28px" }}>{medals[entry.rank - 1] ?? `#${entry.rank}`}</strong>
              <span>{entry.name}</span>
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
