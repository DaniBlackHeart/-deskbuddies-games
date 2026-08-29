type ImpostorRulesModalProps = {
  onClose: () => void;
};

/**
 * Read-only "how to play" reference for Impostor WHO?, opened from a button
 * on the play screen. Written against THIS build's actual ruleset (see
 * supabase/functions/impostor-play/index.ts and impostor-host/index.ts)
 * rather than a generic social-deduction rule set — the two things worth
 * calling out loudly are that there's no "impostor guesses the word to
 * survive" comeback mechanic in this build, and that an inconclusive vote
 * (a tie counts) helps the impostor, not the crew.
 */
export default function ImpostorRulesModal({ onClose }: ImpostorRulesModalProps) {
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
          <h2 style={{ margin: 0 }}>How to play Impostor WHO?</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        <p className="text-muted">Needs 3+ players to start. Here's exactly how this table's version works.</p>

        <div className="stack">
          <section>
            <h3>Setup</h3>
            <p style={{ margin: 0 }}>
              One random player is secretly the <strong>Impostor</strong> — everyone else ("crew") sees a category and a
              real secret word. The Impostor sees only the category and a vague clue about the word (or just the category,
              if the MOD didn't write one for that word) — never the word itself.
            </p>
          </section>

          <section>
            <h3>Giving clues</h3>
            <p style={{ margin: 0 }}>
              Going around the table, each player types a short clue about the word — without saying it outright. You've
              got 45 seconds per turn; run out and an empty clue is recorded for you and play moves on. Every clue anyone
              gives is visible to the whole table the entire game, so you can look back at what's been said. Crew members
              are hinting at a word they actually know; the Impostor is bluffing from the category (and maybe a vague
              clue) alone — the goal is to sound like you know it either way.
            </p>
          </section>

          <section>
            <h3>Voting</h3>
            <p style={{ margin: 0 }}>
              After two rounds of clues, everyone votes for who they think the Impostor is (you can't vote for yourself) —
              40 seconds, votes stay secret until the window closes. Whoever gets the <strong>most</strong> votes is
              accused, but only if there's a clear single leader — a tie between two or more suspects means nobody's
              accused.
            </p>
          </section>

          <section>
            <h3>How the game actually ends</h3>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "56px", justifyContent: "center" }}>Crew</span>
                <span>Wins the instant the real Impostor is the clear top vote-getter, in either vote.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "56px", justifyContent: "center" }}>Impostor</span>
                <span>
                  Wins by default if the <em>second</em> (final) vote is anything other than a clean correct accusation —
                  including a tie, a wrong guess, or people not voting.
                </span>
              </div>
            </div>
            <p className="text-muted" style={{ margin: "8px 0 0" }}>
              If the <em>first</em> vote doesn't land cleanly on the Impostor, the game doesn't end — it goes to a second
              set of clue rounds (started by a new random crew member) and a final vote, which is the one that actually
              settles things. <strong>There's no way for the Impostor to save themselves by guessing the secret word</strong>{" "}
              once accused — getting correctly named is an immediate loss for them, full stop.
            </p>
          </section>

          <section>
            <h3>At the end</h3>
            <p style={{ margin: 0 }}>
              Everyone sees who the Impostor really was and what the secret word actually was — and the full vote
              breakdown from every round stays visible on the end screen.
            </p>
          </section>

          <section>
            <h3>Scoring</h3>
            <p style={{ margin: 0 }}>
              There isn't any — no points carry over between games. Each session is its own self-contained round of crew
              vs. Impostor.
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
