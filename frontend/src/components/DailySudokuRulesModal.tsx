type Props = { onClose: () => void };

/** "How to play" for Number Nook (the daily sudoku), opened from the ❓ Rules button on the play screen. */
export default function DailySudokuRulesModal({ onClose }: Props) {
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
        aria-labelledby="dsr-rules-h"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 id="dsr-rules-h" style={{ margin: 0 }}>How to play Number Nook</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }} autoFocus>
            ✕
          </button>
        </div>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>Fill the 9×9 grid so every row, every column and every 3×3 box has the numbers 1 to 9 once. Everyone gets the same grid each day.</li>
          <li>Press Start to see it. There's no time limit, but your solve time counts: the clock starts at Start and keeps running if you leave the page.</li>
          <li>Pick a cell, then a number. We check it right away. A wrong number isn't placed and counts as a mistake. A correct one stays put.</li>
          <li>You can make 4 mistakes. The 5th ends the game as unsolved.</li>
          <li>"Notes" mode lets you jot small candidate numbers in a cell. Notes stay on this screen only and aren't saved.</li>
          <li>Not feeling it? "Give up" ends today's game as unsolved.</li>
          <li>Solve it for the full reward. If you give up or run out of mistakes, you still earn Buddy XP and a few deskbits.</li>
          <li>A new grid arrives at midnight, Manila time. A grid left unfinished at midnight doesn't count and doesn't pay.</li>
        </ul>
      </div>
    </div>
  );
}
