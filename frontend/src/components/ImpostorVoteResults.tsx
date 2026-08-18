import type { ImpostorParticipant, ImpostorVoteTally } from "../types";

type ImpostorVoteResultsProps = {
  headline: string;
  roster: ImpostorParticipant[];
  tally: ImpostorVoteTally[];
  totalVotes: number;
  accusedUserId: string | null;
};

/**
 * The percentage-vote reveal — every player's share of the accusation
 * vote, sorted highest-suspected first. Uses whatever the server already
 * computed for resolution (impostor-play's resolveVote); this component
 * just turns counts into percentages and draws a bar. Anyone missing from
 * `tally` (nobody voted for them) renders at 0%, not omitted — the whole
 * point is every member gets to see where they landed, including "no one
 * suspected you at all."
 */
export default function ImpostorVoteResults({ headline, roster, tally, totalVotes, accusedUserId }: ImpostorVoteResultsProps) {
  const countFor = (userId: string) => tally.find((t) => t.user_id === userId)?.count ?? 0;
  const sorted = [...roster].sort((a, b) => countFor(b.user_id) - countFor(a.user_id));

  return (
    <div className="card impostor-vote-results">
      <p className="impostor-vote-results__headline">{headline}</p>
      <div className="stack">
        {sorted.map((p) => {
          const count = countFor(p.user_id);
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isAccused = p.user_id === accusedUserId;
          return (
            <div key={p.user_id}>
              <div className="row-between">
                <span>
                  {p.profiles?.username}
                  {isAccused ? " 🎯" : ""}
                </span>
                <span className="text-muted">
                  {pct}% ({count} vote{count === 1 ? "" : "s"})
                </span>
              </div>
              <div className="impostor-vote-results__bar-track">
                <div
                  className={`impostor-vote-results__bar ${isAccused ? "impostor-vote-results__bar--accused" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
