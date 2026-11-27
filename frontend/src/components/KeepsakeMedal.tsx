import { MEDAL, MEDAL_GLYPHS } from "../lib/keepsakeArt";

// A round Keepsake medal in a step's finish. Wrap-free: the finish class sits on the
// svg itself so --mr (rim) and --mf (face) resolve. Whole-number sizes only.
export default function KeepsakeMedal({
  cardKey,
  tier,
  size = 32,
  className,
}: {
  cardKey: string;
  tier: string;
  size?: 16 | 32 | 48 | 64;
  className?: string;
}) {
  const art = MEDAL_GLYPHS[cardKey];
  if (!art) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={"finish-" + tier + (className ? " " + className : "")}
    >
      <path d={MEDAL.face} style={{ fill: "var(--mf)" }} />
      <path d={MEDAL.rim} style={{ fill: "var(--mr)" }} />
      <path d={art.accent} style={{ fill: "#B5573A" }} />
      <path d={art.glyph} style={{ fill: "var(--spO,#4A3228)" }} />
      <path d={MEDAL.outline} style={{ fill: "var(--spO,#4A3228)" }} />
    </svg>
  );
}
