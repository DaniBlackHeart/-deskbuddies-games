import { useMemo } from "react";
import { HAIR_COLORS, SKIN, type AvatarParts } from "../lib/avatarCatalog";

// The avatar bust, drawn in code on a 32x32 pixel grid (concept art from the "Debbie My Avatar"
// design; not final art). It is built from part ids only, so the art can change later without
// touching what members have saved. Always decorative: pair it with text (the page's
// description, or the member's name). Sizes should be multiples of 32 so pixels stay crisp.
// The outline follows --spO, like the other pixel sprites, so it works in light and dark.

const OUT = "var(--spO,#4A3225)";
const BK: Record<string, string> = { cream: "#F3E6D2", sage: "#CFDCC4", terra: "#E8B9A3", night: "#2F3A5A", win: "#F6E7B0" };
const TOP: Record<string, string> = { tee: "#C8674A", collar: "#93B08A", hoodie: "#7FA277", cardi: "#D4A23F", knit: "#B8672F" };

type Grid = (string | null)[][];

function paint(d: AvatarParts, silhouette: boolean): Grid {
  const g: Grid = Array.from({ length: 32 }, () => new Array<string | null>(32).fill(null));
  const px = (x: number, y: number, c: string) => { if (x >= 0 && x < 32 && y >= 0 && y < 32) g[y][x] = c; };
  const rc = (x: number, y: number, w: number, h: number, c: string) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const blob = (x: number, y: number, w: number, h: number, c: string) => { rc(x - 1, y - 1, w + 2, h + 2, OUT); rc(x, y, w, h, c); };

  const skin = SKIN.find((s) => s.id === d.skin) ?? SKIN[2];
  const H = (HAIR_COLORS.find((h) => h.id === d.hairc) ?? HAIR_COLORS[1]).color;
  const S2 = skin.main;
  const S3 = skin.shade;

  if (!silhouette) rc(0, 0, 32, 32, BK[d.back] ?? BK.cream);
  if (!silhouette && d.frame !== "none") {
    const fc = d.frame === "gold" ? "#D4A23F" : "#C8674A";
    for (let i = 0; i < 32; i++) { px(i, 0, fc); px(i, 31, fc); px(0, i, fc); px(31, i, fc); px(i, 1, OUT); px(i, 30, OUT); px(1, i, OUT); px(30, i, OUT); }
  }
  // hair behind
  if (d.hair === "long") blob(8, 7, 16, 16, H);
  if (d.hair === "bob") blob(8, 7, 16, 9, H);
  if (d.hair === "curls") blob(7, 5, 18, 10, H);
  if (d.hair === "bun") blob(14, 1, 4, 4, H);
  // body
  const tc = TOP[d.top] ?? TOP.tee;
  blob(d.build === "masc" ? 4 : d.build === "fem" ? 7 : 5, 21, d.build === "masc" ? 24 : d.build === "fem" ? 18 : 22, 12, tc);
  if (d.top === "hoodie") { rc(12, 21, 8, 2, OUT); rc(14, 24, 1, 4, "#FFFAF0"); rc(17, 24, 1, 4, "#FFFAF0"); }
  if (d.top === "collar") { rc(12, 21, 3, 3, "#FFFAF0"); rc(17, 21, 3, 3, "#FFFAF0"); rc(15, 21, 2, 11, OUT); }
  if (d.top === "cardi") { rc(15, 21, 2, 11, OUT); rc(13, 25, 1, 1, "#FFFAF0"); rc(13, 28, 1, 1, "#FFFAF0"); rc(18, 25, 1, 1, "#FFFAF0"); rc(18, 28, 1, 1, "#FFFAF0"); }
  if (d.top === "knit") { for (let y = 23; y < 32; y += 3) rc(6, y, 20, 1, "#FFFAF0"); }
  if (d.top === "tee") rc(13, 21, 6, 1, S3);
  // neck and head
  if (d.build === "masc") blob(13, 17, 6, 5, S3); else blob(14, 17, 4, 5, S3);
  const HR: number[][] = d.build === "masc" ? [[10, 6, 12, 12]] : d.build === "fem" ? [[10, 6, 12, 10], [12, 15, 8, 3]] : [[10, 6, 12, 11], [11, 16, 10, 2]];
  HR.forEach((r) => rc(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2, OUT));
  HR.forEach((r) => rc(r[0], r[1], r[2], r[3], S2));
  rc(12, 16, 8, 1, S3);
  if (d.build === "fem") { px(12, 11, OUT); px(19, 11, OUT); }
  // face
  const E = OUT;
  if (d.face === "calm") { px(13, 12, E); px(18, 12, E); rc(15, 15, 2, 1, E); }
  if (d.face === "smile") { px(13, 12, E); px(18, 12, E); rc(14, 15, 4, 1, E); px(13, 14, E); px(18, 14, E); }
  if (d.face === "wink") { rc(12, 12, 2, 1, E); px(18, 12, E); px(18, 11, E); rc(14, 15, 4, 1, E); px(13, 14, E); px(18, 14, E); }
  if (d.face === "sleepy") { rc(12, 12, 3, 1, E); rc(17, 12, 3, 1, E); rc(15, 15, 2, 1, E); }
  // hair in front
  if (d.hair === "crop") { rc(10, 5, 12, 4, H); rc(9, 6, 1, 4, H); rc(22, 6, 1, 4, H); rc(10, 4, 12, 1, OUT); }
  if (d.hair === "bob") { rc(10, 5, 12, 4, H); rc(9, 6, 1, 9, H); rc(22, 6, 1, 9, H); rc(10, 4, 12, 1, OUT); }
  if (d.hair === "curls") { rc(9, 4, 14, 5, H); rc(8, 6, 1, 6, H); rc(23, 6, 1, 6, H); rc(11, 3, 4, 1, OUT); rc(17, 3, 4, 1, OUT); }
  if (d.hair === "bun") { rc(10, 5, 12, 4, H); rc(9, 6, 1, 4, H); rc(22, 6, 1, 4, H); rc(14, 2, 4, 3, H); }
  if (d.hair === "long") { rc(10, 5, 12, 4, H); rc(9, 6, 2, 14, H); rc(21, 6, 2, 14, H); rc(10, 4, 12, 1, OUT); }
  if (d.hair === "close") { rc(10, 6, 12, 2, H); rc(10, 5, 12, 1, OUT); }
  // eyewear
  if (d.eyes === "round" || d.eyes === "square") {
    const sq = d.eyes === "square";
    rc(11, 10, 5, sq ? 4 : 5, OUT); rc(12, 11, 3, sq ? 2 : 3, "#FFFAF0"); rc(16, 12, 2, 1, OUT);
    rc(17, 10, 5, sq ? 4 : 5, OUT); rc(18, 11, 3, sq ? 2 : 3, "#FFFAF0"); px(13, 12, E); px(19, 12, E);
  }
  if (d.eyes === "shades") { rc(11, 10, 5, 4, OUT); rc(17, 10, 5, 4, OUT); rc(16, 11, 1, 1, OUT); }
  // headwear
  if (d.head === "beanie") { rc(9, 3, 14, 6, "#B5573A"); rc(9, 8, 14, 2, "#9F4C35"); rc(9, 2, 14, 1, OUT); rc(14, 1, 4, 2, "#F2C75C"); rc(8, 3, 1, 7, OUT); rc(23, 3, 1, 7, OUT); }
  if (d.head === "cap") { rc(9, 4, 14, 5, "#6F8F67"); rc(9, 3, 14, 1, OUT); rc(9, 8, 17, 2, "#4D6B52"); rc(8, 4, 1, 6, OUT); rc(23, 4, 1, 5, OUT); }
  if (d.head === "scarf") { rc(9, 4, 14, 5, "#D4A23F"); rc(9, 3, 14, 1, OUT); rc(9, 9, 2, 8, "#D4A23F"); rc(21, 9, 2, 8, "#D4A23F"); rc(8, 4, 1, 13, OUT); rc(23, 4, 1, 13, OUT); rc(12, 6, 2, 1, "#FFFAF0"); rc(17, 6, 2, 1, "#FFFAF0"); }
  if (d.head === "bow") { rc(19, 3, 6, 4, "#C8674A"); rc(21, 4, 2, 2, "#F2C75C"); rc(19, 2, 6, 1, OUT); }
  if (d.head === "cozy") { rc(9, 2, 14, 7, "#E8B9A3"); rc(9, 1, 14, 1, OUT); rc(11, 0, 3, 2, "#E8B9A3"); rc(18, 0, 3, 2, "#E8B9A3"); }
  // accessory
  if (d.acc === "studs") { px(9, 14, "#F2C75C"); px(22, 14, "#F2C75C"); }
  if (d.acc === "pin") { rc(20, 24, 3, 3, "#F2C75C"); px(21, 25, OUT); }
  if (d.acc === "wrap") { rc(11, 20, 10, 3, "#C8674A"); rc(18, 22, 3, 5, "#C8674A"); rc(11, 19, 10, 1, OUT); }
  return g;
}

