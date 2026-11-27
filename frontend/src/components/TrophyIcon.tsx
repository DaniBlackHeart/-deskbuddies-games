import { TROPHIES, TROPHY_FINISH } from "../lib/trophyArt";

// Trophy cup for 1st, 2nd or 3rd place on Buddy Boards (icon set v1.8, proposed). Decorative:
// it always sits beside the place word ("1st"). Whole-number sizes only.
export default function TrophyIcon({ place, size = 32, className }: { place: 1 | 2 | 3; size?: 16 | 32 | 48 | 64; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={"finish-" + TROPHY_FINISH[place] + (className ? " " + className : "")}
    >
      {TROPHIES[place].map(([fill, d, opacity], i) => (
        <path key={i} d={d} style={{ fill }} fillOpacity={opacity} />
      ))}
    </svg>
  );
}
