type Props = { onClose: () => void };

/** "How to play" for Letter Shuffle (the daily anagram), opened from the ❓ Rules button on the play screen. */
export default function DailyAnagramRulesModal({ onClose }: Props) {
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
        aria-labelledby="dar-rules-h"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 id="dar-rules-h" style={{ margin: 0 }}>How to play Letter Shuffle</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }} autoFocus>
            ✕
          </button>
        </div>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>The level is picked at random each day and is the same for everyone: 7 letters is Easy, 8 is Medium, 9 is Hard.</li>
          <li>Each day there is one long word (7 to 9 letters) with its letters mixed up. Everyone gets the same one.</li>
          <li>Press Start to see it. You have four minutes to type the word. The clock runs on our side, so closing the page doesn't pause it.</li>
          <li>Guess as many times as you like. Only the word we picked counts, but every word we pick has no other word made from the same letters.</li>
          <li>"Shuffle tiles" only moves the tiles around on your screen to help you see new combinations.</li>
          <li>Solve it for the full reward. If time runs out, you still earn Buddy XP and a few deskbits.</li>
          <li>A new word arrives at midnight, Manila time. A word left unfinished at midnight doesn't count and doesn't pay.</li>
        </ul>
      </div>
    </div>
  );
}
