type WheelRulesModalProps = {
  onClose: () => void;
};

/**
 * Read-only "how to play" reference for Wheel of Fortune, opened from a
 * button on the play screen. Written against THIS build's actual ruleset
 * (see supabase/functions/wheel-play/index.ts and wheel-host/index.ts)
 * rather than the TV show's rules from memory — the things worth calling
 * out loudly are the blind pre-spin consonant guess (a real quirk of this
 * build, not the show), that team mode rotates its "rep" on every action
 * regardless of hit or miss, and the Wild Card / Mystery wedges' non-obvious
 * behavior. The hidden 40-second safety-net on the spin/buy/solve decision
 * is deliberately not surfaced here as a countdown — it's designed to be
 * invisible to a player who's actually there, so the rules just say there's
 * no time pressure on that choice.
 */
export default function WheelRulesModal({ onClose }: WheelRulesModalProps) {
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
          <h2 style={{ margin: 0 }}>How to play Wheel of Fortune</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        <p className="text-muted">Solo or team play, same board rules either way — here's exactly how a turn works.</p>

        <div className="stack">
          <section>
            <h3>Goal &amp; rounds</h3>
            <p style={{ margin: 0 }}>
              Solve word puzzles letter by letter across up to <strong>5 main rounds</strong>, plus a tiebreaker if
              needed and a <strong>Bonus Round</strong> for whoever's ahead at the end. Play is either solo (every
              player for themselves) or in teams, set up by the MOD before the game starts.
            </p>
          </section>

          <section>
            <h3>Buzzing in (the blind guess)</h3>
            <p style={{ margin: 0 }}>
              Each round opens with everyone racing to buzz in first. Whoever wins the buzz doesn't get to spin right
              away — they have to <strong>call one consonant blind</strong>, before seeing anything else about the
              board, for <strong>zero points</strong>. Guess right and you earn control and go straight to spinning.
              Guess wrong and you're <strong>locked out of that round entirely</strong> — you can't buzz in again
              until the next one. If everyone who buzzes in ends up locked out, the round can end with nobody ever
              spinning the wheel — that's a real possibility, not a bug.
            </p>
          </section>

          <section>
            <h3>Once someone has control</h3>
            <p style={{ margin: 0 }}>
              On your turn you choose: <strong>spin</strong> the wheel and call a consonant, <strong>buy a vowel</strong>,
              or <strong>solve</strong> the puzzle. There's no time pressure on making that choice — take the time you
              need. Once you act, though, the timer for that specific action (spinning, calling a letter, entering a
              solve guess) does apply.
            </p>
          </section>

          <section>
            <h3>What can happen on a spin</h3>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "84px", justifyContent: "center" }}>Points</span>
                <span>Call a consonant. In the puzzle, you earn that wedge's value for every occurrence and keep your turn. Not in the puzzle, control passes on.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "84px", justifyContent: "center" }}>Bankrupt</span>
                <span>Wipes your banked round score back to zero and passes control immediately — no letter call.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "84px", justifyContent: "center" }}>Lose a Turn</span>
                <span>Your round score is untouched, but control passes immediately — no letter call.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "84px", justifyContent: "center" }}>Wild Card</span>
                <span>
                  Banked for later — you can play it on a future turn (yours or, if you use it on someone else's,
                  theirs) to guarantee your next letter call hits. It doesn't reveal anything by itself; it just
                  guarantees the call that follows it.
                </span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "84px", justifyContent: "center" }}>Mystery</span>
                <span>
                  Hidden until you land on it and commit to a letter — could be a big point bonus or a Bankrupt in
                  disguise. You're calling a consonant blind to what's under it, same risk either way.
                </span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "84px", justifyContent: "center" }}>Free Play</span>
                <span>One consonant call that's protected from Bankrupt — a miss just passes control normally, no penalty.</span>
              </div>
            </div>
          </section>

          <section>
            <h3>Buying a vowel</h3>
            <p style={{ margin: 0 }}>
              Costs <strong>350 points</strong>, paid out of your current round score (you need at least that much
              banked to do it). It doesn't end your turn — hit or miss, you're still up after, same as any other
              action.
            </p>
          </section>

          <section>
            <h3>Solving</h3>
            <p style={{ margin: 0 }}>
              You can attempt to solve any time it's your turn to act. It needs to be an exact match for the full
              puzzle — close isn't good enough. Guess wrong and control passes on as normal.
            </p>
          </section>

          <section>
            <h3>Team play — the rep rotates every action</h3>
            <p style={{ margin: 0 }}>
              In team mode, one teammate ("the rep") acts on the team's behalf at a time, and that rep{" "}
              <strong>rotates to the next teammate after every single resolved action — hit or miss</strong>, not
              just on a miss like in solo play. So even a run of correct consonant calls in a row gets passed hand to
              hand around your team, rather than one player riding a hot streak the way a solo player can.
            </p>
          </section>

          <section>
            <h3>Tiebreaker — Do-or-Die</h3>
            <p style={{ margin: 0 }}>
              If the main rounds end tied, it goes to a Do-or-Die round: entrants get up to <strong>5 attempts</strong>{" "}
              each to solve. If it's still tied after that, the MOD picks the winner at random from whoever's still
              tied.
            </p>
          </section>

          <section>
            <h3>Bonus Round</h3>
            <p style={{ margin: 0 }}>
              Whoever's ahead at the end plays alone. You're given a category and the board already has{" "}
              <strong>R, S, T, L, N, E</strong> filled in for free, then you pick <strong>3 more consonants and 1
              more vowel</strong> before the puzzle is revealed. You get <strong>20 seconds</strong> to solve with
              those letters showing — there's a prize riding on it, but what it is stays hidden until you either
              solve it or run out of time.
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
