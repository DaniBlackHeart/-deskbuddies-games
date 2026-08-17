import type { ImpostorClue, ImpostorParticipant } from "../types";

type ImpostorClueBoardProps = {
  clues: ImpostorClue[];
  roster: ImpostorParticipant[];
  currentTurnUserId: string | null;
};

/**
 * The public board every player sees at the top of the screen — every
 * clue given so far, grouped by round, so the group can reason about who
 * the impostor is. Clues accumulate across BOTH round-sets (rounds 1-4)
 * rather than resetting between them — a round-set 2 restart still wants
 * everything said in round-set 1 visible for comparison.
 */
export default function ImpostorClueBoard({ clues, roster, currentTurnUserId }: ImpostorClueBoardProps) {
  function usernameFor(userId: string): string {
    return roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  const rounds = Array.from(new Set(clues.map((c) => c.round_number))).sort((a, b) => a - b);

  if (rounds.length === 0) {
    return (
      <div className="impostor-board card card--tight">
        <p className="hint" style={{ margin: 0 }}>
          Clues will appear here as each player takes their turn.
        </p>
      </div>
    );
  }

  return (
    <div className="impostor-board card card--tight">
      {rounds.map((round) => (
        <div key={round} className="impostor-board__round">
          <p className="impostor-board__round-label">Round {round}</p>
          <div className="stack" style={{ marginTop: "4px" }}>
            {clues
              .filter((c) => c.round_number === round)
              .map((c) => (
                <div key={`${round}-${c.user_id}`} className="impostor-board__clue">
                  <strong>{usernameFor(c.user_id)}:</strong>{" "}
                  {c.timed_out ? <span className="text-muted">(didn't answer in time)</span> : <span>{c.clue_text}</span>}
                </div>
              ))}
          </div>
        </div>
      ))}
      {currentTurnUserId && (
        <p className="hint" style={{ marginTop: "8px", marginBottom: 0 }}>
          Waiting on <strong>{usernameFor(currentTurnUserId)}</strong>…
        </p>
      )}
    </div>
  );
}
