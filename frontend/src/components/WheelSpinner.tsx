import { useEffect, useState } from "react";
import { sounds } from "../lib/sounds";
import { WHEEL_WEDGE_LAYOUT, wedgeFillColor, wedgeShortLabel } from "../lib/wheelConstants";

type WheelSpinnerProps = {
  spinning: boolean;
  resultLabel?: string | null;
};

const SIZE = 390; // 1.5x the original 260 — bumped up after playtesting felt it read too small
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 9;
const WEDGE_COUNT = WHEEL_WEDGE_LAYOUT.length;
const WEDGE_ANGLE = 360 / WEDGE_COUNT;
// Font/stroke sizes as ratios of SIZE (matching the original 260px design)
// rather than fixed numbers, so they scale proportionally with the wheel
// instead of looking undersized against bigger wedges.
const SPECIAL_FONT_SIZE = SIZE * (7 / 260);
const POINTS_FONT_SIZE = SIZE * (11 / 260);
const WEDGE_STROKE_WIDTH = SIZE * (1.5 / 260);
const RIM_STROKE_WIDTH = SIZE * (3 / 260);

function polarToCartesian(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function wedgePath(startAngle: number, endAngle: number) {
  const start = polarToCartesian(endAngle, RADIUS);
  const end = polarToCartesian(startAngle, RADIUS);
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 0 ${end.x} ${end.y} Z`;
}

/**
 * Purely decorative — the actual wedge outcome comes from the server's
 * spin result (see wheel-play's `spin` action), not from where this
 * graphic visually lands. It just spins a few full turns to a random
 * angle whenever `spinning` flips true, which is enough for the "ooh a
 * wheel!" effect without needing pixel-perfect wedge-index math synced
 * between client and server. The 24 wedges shown do match the server's
 * real wedge table (WHEEL_WEDGE_LAYOUT, mirroring _shared/utils.ts) so
 * what's printed on it is honest, even though which one it stops on isn't
 * the real outcome.
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
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%">
          {WHEEL_WEDGE_LAYOUT.map((wedge, i) => {
            const startAngle = i * WEDGE_ANGLE;
            const endAngle = startAngle + WEDGE_ANGLE;
            const midAngle = startAngle + WEDGE_ANGLE / 2;
            const labelPos = polarToCartesian(midAngle, RADIUS * 0.68);
            // Align the label along the radius (so it reads vertically at
            // the top/bottom of the wheel and horizontally at the sides,
            // like a real prize wheel) rather than along the tangent.
            // SVG's unrotated text points along "my angle 90°" (to the
            // right), so subtract 90 to redirect it along this wedge's
            // own radius, then flip 180° wherever that would otherwise
            // render upside-down for a viewer.
            const radialAngle = ((midAngle - 90 + 360) % 360);
            const textRotation = radialAngle > 90 && radialAngle < 270 ? radialAngle + 180 : radialAngle;
            const label = wedgeShortLabel(wedge);
            const isSpecial = wedge.type !== "points";
            return (
              <g key={i}>
                <path d={wedgePath(startAngle, endAngle)} fill={wedgeFillColor(wedge, i)} stroke="#fffaf3" strokeWidth={WEDGE_STROKE_WIDTH} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#fffaf3"
                  fontSize={isSpecial ? SPECIAL_FONT_SIZE : POINTS_FONT_SIZE}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textRotation}, ${labelPos.x}, ${labelPos.y})`}
                >
                  {label}
                </text>
              </g>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#fffaf3" strokeWidth={RIM_STROKE_WIDTH} />
        </svg>
        <div className="wheel-spinner__hub">🎡</div>
      </div>
      {resultLabel && !spinning && <div className="wheel-spinner__result">{resultLabel}</div>}
    </div>
  );
}
