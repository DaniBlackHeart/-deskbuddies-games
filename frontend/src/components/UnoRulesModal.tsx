type UnoRulesModalProps = {
  onClose: () => void;
};

/**
 * Read-only "how to play" reference for UNO, opened from a button on the
 * play screen. Content is deliberately written against THIS build's actual
 * ruleset (see supabase/functions/uno-play/index.ts's top comment: official
 * rules + draw-stacking + jump-in + the 7-0 house rule + the Wild Draw Four
 * challenge) rather than generic UNO rules, since the two most common
 * points of confusion in testing were both house rules that don't exist in
 * a standard physical deck: the 0 (rotate everyone's hand, not just a
 * swap) and the Wild card's star icon.
 */
export default function UnoRulesModal({ onClose }: UnoRulesModalProps) {
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
          <h2 style={{ margin: 0 }}>How to play UNO</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        <p className="text-muted">This table's house rules — a few of these aren't in a standard deck.</p>

        <div className="stack">
          <section>
            <h3>Goal</h3>
            <p style={{ margin: 0 }}>Be the first to play every card in your hand. When you're down to one card, call UNO — or someone can catch you.</p>
          </section>

          <section>
            <h3>Playing a card</h3>
            <p style={{ margin: 0 }}>
              On your turn, play a card that matches the color <em>or</em> the number/symbol of the top card — or play a Wild card any time,
              regardless of color. Can't go? Tap <strong>Draw a card</strong>. If it's playable, you can play it right away; otherwise your turn passes.
            </p>
          </section>

          <section>
            <h3>Special cards</h3>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>⊘</span>
                <span><strong>Skip</strong> — the next player loses their turn.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>⇄</span>
                <span><strong>Reverse</strong> — play direction flips. With just two players, it acts like a Skip instead.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>+2</span>
                <span><strong>Draw Two</strong> — the next player draws 2 and loses their turn, unless they stack another Draw Two on it (see Stacking below).</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>★</span>
                <span><strong>Wild</strong> — play it on anything, then pick the new color.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>+4</span>
                <span><strong>Wild Draw Four</strong> — pick the new color, and the next player draws 4 and loses their turn, unless they stack another Wild Draw Four. It can also be challenged (see below).</span>
              </div>
            </div>
          </section>

          <section>
            <h3>The 7 and 0 (house rule)</h3>
            <p style={{ margin: "0 0 8px" }}>These two are this table's rule, not part of the base game — this is usually what catches people off guard:</p>
            <div className="stack" style={{ gap: "8px" }}>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>7</span>
                <span>Play it, then pick <strong>one player</strong> to swap your entire hand with.</span>
              </div>
              <div className="row" style={{ gap: "10px" }}>
                <span className="badge badge-neutral" style={{ minWidth: "42px", justifyContent: "center" }}>0</span>
                <span><strong>Everyone's</strong> hand rotates one seat in the current play direction — you'll get whichever hand was one seat behind you. This is why hands sometimes shuffle around the whole table at once.</span>
              </div>
            </div>
          </section>

          <section>
            <h3>Stacking</h3>
            <p style={{ margin: 0 }}>
              Facing a Draw Two? You can only counter with another Draw Two (the total stacks up). Facing a Wild Draw Four? Only another Wild
              Draw Four counters it. You can't mix the two — a Draw Two can't be answered with a Wild Draw Four, or vice versa.
            </p>
          </section>

          <section>
            <h3>Jumping in</h3>
            <p style={{ margin: 0 }}>
              If you're holding the <em>exact</em> same card as the top of the discard pile (same color and same number/symbol), you can play it
              the instant it appears — even if it isn't your turn. Play continues from right after you. Jump-ins aren't allowed while a Draw Two
              or Wild Draw Four is pending.
            </p>
          </section>

          <section>
            <h3>Calling UNO</h3>
            <p style={{ margin: 0 }}>
              Once you're about to play down to your last card, tap <strong>Call UNO</strong> before or as you play it. Forget, and any other
              player can hit <strong>Catch!</strong> on you — you'll draw 2 as a penalty.
            </p>
          </section>

          <section>
            <h3>Challenging a Wild Draw Four</h3>
            <p style={{ margin: 0 }}>
              Officially, a Wild Draw Four can only be played when you have no card matching the current color. If you're hit with one, you can
              tap <strong>Challenge</strong> instead of drawing. If the player who played it actually had a matching color in hand, they draw the
              4 instead of you. If they didn't, the challenge fails and you draw the 4 plus 2 more as a penalty.
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
