type RebusRulesModalProps = {
  onClose: () => void;
};

/**
 * Read-only "how to play" reference for Type What You See, opened from a
 * button on the play screen. Written against THIS build's actual ruleset
 * (see supabase/functions/rebus-play/index.ts, rebus-host/index.ts, and
 * frontend/src/utils/rebusPuzzleParser.ts) — the two things worth flagging
 * loudly are that the "speed bonus" isn't actually about speed (it's a flat
 * bonus on every correct answer), and that everyone answers each puzzle
 * independently rather than racing to buzz in first.
 */
export default function RebusRulesModal({ onClose }: RebusRulesModalProps) {
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
          <h2 style={{ margin: 0 }}>How to play Type What You See</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        <p className="text-muted">A puzzle appears, you type what it represents. Here's exactly how it's scored.</p>

        <div className="stack">
          <section>
            <h3>Goal &amp; flow</h3>
            <p style={{ margin: 0 }}>
              Puzzles run in order — Easy, then Medium, then Hard — everyone answering the same puzzle at the same time.
              After those, the MOD sets up a head-to-head <strong>Sprint Round</strong> between two players; whoever scores
              higher there goes on alone to solve the one <strong>Final Round</strong> puzzle. Most points across the whole
              session wins.
            </p>
          </section>

          <section>
            <h3>Answering</h3>
            <p style={{ margin: 0 }}>
              This isn't a buzz-in race — everyone types their own answer within the time limit, and everyone who gets it
              right gets credit, regardless of who typed fastest. Once you submit, that's locked in; you get one try per
              puzzle.
            </p>
          </section>

          <section>
            <h3>Scoring by difficulty</h3>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "64px", justifyContent: "center" }}>Easy</span>
                <span>200 pts, 10 seconds.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "64px", justifyContent: "center" }}>Medium</span>
                <span>400 pts, 15 seconds.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "64px", justifyContent: "center" }}>Hard</span>
                <span>500 pts, 15 seconds.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "64px", justifyContent: "center" }}>Final</span>
                <span>1000 pts, 30 seconds — solved by one finalist only (see below).</span>
              </div>
            </div>
            <p className="text-muted" style={{ margin: "8px 0 0" }}>
              Every correct answer in these rounds also gets a flat <strong>+300 bonus on top</strong> — despite the name,
              it's not actually about how fast you answered, it's just added to every correct answer the same.
            </p>
          </section>

          <section>
            <h3>Chill mode vs. Hard mode</h3>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "56px", justifyContent: "center" }}>Chill</span>
                <span>No penalty for a wrong answer or not answering at all — worst case, you just get 0.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "56px", justifyContent: "center" }}>Hard</span>
                <span>
                  A wrong answer costs points; not answering in time costs a flat 25% of that puzzle's value. The exact
                  numbers are shown above the puzzle before you answer.
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3>Sprint Round</h3>
            <p style={{ margin: 0 }}>
              Two players, chosen by the MOD, each get <strong>30 seconds</strong> to solve as many puzzles as they can
              from a shared pool of just 3 puzzles — flat 500 points per correct answer, no penalty for a miss. Clearing
              all 3 before time's up is normal, not a glitch — you'll just get a "pool cleared" message and wait out the
              clock. Nobody else, including spectators, can see the puzzle content during a Sprint turn — it stays fair for
              whoever plays it next.
            </p>
          </section>

          <section>
            <h3>Final Round</h3>
            <p style={{ margin: 0 }}>
              Whoever scored higher in the Sprint plays the Final Round alone (a tie means the MOD picks). The puzzle
              itself is drawn at random right when the round starts, so it's different from session to session even with
              the same puzzle sets loaded.
            </p>
          </section>

          <section>
            <h3>Answer matching</h3>
            <p style={{ margin: 0 }}>
              Checked case-insensitively, ignoring extra spacing, accents, and punctuation — and against every accepted
              phrasing the MOD registered for that puzzle, not just one exact string.
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
