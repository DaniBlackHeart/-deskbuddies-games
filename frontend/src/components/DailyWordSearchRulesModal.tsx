type Props = { onClose: () => void };

/** "How to play" for Word Hunt (the daily word search), opened from the ❓ Rules button on the play screen. */
export default function DailyWordSearchRulesModal({ onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61, 50, 41, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 50,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dwr-rules-h"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 id="dwr-rules-h" style={{ margin: 0 }}>How to play Word Hunt</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }} autoFocus>
            ✕
          </button>
        </div>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>Each day there is one 10×10 grid with 8 hidden words (4 to 8 letters). Everyone gets the same grid.</li>
          <li>Words run left to right, top to bottom, or diagonally down and to the right. Nothing runs backwards.</li>
          <li>Press Start to see the grid and the word list. You have five minutes. The clock runs on our side, so closing the page doesn't pause it.</li>
          <li>To mark a word, pick its first letter, then its last letter. Wrong picks cost nothing, so try as often as you like.</li>
          <li>Find all 8 for the full reward. Fastest solvers will be recognized later.</li>
          <li>If time runs out, or you press "Give up", the game ends as unsolved. You still earn Buddy XP and a few deskbits, and we show where the words were.</li>
          <li>A new grid arrives at midnight, Manila time. A grid left unfinished at midnight doesn't count and doesn't pay.</li>
        </ul>
      </div>
    </div>
  );
}
