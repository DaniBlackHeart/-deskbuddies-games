// Debbie icon set v1 (LOCKED) — see project doc Debbie_Icon_Set_v1_LOCKED.md.
// Do not edit icons in place; propose changes as v1.1.
//
// 16x16 grid, whole-number sizes only (16, 32, 48, 64), crisp edges. Always
// render beside a visible label (the SVG is decorative). Inlined, not <img>,
// so currentColor and the --ifill / --iacc / --spO tokens work in both themes.
// Only the icons the app uses so far are included; add the rest from the doc
// as screens need them. Sprites (deskbits, Buddy XP, Buddy Level, Buddy Streak)
// keep fixed colours; their outline follows --spO.

type Layer = [fill: string, d: string];

const LINE = "currentColor";
const FILL = "var(--ifill,#F3E6D2)";
const ACC = "var(--iacc,#B5573A)";

const ICONS = {
  // ---- navigation (two-tone: lines, soft fill, accent) ----
  home: [
    [LINE, "M7 1h2v1h-2zM6 2h4v1h-4zM5 3h2v1h-2zM9 3h2v1h-2zM4 4h2v1h-2zM10 4h2v1h-2zM3 5h2v1h-2zM11 5h2v1h-2zM2 6h2v1h-2zM12 6h2v1h-2zM1 7h14v1h-14zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM3 13h10v1h-10z"],
    [FILL, "M4 8h8v1h-8zM4 9h8v1h-8zM4 10h2v1h-2zM10 10h2v1h-2zM4 11h2v1h-2zM10 11h2v1h-2zM4 12h2v1h-2zM10 12h2v1h-2z"],
    [ACC, "M6 10h4v1h-4zM6 11h4v1h-4zM6 12h4v1h-4z"],
  ],
  "reality-break": [
    [LINE, "M3 2h10v1h-10zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h10v1h-10z"],
    [FILL, "M3 3h10v1h-10zM3 4h1v1h-1zM6 4h4v1h-4zM12 4h1v1h-1zM3 5h1v1h-1zM6 5h4v1h-4zM12 5h1v1h-1zM3 6h10v1h-10zM3 7h4v1h-4zM9 7h4v1h-4zM3 8h4v1h-4zM9 8h4v1h-4zM3 9h10v1h-10zM3 10h1v1h-1zM6 10h4v1h-4zM12 10h1v1h-1zM3 11h1v1h-1zM6 11h4v1h-4zM12 11h1v1h-1zM3 12h10v1h-10z"],
    [ACC, "M4 4h2v1h-2zM10 4h2v1h-2zM4 5h2v1h-2zM10 5h2v1h-2zM7 7h2v1h-2zM7 8h2v1h-2zM4 10h2v1h-2zM10 10h2v1h-2zM4 11h2v1h-2zM10 11h2v1h-2z"],
  ],
  "buddy-boards": [
    [LINE, "M6 6h4v1h-4zM6 7h1v1h-1zM9 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM1 9h4v1h-4zM6 9h1v1h-1zM9 9h1v1h-1zM1 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM11 10h4v1h-4zM1 11h1v1h-1zM4 11h1v1h-1zM6 11h1v1h-1zM9 11h1v1h-1zM11 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM11 12h1v1h-1zM14 12h1v1h-1zM1 13h1v1h-1zM4 13h1v1h-1zM6 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM1 14h4v1h-4zM6 14h4v1h-4zM11 14h4v1h-4z"],
    [FILL, "M7 7h2v1h-2zM7 8h2v1h-2zM7 9h2v1h-2zM2 10h2v1h-2zM7 10h2v1h-2zM2 11h2v1h-2zM7 11h2v1h-2zM12 11h2v1h-2zM2 12h2v1h-2zM7 12h2v1h-2zM12 12h2v1h-2zM2 13h2v1h-2zM7 13h2v1h-2zM12 13h2v1h-2z"],
    [ACC, "M7 1h2v1h-2zM6 2h4v1h-4zM7 3h2v1h-2zM7 4h2v1h-2z"],
  ],
  "buddy-calendar": [
    [LINE, "M4 1h1v1h-1zM11 1h1v1h-1zM4 2h1v1h-1zM11 2h1v1h-1zM1 3h14v1h-14zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM4 11h1v1h-1zM6 11h1v1h-1zM10 11h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM14 12h1v1h-1zM1 13h1v1h-1zM14 13h1v1h-1zM1 14h14v1h-14z"],
    [FILL, "M2 6h12v1h-12zM2 7h12v1h-12zM2 8h2v1h-2zM5 8h1v1h-1zM7 8h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM13 8h1v1h-1zM2 9h12v1h-12zM2 10h6v1h-6zM10 10h4v1h-4zM2 11h2v1h-2zM5 11h1v1h-1zM7 11h1v1h-1zM11 11h1v1h-1zM13 11h1v1h-1zM2 12h12v1h-12zM2 13h12v1h-12z"],
    [ACC, "M2 4h12v1h-12zM2 5h12v1h-12zM8 10h2v1h-2zM8 11h2v1h-2z"],
  ],
  "desk-finds": [
    [LINE, "M2 1h12v1h-12zM2 2h1v1h-1zM13 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h12v1h-12zM3 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h10v1h-10zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM3 13h10v1h-10z"],
    [FILL, "M5 2h2v1h-2zM9 2h2v1h-2zM5 3h2v1h-2zM9 3h2v1h-2zM4 5h8v1h-8zM4 6h8v1h-8zM4 7h1v1h-1zM7 7h2v1h-2zM11 7h1v1h-1zM4 8h1v1h-1zM7 8h2v1h-2zM11 8h1v1h-1zM4 10h8v1h-8zM4 11h8v1h-8zM4 12h8v1h-8z"],
    [ACC, "M3 2h2v1h-2zM7 2h2v1h-2zM11 2h2v1h-2zM3 3h2v1h-2zM7 3h2v1h-2zM11 3h2v1h-2zM5 7h2v1h-2zM9 7h2v1h-2zM5 8h2v1h-2zM9 8h2v1h-2z"],
  ],
  // ---- sprite (fixed colours; outline follows --spO) ----
  "buddy-streak": [
    ["var(--spO,#4A3228)", "M7 3h2v1h-2zM7 4h2v1h-2zM6 5h1v1h-1zM9 5h1v1h-1zM5 6h1v1h-1zM10 6h1v1h-1zM4 7h1v1h-1zM11 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM5 14h2v1h-2zM9 14h2v1h-2zM7 15h2v1h-2z"],
    ["#D9774F", "M7 5h2v1h-2zM6 6h4v1h-4zM5 7h2v1h-2zM9 7h2v1h-2zM4 8h3v1h-3zM4 9h2v1h-2zM4 10h2v1h-2zM4 11h1v1h-1zM4 12h1v1h-1zM5 13h1v1h-1zM7 14h2v1h-2z"],
    ["#F2C766", "M7 7h2v1h-2zM7 8h2v1h-2zM6 9h4v1h-4zM6 10h4v1h-4zM5 11h6v1h-6zM5 12h6v1h-6zM6 13h4v1h-4z"],
    ["#B5573A", "M9 8h3v1h-3zM10 9h2v1h-2zM10 10h2v1h-2zM11 11h1v1h-1zM11 12h1v1h-1zM10 13h1v1h-1z"],
  ],
  deskbits: [
    ["var(--spO,#4A3228)", "M6 1h4v1h-4zM4 2h1v1h-1zM10 2h2v1h-2zM12 3h1v1h-1zM13 4h1v1h-1zM13 5h1v1h-1zM1 6h1v1h-1zM6 6h2v1h-2zM14 6h1v1h-1zM1 7h1v1h-1zM6 7h2v1h-2zM14 7h1v1h-1zM1 8h1v1h-1zM8 8h2v1h-2zM14 8h1v1h-1zM1 9h1v1h-1zM8 9h2v1h-2zM14 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM4 13h2v1h-2zM10 13h2v1h-2zM6 14h4v1h-4z"],
    ["#F2C766", "M8 2h2v1h-2zM5 3h6v1h-6zM4 4h8v1h-8zM3 5h10v1h-10zM2 6h4v1h-4zM8 6h5v1h-5zM2 7h4v1h-4zM8 7h5v1h-5zM2 8h6v1h-6zM10 8h3v1h-3zM2 9h6v1h-6zM10 9h3v1h-3zM3 10h10v1h-10zM4 11h8v1h-8zM5 12h6v1h-6zM6 13h4v1h-4z"],
    ["#FFF0C2", "M5 2h3v1h-3zM3 3h2v1h-2zM2 4h2v1h-2zM2 5h1v1h-1z"],
    ["#D9A13B", "M11 3h1v1h-1zM12 4h1v1h-1zM13 6h1v1h-1zM13 7h1v1h-1zM13 8h1v1h-1zM13 9h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM4 12h1v1h-1zM11 12h1v1h-1z"],
  ],
  "buddy-xp": [
    ["var(--spO,#4A3228)", "M7 1h2v1h-2zM7 2h2v1h-2zM6 3h1v1h-1zM9 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM4 5h1v1h-1zM11 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM1 7h2v1h-2zM13 7h2v1h-2zM1 8h2v1h-2zM13 8h2v1h-2zM3 9h1v1h-1zM12 9h1v1h-1zM4 10h1v1h-1zM11 10h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM7 13h2v1h-2zM7 14h2v1h-2z"],
    ["#8FA98A", "M8 3h1v1h-1zM8 4h2v1h-2zM8 5h3v1h-3zM7 6h3v1h-3zM6 7h3v1h-3zM3 8h5v1h-5zM4 9h3v1h-3zM5 10h1v1h-1z"],
    ["#D3E3CC", "M7 3h1v1h-1zM6 4h2v1h-2zM5 5h3v1h-3zM4 6h3v1h-3zM3 7h3v1h-3z"],
    ["#6B8A66", "M10 6h2v1h-2zM9 7h4v1h-4zM8 8h5v1h-5zM7 9h5v1h-5zM6 10h5v1h-5zM6 11h4v1h-4zM7 12h2v1h-2z"],
  ],
  "buddy-level": [
    ["var(--spO,#4A3228)", "M2 1h12v1h-12zM2 2h1v1h-1zM13 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM4 11h1v1h-1zM11 11h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM6 13h1v1h-1zM9 13h1v1h-1zM7 14h2v1h-2z"],
    ["#C4694A", "M4 2h8v1h-8zM4 3h3v1h-3zM9 3h3v1h-3zM3 4h3v1h-3zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h2v1h-2zM6 5h4v1h-4zM11 5h1v1h-1zM3 6h4v1h-4zM9 6h3v1h-3zM3 7h3v1h-3zM7 7h2v1h-2zM10 7h2v1h-2zM3 8h2v1h-2zM6 8h4v1h-4zM11 8h1v1h-1zM3 9h9v1h-9zM4 10h7v1h-7zM5 11h5v1h-5zM6 12h3v1h-3zM7 13h2v1h-2z"],
    ["#E8977A", "M3 2h1v1h-1zM3 3h1v1h-1z"],
    ["#9A4A30", "M12 2h1v1h-1zM12 3h1v1h-1zM12 4h1v1h-1zM12 5h1v1h-1zM12 6h1v1h-1zM12 7h1v1h-1zM12 8h1v1h-1zM12 9h1v1h-1zM11 10h1v1h-1zM10 11h1v1h-1zM9 12h1v1h-1z"],
    ["#FBF4E8", "M7 3h2v1h-2zM6 4h1v1h-1zM9 4h1v1h-1zM5 5h1v1h-1zM10 5h1v1h-1zM7 6h2v1h-2zM6 7h1v1h-1zM9 7h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1z"],
  ],
} satisfies Record<string, Layer[]>;

export type PixelIconName = keyof typeof ICONS;

// Whole-number sizes only, so pixels stay crisp.
export type PixelIconSize = 16 | 32 | 48 | 64;

export default function PixelIcon({
  name,
  size = 16,
  className,
}: {
  name: PixelIconName;
  size?: PixelIconSize;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {ICONS[name].map(([fill, d], i) => (
        <path key={i} d={d} style={{ fill }} />
      ))}
    </svg>
  );
}
