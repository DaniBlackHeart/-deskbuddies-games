import { useEffect, useState } from "react";
import { sounds } from "../lib/sounds";
import { WHEEL_WEDGE_LAYOUT, wedgeFillColor, wedgeShortLabel } from "../lib/wheelConstants";
import type { WheelWedge } from "../types";

type WheelSpinnerProps = {
  spinning: boolean;
  targetWedge?: WheelWedge | null;
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

/** Every wedge index in WHEEL_WEDGE_LAYOUT that matches the server's actual outcome (same type, and same value for point-bearing wedges). */
function findMatchingWedgeIndices(target: WheelWedge): number[] {
  return WHEEL_WEDGE_LAYOUT.reduce<number[]>((acc, w, i) => {
    if (w.type !== target.type) return acc;
    if ("value" in target && target.value !== undefined) {
      if (w.value === target.value) acc.push(i);
    } else {
      acc.push(i);
    }
    return acc;
  }, []);
}

/**
 * The rotation (always forward from `currentRotation`, plus a few full
 * visual spins) needed to land a wedge matching `target` directly under
 * the fixed pointer at the top. Picks randomly among any tied matches
 * (e.g. one of the four 500-point wedges) purely for variety — which
 * specific one doesn't matter, they're mechanically identical.
 */
function computeLandingRotation(currentRotation: number, target: WheelWedge | null | undefined): number {
  const extraSpins = 4 + Math.floor(Math.random() * 3);
  if (!target) {
    // No known outcome yet — spin decoratively rather than not at all.
    return currentRotation + extraSpins * 360 + Math.floor(Math.random() * 360);
  }
  const matches = findMatchingWedgeIndices(target);
  const pool = matches.length > 0 ? matches : WHEEL_WEDGE_LAYOUT.map((_, i) => i);
  const chosenIndex = pool[Math.floor(Math.random() * pool.length)];
  const midAngle = chosenIndex * WEDGE_ANGLE + WEDGE_ANGLE / 2;
  const targetMod360 = (360 - midAngle + 360) % 360; // rotation that puts this wedge's center at the top, under the pointer
  const currentMod360 = ((currentRotation % 360) + 360) % 360;
  let delta = targetMod360 - currentMod360;
  if (delta <= 0) delta += 360; // always spin forward, never snap backward
  return currentRotation + delta + extraSpins * 360;
}

/**
 * The 24 wedges shown match the server's real wedge table exactly
 * (WHEEL_WEDGE_LAYOUT mirrors _shared/utils.ts's WHEEL_WEDGES), and now
 * so does where it actually lands: once `spinning` flips true with a
 * `targetWedge` supplied, the rotation is computed to stop precisely on a
 * wedge matching that real outcome — not a random angle. If no
 * targetWedge is available yet, it falls back to a decorative random
 * spin rather than not spinning at all.
 */
export default function WheelSpinner({ spinning, targetWedge, resultLabel }: WheelSpinnerProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!spinning) return;
    sounds.wheelSpin();
    setRotation((r) => computeLandingRotation(r, targetWedge));
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
