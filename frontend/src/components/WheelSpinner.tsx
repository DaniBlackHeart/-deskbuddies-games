import { useEffect, useState } from "react";
import { sounds } from "../lib/sounds";

type WheelSpinnerProps = {
  spinning: boolean;
  resultLabel?: string | null;
};

/**
 * Purely decorative — the actual wedge outcome comes from the server's
 * spin result (see wheel-play's `spin` action), not from where this
 * graphic visually lands. It just spins a few full turns to a random
 * angle whenever `spinning` flips true, which is enough for the "ooh a
 * wheel!" effect without needing pixel-perfect wedge-index math synced
 * between client and server.
 */
export default function WheelSpinner({ spinning, resultLabel }: WheelSpinnerProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!spinning) return;
    sounds.wheelSpin();
    const extraTurns = 4 + Math.floor(Math.random() * 3);
    const offset = Math.floor(Math.random() * 360);
    setRotation((r) => r + extraTurns * 360 + offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  return (
    <div className="wheel-spinner-wrap">
      <div className="wheel-spinner__pointer">▼</div>
      <div className="wheel-spinner" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="wheel-spinner__hub">🎡</div>
      </div>
      {resultLabel && !spinning && <div className="wheel-spinner__result">{resultLabel}</div>}
    </div>
  );
}
