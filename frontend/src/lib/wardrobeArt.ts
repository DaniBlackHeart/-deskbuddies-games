// Buddy wardrobe fitting (Desk Finds). The desk pictures are pre-drawn scenes (160x112), and a buddy
// there is smaller than the 32x32 sprite the item-art anchors were written for, so each buddy is
// fitted by hand to its scene. Coordinates are scene pixels. Only fitted buddies appear here; add a
// buddy only after checking it on the real picture, and add it to WARDROBE_BUDDIES on the server too.
// Placeholder art, in the colours of the Tiny scarf item (sage and cream stripes).

import type { Wear } from "./deskCatalog";

export type WearLayer = [fill: string, d: string][];
const OUT = "var(--spO,#4A3228)";
const SAGE = "#8FA98A";
const CREAM = "#F6EBD9";
const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h-${w}z`;

/** Paper Pal sits at x 123..138, y 11..32 in scene-paper.png; the mouth is rows 21-22. */
function paperScarf(): WearLayer {
  const stripes = (y: number, flip: boolean) => {
    let sage = "";
    let cream = "";
    for (let i = 0; i < 8; i++) {
      const on = (i % 2 === 0) !== flip;
      if (on) sage += rect(123 + i * 2, y, 2, 1);
      else cream += rect(123 + i * 2, y, 2, 1);
    }
    return { sage, cream };
  };
  const a = stripes(24, false);
  const b = stripes(25, false);
  return [
    [OUT, rect(122, 23, 18, 1) + rect(122, 24, 1, 2) + rect(139, 24, 1, 2) + rect(122, 26, 18, 1) + rect(133, 27, 1, 2) + rect(137, 27, 1, 2) + rect(133, 29, 5, 1)],
    [SAGE, a.sage + b.sage + rect(134, 27, 3, 1)],
    [CREAM, a.cream + b.cream + rect(134, 28, 3, 1)],
  ];
}

/** buddy id -> body slot -> the layers to draw over the scene. */
export function wearLayers(buddy: string, wear: Wear | undefined): WearLayer[] {
  const out: WearLayer[] = [];
  if (buddy === "paper" && wear?.scarf === "tiny_scarf") out.push(paperScarf());
  return out;
}

/** Buddies that can wear things (mirrors WARDROBE_BUDDIES on the server). */
export const WARDROBE_BUDDIES = ["paper"] as const;
