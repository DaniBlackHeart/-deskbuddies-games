type Props = { onClose: () => void };

/** "How to play" for Five Tiles (the daily puzzle), opened from the ❓ Rules button on the play screen. */
export default function DailyPuzzleRulesModal({ onClose }: Props) {
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
        aria-labelledby="dp-rules-h"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 id="dp-rules-h" style={{ margin: 0 }}>How to play Five Tiles</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }} autoFocus>
            ✕
          </button>
        </div>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>Guess today's secret five-letter word. Everyone gets the same word.</li>
          <li>You have six guesses. Each guess must be a real English word.</li>
          <li>After each guess, every letter is marked:</li>
        </ul>
        <div className="dp-legend">
          <div><span className="dp-tile dp-tile--c" aria-hidden="true">A✓</span> Right letter, right spot.</div>
          <div><span className="dp-tile dp-tile--p" aria-hidden="true">A↔</span> In the word, but in a different spot.</div>
          <div><span className="dp-tile dp-tile--a" aria-hidden="true">A✕</span> Not in the word (or you've used up its copies).</div>
        </div>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>A word that isn't in our list doesn't use up a guess.</li>
          <li>One puzzle per day. If you leave halfway, it's saved and waiting for you.</li>
          <li>A new word arrives at midnight, Manila time. A puzzle left unfinished at midnight doesn't count and doesn't pay.</li>
          <li>Finishing earns Buddy XP and a few deskbits, solved or not. Solving earns more.</li>
        </ul>
      </div>
    </div>
  );
}
