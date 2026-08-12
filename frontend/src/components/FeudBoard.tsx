import type { PublicBoardSlot } from "../types";

type FeudBoardProps = {
  board: PublicBoardSlot[];
  pointsPot?: number;
};

export default function FeudBoard({ board, pointsPot }: FeudBoardProps) {
  return (
    <div>
      <div className="feud-board">
        {board.map((slot, i) => (
          <div key={i} className={`feud-cell ${slot.revealed ? "feud-cell--revealed" : ""}`}>
            {slot.revealed ? (
              <>
                <span className="feud-cell__text">{slot.text}</span>
                <span className="feud-cell__points">{slot.points}</span>
              </>
            ) : (
              <span className="feud-cell__number">{i + 1}</span>
            )}
          </div>
        ))}
      </div>
      {pointsPot !== undefined && (
        <div className="text-center" style={{ marginTop: "12px" }}>
          <span className="feud-pot">🏆 {pointsPot} pts in play</span>
        </div>
      )}
    </div>
  );
}
