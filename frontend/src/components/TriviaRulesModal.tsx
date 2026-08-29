type TriviaRulesModalProps = {
  onClose: () => void;
};

/**
 * Read-only "how to play" reference for Trivia Night, opened from a button
 * on the play screen. Written against THIS build's actual ruleset (see
 * supabase/functions/trivia-answer/index.ts and trivia-host/index.ts)
 * rather than generic trivia rules — the two things that most often
 * surprise people in testing are that answer speed never affects your
 * score despite being tracked, and that Hard mode's penalties are silent
 * unless you know to look for them.
 */
export default function TriviaRulesModal({ onClose }: TriviaRulesModalProps) {
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
    >
      <div
        className="card"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2 style={{ margin: 0 }}>How to play Trivia Night</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        <p className="text-muted">This table's actual scoring rules — a couple of these aren't what you'd expect.</p>

        <div className="stack">
          <section>
            <h3>Goal</h3>
            <p style={{ margin: 0 }}>
              A MOD runs through a set of questions one at a time. Answer each one before time runs out — most points at the
              end of the set wins. The MOD controls pacing (starting questions, ending them, moving to the next one), so
              you'll spend a moment on a "waiting for host" screen between questions.
            </p>
          </section>

          <section>
            <h3>Answering</h3>
            <p style={{ margin: 0 }}>
              Questions are either <strong>multiple choice</strong> (pick one of up to six options) or <strong>typed</strong>{" "}
              (type your answer). Once you lock in an answer, it's final — you can't change it. If you don't answer before
              the timer hits zero, that counts as a no-show.
            </p>
          </section>

          <section>
            <h3>Scoring</h3>
            <p style={{ margin: 0 }}>
              A correct answer earns that question's full point value — flat, every time. <strong>Answering faster doesn't
              earn you anything extra.</strong> This surprises people coming from other trivia apps: there's no speed bonus
              here, so there's no reason to rush a guess over a considered answer.
            </p>
          </section>

          <section>
            <h3>Chill mode vs. Hard mode</h3>
            <p style={{ margin: "0 0 8px" }}>
              The MOD picks one of these for the whole session, and it changes the risk profile a lot:
            </p>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "56px", justifyContent: "center" }}>Chill</span>
                <span>Zero risk. A wrong answer or a missed question simply earns 0 points — nothing is ever deducted.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "56px", justifyContent: "center" }}>Hard</span>
                <span>
                  A wrong answer costs points (shown on-screen as the exact deduction), and so does not answering at all —
                  a flat 25% of that question's value. Guessing wrong is worse than not guessing, but not answering still
                  isn't free.
                </span>
              </div>
            </div>
            <p className="text-muted" style={{ margin: "8px 0 0" }}>
              In Hard mode you'll see the exact math above each question (✅ / ❌ / ⌛) before you answer — Chill mode never
              shows it, because there's nothing to show.
            </p>
          </section>

          <section>
            <h3>Typed answers</h3>
            <p style={{ margin: 0 }}>
              Typed answers are checked case-insensitively and ignore extra spacing, accents, and punctuation — so "cafe",
              "Café", and "  cafe " all count the same. If what you typed doesn't match any accepted answer closely enough
              for the system to be sure, it goes to the MOD for a manual look rather than being auto-marked wrong — you'll
              see "⏳ being reviewed" while that's pending, which is normal and not a bug.
            </p>
          </section>

          <section>
            <h3>What the host controls</h3>
            <p style={{ margin: 0 }}>
              The MOD starts each question, ends it when time's up (or early), and moves to the next one — questions always
              move forward and can't be replayed. A MOD can also override any pending "under review" typed answer at any
              point, even after the reveal, so your score can still tick up after the fact.
            </p>
          </section>
        </div>

        <div className="row" style={{ marginTop: "20px", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
