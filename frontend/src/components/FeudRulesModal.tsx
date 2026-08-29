type FeudRulesModalProps = {
  onClose: () => void;
};

/**
 * Read-only "how to play" reference for Family Feud, opened from a button
 * on the play screen. Written against THIS build's actual ruleset (see
 * supabase/functions/feud-play/index.ts and feud-host/index.ts) rather than
 * the TV show's rules from memory — this build has a real rebuttal step the
 * show doesn't, no point multiplier on later rounds, and a steal only needs
 * ANY remaining answer rather than specifically the top one, all of which
 * catch people off guard if they're expecting the broadcast version.
 */
export default function FeudRulesModal({ onClose }: FeudRulesModalProps) {
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
          <h2 style={{ margin: 0 }}>How to play Family Feud</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        <p className="text-muted">A few things here don't quite match the TV show — worth knowing before you buzz in.</p>

        <div className="stack">
          <section>
            <h3>Goal</h3>
            <p style={{ margin: 0 }}>
              Two teams, one survey board per round. Whichever team has more points when the MOD ends the main game wins
              and moves on to Fast Money. A tie goes to a tiebreaker round played the same way as any other round.
            </p>
          </section>

          <section>
            <h3>Face-off</h3>
            <p style={{ margin: 0 }}>
              One player from each team's line faces off each round (cycling through the line pair by pair, not always the
              same two people). Buzz in first, then you've got a few seconds to answer. Land the <strong>#1 answer</strong> and
              you win control outright.
            </p>
          </section>

          <section>
            <h3>The rebuttal (this table's twist)</h3>
            <p style={{ margin: 0 }}>
              Buzz in and land a correct answer that <em>isn't</em> the #1 one, and the other face-off player gets a
              rebuttal — one shot to beat it. Beat it and they take control instead. Miss, or run out of time, and the
              original buzzer keeps control by default ("Not beaten"). If both face-off players miss entirely, it moves to
              the next pair in line.
            </p>
          </section>

          <section>
            <h3>Play or pass</h3>
            <p style={{ margin: 0 }}>Whoever wins the face-off chooses to play the board themselves, or pass control to the other team.</p>
          </section>

          <section>
            <h3>Playing the board</h3>
            <p style={{ margin: 0 }}>
              The controlling team answers one at a time, turn passing to the next teammate in line after every answer —
              right or wrong. A wrong guess or a timeout is a <strong>strike</strong>. Three strikes hands the board over to
              a steal.
            </p>
          </section>

          <section>
            <h3>Stealing</h3>
            <p style={{ margin: 0 }}>
              The other team huddles (a live team chat only they can see) and then <strong>one player — whoever's first in
              their line — submits the team's final answer</strong>. You don't need the single highest remaining answer to
              steal, just <strong>any</strong> answer still left on the board. Guess right and your team takes the whole
              pot; guess wrong (or run out of time) and the controlling team keeps it. Either way, the full board is
              revealed once the steal resolves.
            </p>
          </section>

          <section>
            <h3>Scoring</h3>
            <p style={{ margin: 0 }}>
              Points come straight from the survey — highest-ranked answers are worth the most. <strong>No round is
              doubled or tripled</strong> here, including the tiebreaker — every round, including a tiebreaker, scores at
              face value.
            </p>
          </section>

          <section>
            <h3>Fast Money</h3>
            <p style={{ margin: 0 }}>
              Two players from the winning team play five questions each, one after the other — Player 1 gets a shared
              20 seconds for all five, Player 2 gets 25. Player 2 never sees Player 1's answers ahead of time, and if
              Player 2 types something that's basically the same answer as Player 1 already gave for that question, it's
              rejected on the spot — you'll need to try something else, rather than it just scoring zero like on the show.
              <strong> 200 combined points across both players wins the grand prize.</strong>
            </p>
          </section>

          <section>
            <h3>Answer matching</h3>
            <p style={{ margin: 0 }}>
              Answers are matched case-insensitively and ignore extra spacing, accents, and punctuation — but it's still
              looking for a real match (plus whatever alternate phrasings the MOD registered for that answer ahead of
              time), not a loose guess.
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
