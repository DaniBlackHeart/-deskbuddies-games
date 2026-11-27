type Props = { onClose: () => void };

/** "How to play" for Minute Quiz (the daily trivia), opened from the ❓ Rules button on the play screen. */
export default function DailyTriviaRulesModal({ onClose }: Props) {
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
        aria-labelledby="dtr-rules-h"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 id="dtr-rules-h" style={{ margin: 0 }}>How to play Minute Quiz</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }} autoFocus>
            ✕
          </button>
        </div>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>The level (Easy, Medium or Hard) of the day's question is picked at random and is the same for everyone.</li>
          <li>One question a day, the same for everyone. You see it when you press Start.</li>
          <li>You have one minute from Start. The clock runs on our side, so closing the page doesn't pause it.</li>
          <li>Some questions are multiple choice: pick one, then lock it in. Others are typed: capital letters, accents and punctuation don't matter.</li>
          <li>You get one answer. Once you lock it in, it's final.</li>
          <li>A wrong answer, or running out of time, still earns Buddy XP and a few deskbits. A right answer earns more.</li>
          <li>A new question arrives at midnight, Manila time. A question left unfinished at midnight doesn't count and doesn't pay.</li>
        </ul>
      </div>
    </div>
  );
}