/** One path per colour, run-length encoded by row. */
function toPaths(g: Grid): Record<string, string> {
  const by: Record<string, string> = {};
  for (let y = 0; y < 32; y++) {
    let x = 0;
    while (x < 32) {
      const c = g[y][x];
      if (!c) { x++; continue; }
      let e = x;
      while (e < 32 && g[y][e] === c) e++;
      by[c] = (by[c] ?? "") + `M${x} ${y}h${e - x}v1h-${e - x}z`;
      x = e;
    }
  }
  return by;
}

export default function AvatarArt({
  parts,
  size = 64,
  silhouette = false,
  className,
}: {
  parts: AvatarParts;
  size?: 32 | 48 | 64 | 96 | 128 | 256;
  /** A plain shape, used for parts the member has not earned yet. */
  silhouette?: boolean;
  className?: string;
}) {
  const paths = useMemo(() => toPaths(paint(parts, silhouette)), [parts, silhouette]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", imageRendering: "pixelated" }}
    >
      {silhouette && <rect width="32" height="32" style={{ fill: "var(--color-surface-raised)" }} />}
      <g style={silhouette ? { opacity: 0.4 } : undefined}>
        {Object.keys(paths).map((c) => (
          <path key={c} d={paths[c]} style={{ fill: silhouette ? "var(--color-text-muted)" : c }} />
        ))}
      </g>
    </svg>
  );
}
