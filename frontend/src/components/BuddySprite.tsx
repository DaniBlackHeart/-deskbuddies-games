import { useMemo } from "react";
import { BUDDY_PAL, BUDDY_ROWS } from "../lib/buddyArt";

// A buddy drawn from its pixel grid. `found=false` draws a flat silhouette (shape only, no detail).
// Colours come from the page: the outline uses --bc-outline and the silhouette --bc-sil, so the
// sprite follows light and dark mode. Decorative: the page labels the buddy in text.

export default function BuddySprite({ id, found, size = 64 }: { id: string; found: boolean; size?: number }) {
  const paths = useMemo(() => {
    const rows = BUDDY_ROWS[id];
    if (!rows) return [];
    const by = new Map<string, string>();
    rows.forEach((row, y) => {
      let x = 0;
      while (x < 32) {
        const ch = row[x];
        if (ch === ".") { x++; continue; }
        let e = x;
        while (e < 32 && row[e] === ch) e++;
        const key = found ? ch : "sil";
        by.set(key, (by.get(key) ?? "") + `M${x} ${y}h${e - x}v1h-${e - x}z`);
        x = e;
      }
    });
    return [...by.entries()];
  }, [id, found]);

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true" focusable="false" style={{ display: "block", imageRendering: "pixelated" }}>
      {paths.map(([k, d]) => (
        <path key={k} d={d} fill={k === "sil" ? "var(--bc-sil)" : k === "#" ? "var(--bc-outline)" : BUDDY_PAL[k]} />
      ))}
    </svg>
  );
}
