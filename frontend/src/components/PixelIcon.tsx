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
  more: [
    [LINE, "M2 2h5v1h-5zM9 2h5v1h-5zM2 3h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM13 5h1v1h-1zM2 6h5v1h-5zM9 6h5v1h-5zM2 9h5v1h-5zM9 9h5v1h-5zM2 10h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM6 11h1v1h-1zM9 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM13 12h1v1h-1zM2 13h5v1h-5zM9 13h5v1h-5z"],
    [FILL, "M3 3h3v1h-3zM3 4h3v1h-3zM3 5h3v1h-3zM3 10h3v1h-3zM10 10h3v1h-3zM3 11h3v1h-3zM10 11h3v1h-3zM3 12h3v1h-3zM10 12h3v1h-3z"],
    [ACC, "M10 3h3v1h-3zM10 4h3v1h-3zM10 5h3v1h-3z"],
  ],
  "common-room": [
    [LINE, "M2 2h12v1h-12zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM2 10h12v1h-12zM4 11h1v1h-1zM7 11h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM4 13h2v1h-2z"],
    [FILL, "M2 3h12v1h-12zM2 4h12v1h-12zM2 5h2v1h-2zM6 5h1v1h-1zM9 5h1v1h-1zM12 5h2v1h-2zM2 6h2v1h-2zM6 6h1v1h-1zM9 6h1v1h-1zM12 6h2v1h-2zM2 7h12v1h-12zM2 8h12v1h-12zM2 9h12v1h-12zM5 11h2v1h-2zM5 12h1v1h-1z"],
    [ACC, "M4 5h2v1h-2zM7 5h2v1h-2zM10 5h2v1h-2zM4 6h2v1h-2zM7 6h2v1h-2zM10 6h2v1h-2z"],
  ],
  "desk-time": [
    [LINE, "M6 1h4v1h-4zM7 2h2v1h-2zM5 3h6v1h-6zM12 3h1v1h-1zM4 4h1v1h-1zM11 4h1v1h-1zM13 4h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM5 14h6v1h-6z"],
    [FILL, "M5 4h6v1h-6zM4 5h3v1h-3zM8 5h4v1h-4zM3 6h4v1h-4zM8 6h5v1h-5zM3 7h4v1h-4zM8 7h5v1h-5zM3 8h4v1h-4zM11 8h2v1h-2zM3 9h10v1h-10zM3 10h10v1h-10zM3 11h10v1h-10zM4 12h8v1h-8zM5 13h6v1h-6z"],
    [ACC, "M7 5h1v1h-1zM7 6h1v1h-1zM7 7h1v1h-1zM7 8h4v1h-4z"],
  ],
  "my-desk": [
    [LINE, "M3 1h8v1h-8zM3 2h1v1h-1zM10 2h1v1h-1zM3 3h1v1h-1zM10 3h1v1h-1zM3 4h1v1h-1zM10 4h1v1h-1zM3 5h1v1h-1zM10 5h1v1h-1zM3 6h8v1h-8zM6 7h2v1h-2zM5 8h4v1h-4zM1 9h14v1h-14zM1 10h14v1h-14zM2 11h1v1h-1zM5 11h6v1h-6zM13 11h1v1h-1zM2 12h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM2 13h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1zM13 13h1v1h-1zM2 14h1v1h-1zM5 14h6v1h-6zM13 14h1v1h-1z"],
    [FILL, "M4 2h6v1h-6zM4 3h6v1h-6zM4 4h6v1h-6zM4 5h6v1h-6zM6 12h1v1h-1zM9 12h1v1h-1zM6 13h4v1h-4z"],
    [ACC, "M12 5h2v1h-2zM12 6h3v1h-3zM12 7h3v1h-3zM12 8h2v1h-2zM7 12h2v1h-2z"],
  ],
  "beyond-the-desk": [
    [LINE, "M4 1h1v1h-1zM4 2h1v1h-1zM4 3h1v1h-1zM4 4h1v1h-1zM4 5h1v1h-1zM4 6h1v1h-1zM4 7h1v1h-1zM4 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1zM4 11h1v1h-1zM3 12h10v1h-10zM1 13h1v1h-1zM14 13h1v1h-1zM2 14h12v1h-12z"],
    [FILL, "M2 13h12v1h-12z"],
    [ACC, "M5 1h4v1h-4zM5 2h6v1h-6zM5 3h8v1h-8zM5 4h6v1h-6zM5 5h4v1h-4z"],
  ],
  "buddybook": [
    [LINE, "M3 1h10v1h-10zM3 2h2v1h-2zM12 2h1v1h-1zM3 3h2v1h-2zM12 3h1v1h-1zM3 4h2v1h-2zM12 4h1v1h-1zM3 5h2v1h-2zM12 5h1v1h-1zM3 6h2v1h-2zM12 6h1v1h-1zM3 7h2v1h-2zM12 7h1v1h-1zM3 8h2v1h-2zM12 8h1v1h-1zM3 9h2v1h-2zM6 9h5v1h-5zM12 9h1v1h-1zM3 10h2v1h-2zM12 10h1v1h-1zM3 11h2v1h-2zM6 11h4v1h-4zM12 11h1v1h-1zM3 12h2v1h-2zM12 12h1v1h-1zM3 13h6v1h-6zM11 13h2v1h-2z"],
    [FILL, "M5 2h7v1h-7zM5 3h1v1h-1zM11 3h1v1h-1zM5 4h1v1h-1zM8 4h1v1h-1zM11 4h1v1h-1zM5 5h1v1h-1zM8 5h1v1h-1zM11 5h1v1h-1zM5 6h1v1h-1zM11 6h1v1h-1zM5 7h7v1h-7zM5 8h7v1h-7zM5 9h1v1h-1zM11 9h1v1h-1zM5 10h7v1h-7zM5 11h1v1h-1zM10 11h2v1h-2zM5 12h7v1h-7z"],
    [ACC, "M6 3h5v1h-5zM6 4h2v1h-2zM9 4h2v1h-2zM6 5h2v1h-2zM9 5h2v1h-2zM6 6h5v1h-5zM9 13h2v1h-2zM9 14h2v1h-2zM9 15h2v1h-2z"],
  ],
  "keep-the-desk-lit": [
    [LINE, "M10 2h2v1h-2zM9 3h1v1h-1zM12 3h1v1h-1zM8 4h1v1h-1zM13 4h1v1h-1zM7 5h8v1h-8zM7 6h1v1h-1zM6 7h1v1h-1zM5 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1zM4 11h1v1h-1zM4 12h1v1h-1zM2 13h6v1h-6zM2 14h6v1h-6z"],
    [FILL, "M10 3h2v1h-2zM9 4h4v1h-4z"],
    [ACC, "M9 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM13 8h1v1h-1zM11 9h1v1h-1z"],
  ],
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
  // ---- account (added with the icon-only nav; from the Debbie nav boards) ----
  "note-for-debbie": [
    [LINE, "M1 3h14v1h-14zM1 4h2v1h-2zM13 4h2v1h-2zM1 5h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM4 6h1v1h-1zM11 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM14 12h1v1h-1zM1 13h14v1h-14z"],
    [FILL, "M3 4h10v1h-10zM2 5h1v1h-1zM4 5h8v1h-8zM13 5h1v1h-1zM2 6h2v1h-2zM5 6h6v1h-6zM12 6h2v1h-2zM2 7h3v1h-3zM6 7h4v1h-4zM11 7h3v1h-3zM2 8h4v1h-4zM10 8h4v1h-4zM2 9h4v1h-4zM10 9h4v1h-4zM2 10h5v1h-5zM9 10h5v1h-5zM2 11h12v1h-12zM2 12h12v1h-12z"],
    [ACC, "M6 8h4v1h-4zM6 9h4v1h-4zM7 10h2v1h-2z"],
  ],
  settings: [
    [LINE, "M9 1h4v1h-4zM9 2h1v1h-1zM12 2h1v1h-1zM1 3h9v1h-9zM12 3h3v1h-3zM9 4h4v1h-4zM3 6h4v1h-4zM3 7h1v1h-1zM6 7h1v1h-1zM1 8h3v1h-3zM6 8h9v1h-9zM3 9h4v1h-4zM7 11h4v1h-4zM7 12h1v1h-1zM10 12h1v1h-1zM1 13h7v1h-7zM10 13h5v1h-5zM7 14h4v1h-4z"],
    [ACC, "M10 2h2v1h-2zM10 3h2v1h-2zM4 7h2v1h-2zM4 8h2v1h-2zM8 12h2v1h-2zM8 13h2v1h-2z"],
  ],
  // ---- Common Room (from the Common Room boards, icons v1.2 / reactions v1.3) ----
  "new-post": [
    [LINE, "M2 2h12v1h-12zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM2 13h12v1h-12z"],
    [FILL, "M3 3h10v1h-10zM3 4h4v1h-4zM9 4h4v1h-4zM3 5h4v1h-4zM9 5h4v1h-4zM3 6h4v1h-4zM9 6h4v1h-4zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h4v1h-4zM9 9h4v1h-4zM3 10h4v1h-4zM9 10h4v1h-4zM3 11h4v1h-4zM9 11h4v1h-4zM3 12h10v1h-10z"],
    [ACC, "M7 4h2v1h-2zM7 5h2v1h-2zM7 6h2v1h-2zM4 7h8v1h-8zM4 8h8v1h-8zM7 9h2v1h-2zM7 10h2v1h-2zM7 11h2v1h-2z"],
  ],
  "kind-pets": [
    [LINE, "M6 2h1v1h-1zM10 2h1v1h-1zM5 3h1v1h-1zM7 3h1v1h-1zM9 3h1v1h-1zM11 3h1v1h-1zM6 4h1v1h-1zM10 4h1v1h-1zM3 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM3 7h1v1h-1zM13 7h1v1h-1zM7 8h3v1h-3zM5 9h2v1h-2zM10 9h2v1h-2zM5 10h1v1h-1zM11 10h1v1h-1zM5 11h1v1h-1zM11 11h1v1h-1zM5 12h1v1h-1zM11 12h1v1h-1zM5 13h1v1h-1zM11 13h1v1h-1zM6 14h1v1h-1zM10 14h1v1h-1zM7 15h3v1h-3z"],
    [FILL, "M7 9h3v1h-3zM6 10h5v1h-5zM6 11h1v1h-1zM9 11h2v1h-2zM6 12h1v1h-1zM9 12h2v1h-2zM6 13h5v1h-5zM7 14h3v1h-3z"],
    [ACC, "M6 3h1v1h-1zM10 3h1v1h-1zM3 6h1v1h-1zM13 6h1v1h-1zM7 11h2v1h-2zM7 12h2v1h-2z"],
  ],
  "kind-made": [
    [LINE, "M7 2h2v1h-2zM4 3h3v1h-3zM9 3h3v1h-3zM3 4h1v1h-1zM12 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM10 8h2v1h-2zM14 8h1v1h-1zM1 9h1v1h-1zM9 9h1v1h-1zM12 9h1v1h-1zM14 9h1v1h-1zM2 10h1v1h-1zM8 10h1v1h-1zM13 10h1v1h-1zM3 11h1v1h-1zM8 11h1v1h-1zM4 12h3v1h-3zM9 12h1v1h-1zM7 13h2v1h-2z"],
    [FILL, "M7 3h2v1h-2zM4 4h4v1h-4zM10 4h2v1h-2zM3 5h5v1h-5zM10 5h3v1h-3zM2 6h2v1h-2zM6 6h5v1h-5zM13 6h1v1h-1zM2 7h2v1h-2zM6 7h5v1h-5zM13 7h1v1h-1zM2 8h8v1h-8zM12 8h2v1h-2zM2 9h2v1h-2zM6 9h3v1h-3zM13 9h1v1h-1zM3 10h1v1h-1zM6 10h2v1h-2zM4 11h4v1h-4zM7 12h2v1h-2z"],
    [ACC, "M8 4h2v1h-2zM8 5h2v1h-2zM4 6h2v1h-2zM11 6h2v1h-2zM4 7h2v1h-2zM11 7h2v1h-2zM4 9h2v1h-2zM4 10h2v1h-2z"],
  ],
  "kind-eats": [
    [LINE, "M1 8h14v1h-14zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM4 12h1v1h-1zM11 12h1v1h-1zM5 13h6v1h-6z"],
    [FILL, "M3 9h10v1h-10zM3 10h10v1h-10zM4 11h8v1h-8zM5 12h6v1h-6z"],
    [ACC, "M10 2h1v1h-1zM6 3h1v1h-1zM11 3h1v1h-1zM7 4h1v1h-1zM10 4h1v1h-1zM6 5h1v1h-1zM11 5h1v1h-1zM7 6h1v1h-1z"],
  ],
  "kind-thought": [
    [LINE, "M6 2h4v1h-4zM5 3h1v1h-1zM10 3h1v1h-1zM4 4h1v1h-1zM11 4h1v1h-1zM4 5h1v1h-1zM11 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM4 7h1v1h-1zM11 7h1v1h-1zM4 8h1v1h-1zM11 8h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM6 10h4v1h-4zM5 11h6v1h-6zM6 12h4v1h-4zM7 13h2v1h-2z"],
    [FILL, "M6 3h4v1h-4zM5 4h6v1h-6zM5 5h1v1h-1zM7 5h1v1h-1zM9 5h2v1h-2zM4 6h3v1h-3zM8 6h1v1h-1zM10 6h2v1h-2zM5 7h2v1h-2zM9 7h2v1h-2zM5 8h6v1h-6zM6 9h4v1h-4z"],
    [ACC, "M6 5h1v1h-1zM8 5h1v1h-1zM7 6h1v1h-1zM9 6h1v1h-1zM7 7h2v1h-2z"],
  ],
  "kind-meme": [
    [LINE, "M5 2h6v1h-6zM4 3h1v1h-1zM11 3h1v1h-1zM3 4h1v1h-1zM12 4h1v1h-1zM2 5h1v1h-1zM5 5h1v1h-1zM10 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM11 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM5 9h6v1h-6zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM4 12h1v1h-1zM11 12h1v1h-1zM5 13h6v1h-6z"],
    [FILL, "M5 3h6v1h-6zM4 4h8v1h-8zM3 5h2v1h-2zM6 5h4v1h-4zM11 5h2v1h-2zM3 6h1v1h-1zM5 6h1v1h-1zM7 6h2v1h-2zM10 6h1v1h-1zM12 6h1v1h-1zM3 7h10v1h-10zM3 8h10v1h-10zM3 9h2v1h-2zM11 9h2v1h-2zM3 10h2v1h-2zM11 10h2v1h-2zM4 11h2v1h-2zM10 11h2v1h-2zM5 12h6v1h-6z"],
    [ACC, "M5 10h6v1h-6zM6 11h4v1h-4z"],
  ],
  "kind-outside": [
    [LINE, "M7 1h3v1h-3zM5 2h2v1h-2zM10 2h1v1h-1zM5 3h1v1h-1zM11 3h1v1h-1zM4 4h1v1h-1zM11 4h1v1h-1zM3 5h1v1h-1zM12 5h2v1h-2zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM7 9h2v1h-2zM13 9h1v1h-1zM3 10h4v1h-4zM9 10h4v1h-4zM4 14h8v1h-8z"],
    [FILL, "M7 2h3v1h-3zM6 3h5v1h-5zM5 4h6v1h-6zM4 5h5v1h-5zM10 5h2v1h-2zM3 6h4v1h-4zM8 6h5v1h-5zM3 7h2v1h-2zM6 7h4v1h-4zM11 7h2v1h-2zM3 8h3v1h-3zM7 8h6v1h-6zM3 9h4v1h-4zM9 9h4v1h-4z"],
    [ACC, "M9 5h1v1h-1zM7 6h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM6 8h1v1h-1zM7 10h2v1h-2zM7 11h2v1h-2zM7 12h2v1h-2zM6 13h4v1h-4z"],
  ],
  "kind-win": [
    [LINE, "M4 1h8v1h-8zM2 2h3v1h-3zM11 2h3v1h-3zM2 3h1v1h-1zM4 3h1v1h-1zM11 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM11 4h1v1h-1zM13 4h1v1h-1zM3 5h2v1h-2zM11 5h2v1h-2zM5 6h1v1h-1zM10 6h1v1h-1zM6 7h1v1h-1zM9 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM6 9h4v1h-4zM7 10h2v1h-2zM5 11h6v1h-6zM5 12h1v1h-1zM10 12h1v1h-1zM5 13h6v1h-6z"],
    [FILL, "M5 2h2v1h-2zM9 2h2v1h-2zM5 3h1v1h-1zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h2v1h-2zM5 5h6v1h-6zM6 6h4v1h-4zM7 7h2v1h-2zM7 8h2v1h-2z"],
    [ACC, "M7 2h2v1h-2zM6 3h4v1h-4zM7 4h2v1h-2zM6 12h4v1h-4z"],
  ],
  "kind-other": [
    [LINE, "M2 2h12v1h-12zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM4 5h6v1h-6zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM4 7h6v1h-6zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM4 9h4v1h-4zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM2 12h1v1h-1zM2 13h9v1h-9z"],
    [FILL, "M3 3h10v1h-10zM3 4h10v1h-10zM3 5h1v1h-1zM10 5h3v1h-3zM3 6h10v1h-10zM3 7h1v1h-1zM10 7h3v1h-3zM3 8h10v1h-10zM3 9h1v1h-1zM8 9h5v1h-5zM3 10h10v1h-10zM3 11h8v1h-8zM3 12h8v1h-8z"],
    [ACC, "M11 11h3v1h-3zM11 12h3v1h-3zM11 13h3v1h-3z"],
  ],
  "eye": [
    [LINE, "M4 4h8v1h-8zM2 5h2v1h-2zM12 5h2v1h-2zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM7 7h2v1h-2zM14 7h1v1h-1zM1 8h1v1h-1zM7 8h2v1h-2zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM2 10h2v1h-2zM12 10h2v1h-2zM4 11h8v1h-8z"],
    [FILL, "M4 5h8v1h-8zM2 6h4v1h-4zM10 6h4v1h-4zM2 7h4v1h-4zM10 7h4v1h-4zM2 8h4v1h-4zM10 8h4v1h-4zM2 9h4v1h-4zM10 9h4v1h-4zM4 10h8v1h-8z"],
    [ACC, "M6 6h4v1h-4zM6 7h1v1h-1zM9 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM6 9h4v1h-4z"],
  ],
  "react-cheer": [
    [LINE, "M3 0h4v1h-4zM9 0h4v1h-4zM2 1h1v1h-1zM7 1h2v1h-2zM13 1h1v1h-1zM1 2h1v1h-1zM14 2h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM4 10h1v1h-1zM11 10h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM6 12h4v1h-4z"],
    [ACC, "M3 1h4v1h-4zM9 1h4v1h-4zM2 2h12v1h-12zM2 3h12v1h-12zM2 4h12v1h-12zM2 5h12v1h-12zM2 6h12v1h-12zM3 7h10v1h-10zM3 8h10v1h-10zM4 9h8v1h-8zM5 10h6v1h-6zM6 11h4v1h-4z"],
  ],
  "react-metoo": [
    [LINE, "M0 2h16v1h-16zM0 3h1v1h-1zM15 3h1v1h-1zM0 4h1v1h-1zM11 4h2v1h-2zM15 4h1v1h-1zM0 5h1v1h-1zM10 5h3v1h-3zM15 5h1v1h-1zM0 6h1v1h-1zM9 6h1v1h-1zM11 6h2v1h-2zM15 6h1v1h-1zM0 7h1v1h-1zM11 7h2v1h-2zM15 7h1v1h-1zM0 8h1v1h-1zM11 8h2v1h-2zM15 8h1v1h-1zM0 9h1v1h-1zM11 9h2v1h-2zM15 9h1v1h-1zM0 10h1v1h-1zM11 10h2v1h-2zM15 10h1v1h-1zM0 11h1v1h-1zM9 11h5v1h-5zM15 11h1v1h-1zM0 12h1v1h-1zM15 12h1v1h-1zM0 13h16v1h-16z"],
    [FILL, "M1 3h14v1h-14zM1 4h3v1h-3zM6 4h5v1h-5zM13 4h2v1h-2zM1 5h3v1h-3zM6 5h4v1h-4zM13 5h2v1h-2zM1 6h3v1h-3zM6 6h3v1h-3zM10 6h1v1h-1zM13 6h2v1h-2zM1 7h1v1h-1zM8 7h3v1h-3zM13 7h2v1h-2zM1 8h1v1h-1zM8 8h3v1h-3zM13 8h2v1h-2zM1 9h3v1h-3zM6 9h5v1h-5zM13 9h2v1h-2zM1 10h3v1h-3zM6 10h5v1h-5zM13 10h2v1h-2zM1 11h3v1h-3zM6 11h3v1h-3zM14 11h1v1h-1zM1 12h14v1h-14z"],
    [ACC, "M4 4h2v1h-2zM4 5h2v1h-2zM4 6h2v1h-2zM2 7h6v1h-6zM2 8h6v1h-6zM4 9h2v1h-2zM4 10h2v1h-2zM4 11h2v1h-2z"],
  ],
  "react-cozy": [
    [LINE, "M2 6h9v1h-9zM2 7h1v1h-1zM10 7h1v1h-1zM2 8h1v1h-1zM10 8h4v1h-4zM2 9h1v1h-1zM10 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM10 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM10 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM10 12h3v1h-3zM2 13h1v1h-1zM10 13h1v1h-1zM2 14h9v1h-9z"],
    [FILL, "M3 8h7v1h-7zM3 9h7v1h-7zM3 10h7v1h-7zM3 11h7v1h-7zM3 12h7v1h-7zM3 13h7v1h-7z"],
    [ACC, "M8 1h1v1h-1zM5 2h1v1h-1zM9 2h1v1h-1zM6 3h1v1h-1zM8 3h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM6 5h1v1h-1zM3 7h7v1h-7z"],
  ],
  "react-proud": [
    [LINE, "M7 1h2v1h-2zM6 2h1v1h-1zM9 2h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM0 5h6v1h-6zM10 5h6v1h-6zM1 6h1v1h-1zM14 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM1 11h1v1h-1zM7 11h2v1h-2zM14 11h1v1h-1zM1 12h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM14 12h1v1h-1zM1 13h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1zM14 13h1v1h-1zM1 14h4v1h-4zM11 14h4v1h-4z"],
    [ACC, "M7 2h2v1h-2zM7 3h2v1h-2zM6 4h4v1h-4zM6 5h4v1h-4zM2 6h12v1h-12zM3 7h10v1h-10zM4 8h8v1h-8zM4 9h8v1h-8zM3 10h10v1h-10zM2 11h5v1h-5zM9 11h5v1h-5zM2 12h4v1h-4zM10 12h4v1h-4zM2 13h3v1h-3zM11 13h3v1h-3z"],
  ],
  "replies": [
    [LINE, "M1 1h9v1h-9zM1 2h1v1h-1zM9 2h1v1h-1zM1 3h1v1h-1zM9 3h1v1h-1zM1 4h1v1h-1zM9 4h1v1h-1zM1 5h1v1h-1zM9 5h1v1h-1zM1 6h1v1h-1zM9 6h6v1h-6zM1 7h9v1h-9zM14 7h1v1h-1zM3 8h1v1h-1zM6 8h1v1h-1zM14 8h1v1h-1zM2 9h1v1h-1zM6 9h1v1h-1zM14 9h1v1h-1zM6 10h1v1h-1zM14 10h1v1h-1zM6 11h1v1h-1zM14 11h1v1h-1zM6 12h9v1h-9zM12 13h2v1h-2z"],
    [FILL, "M2 2h7v1h-7zM2 3h7v1h-7zM2 4h7v1h-7zM2 5h7v1h-7zM2 6h7v1h-7z"],
    [ACC, "M10 7h4v1h-4zM7 8h7v1h-7zM7 9h7v1h-7zM7 10h7v1h-7zM7 11h7v1h-7z"],
  ],
  "channel-hash": [
    [LINE, "M5 2h1v1h-1zM10 2h1v1h-1zM5 3h1v1h-1zM10 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM5 6h1v1h-1zM10 6h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1z"],
    [ACC, "M2 5h12v1h-12zM2 10h12v1h-12z"],
  ],
  "add-photo": [
    [LINE, "M1 3h14v1h-14zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM4 9h1v1h-1zM8 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM3 10h1v1h-1zM5 10h1v1h-1zM7 10h1v1h-1zM9 10h1v1h-1zM14 10h1v1h-1zM1 11h2v1h-2zM6 11h1v1h-1zM10 11h1v1h-1zM14 11h1v1h-1zM1 12h14v1h-14z"],
    [FILL, "M2 4h12v1h-12zM2 5h8v1h-8zM12 5h2v1h-2zM2 6h7v1h-7zM13 6h1v1h-1zM2 7h7v1h-7zM13 7h1v1h-1zM2 8h8v1h-8zM12 8h2v1h-2zM2 9h2v1h-2zM5 9h3v1h-3zM9 9h5v1h-5zM2 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM8 10h1v1h-1zM10 10h4v1h-4zM3 11h3v1h-3zM7 11h3v1h-3zM11 11h3v1h-3z"],
    [ACC, "M10 5h2v1h-2zM9 6h4v1h-4zM9 7h4v1h-4zM10 8h2v1h-2z"],
  ],
  // ---- Game icons v1.1 (from the Reality Break board; outline follows --spO) ----
  "game-uno": [
    ["var(--spO,#4A3228)", "M7 1h7v1h-7zM6 2h1v1h-1zM14 2h1v1h-1zM2 3h5v1h-5zM14 3h1v1h-1zM1 4h1v1h-1zM6 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM6 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM6 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM6 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM6 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM6 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM6 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM7 12h7v1h-7zM1 13h1v1h-1zM9 13h1v1h-1zM2 14h7v1h-7z"],
    ["#C4694A", "M8 2h5v1h-5zM8 3h2v1h-2zM11 3h2v1h-2zM7 4h2v1h-2zM12 4h1v1h-1zM7 5h1v1h-1zM7 6h1v1h-1zM7 7h1v1h-1zM7 8h1v1h-1zM7 9h2v1h-2zM12 9h1v1h-1zM7 10h3v1h-3zM11 10h2v1h-2z"],
    ["#9A4A30", "M13 2h1v1h-1zM13 3h1v1h-1zM13 4h1v1h-1zM13 5h1v1h-1zM13 6h1v1h-1zM13 7h1v1h-1zM13 8h1v1h-1zM13 9h1v1h-1zM13 10h1v1h-1zM7 11h7v1h-7z"],
    ["#FBF4E8", "M7 2h1v1h-1zM7 3h1v1h-1zM10 3h1v1h-1zM9 4h3v1h-3zM8 5h5v1h-5zM8 6h1v1h-1zM11 6h2v1h-2zM8 7h1v1h-1zM11 7h2v1h-2zM8 8h5v1h-5zM9 9h3v1h-3zM10 10h1v1h-1z"],
    ["#F2C766", "M9 6h2v1h-2zM9 7h2v1h-2z"],
    ["#8FA98A", "M2 4h4v1h-4zM2 5h4v1h-4zM2 6h4v1h-4zM2 7h4v1h-4zM2 8h4v1h-4zM2 9h4v1h-4zM2 10h4v1h-4zM2 11h4v1h-4zM2 12h5v1h-5zM2 13h7v1h-7z"],
  ],
  "game-family-feud": [
    ["var(--spO,#4A3228)", "M2 2h3v1h-3zM11 2h3v1h-3zM1 3h1v1h-1zM5 3h1v1h-1zM10 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM2 6h3v1h-3zM11 6h3v1h-3zM2 7h3v1h-3zM11 7h3v1h-3zM1 8h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM5 9h1v1h-1zM7 9h2v1h-2zM10 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM5 10h2v1h-2zM9 10h2v1h-2zM14 10h1v1h-1zM1 11h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM14 12h1v1h-1zM1 13h14v1h-14z"],
    ["#C4694A", "M2 3h3v1h-3zM2 4h3v1h-3zM2 5h3v1h-3zM2 8h2v1h-2zM2 9h2v1h-2zM2 10h2v1h-2zM2 11h2v1h-2zM2 12h2v1h-2z"],
    ["#9A4A30", "M4 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1zM4 11h1v1h-1zM4 12h1v1h-1z"],
    ["#8FA98A", "M11 3h3v1h-3zM11 4h3v1h-3zM11 5h3v1h-3zM12 8h2v1h-2zM12 9h2v1h-2zM12 10h2v1h-2zM12 11h2v1h-2zM12 12h2v1h-2z"],
    ["#6B8A66", "M11 8h1v1h-1zM11 9h1v1h-1zM11 10h1v1h-1zM11 11h1v1h-1zM11 12h1v1h-1z"],
    ["#F2C766", "M7 11h3v1h-3zM6 12h4v1h-4z"],
    ["#FFF0C2", "M7 10h2v1h-2zM6 11h1v1h-1z"],
  ],
  "game-impostor-who": [
    ["var(--spO,#4A3228)", "M6 2h4v1h-4zM5 3h1v1h-1zM10 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM4 5h3v1h-3zM11 5h1v1h-1zM5 6h1v1h-1zM10 6h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM7 9h2v1h-2zM4 10h3v1h-3zM9 10h3v1h-3zM3 11h1v1h-1zM12 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM2 13h1v1h-1zM13 13h1v1h-1zM2 14h12v1h-12z"],
    ["#B79AAE", "M6 4h2v1h-2zM7 5h1v1h-1zM6 6h2v1h-2zM6 7h2v1h-2zM7 8h1v1h-1zM7 10h1v1h-1zM4 11h4v1h-4zM3 12h5v1h-5zM3 13h5v1h-5z"],
    ["#DCC7D4", "M6 3h2v1h-2z"],
    ["#4A3A47", "M8 3h2v1h-2zM8 4h2v1h-2zM8 5h3v1h-3zM8 6h2v1h-2zM8 7h2v1h-2zM8 8h1v1h-1zM8 10h1v1h-1zM8 11h4v1h-4zM8 12h5v1h-5zM8 13h5v1h-5z"],
  ],
  "game-wheel-of-fortune": [
    ["var(--spO,#4A3228)", "M6 0h4v1h-4zM6 1h1v1h-1zM9 1h1v1h-1zM7 2h2v1h-2zM5 3h6v1h-6zM4 4h1v1h-1zM11 4h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM6 9h4v1h-4zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM3 13h2v1h-2zM11 13h2v1h-2zM5 14h6v1h-6z"],
    ["#C4694A", "M3 7h1v1h-1zM12 7h1v1h-1zM3 8h3v1h-3zM10 8h3v1h-3zM3 9h3v1h-3zM10 9h3v1h-3zM3 10h2v1h-2zM11 10h2v1h-2z"],
    ["#F2C766", "M7 1h2v1h-2zM5 4h1v1h-1zM4 5h2v1h-2zM3 6h4v1h-4zM4 7h3v1h-3zM9 10h2v1h-2zM9 11h4v1h-4zM9 12h3v1h-3zM10 13h1v1h-1z"],
    ["#FBF4E8", "M6 4h4v1h-4zM6 5h4v1h-4zM7 6h2v1h-2zM7 7h2v1h-2zM7 10h2v1h-2zM7 11h2v1h-2zM7 12h2v1h-2zM6 13h4v1h-4z"],
    ["#8FA98A", "M10 4h1v1h-1zM10 5h2v1h-2zM9 6h4v1h-4zM9 7h3v1h-3zM5 10h2v1h-2zM3 11h4v1h-4zM4 12h3v1h-3zM5 13h1v1h-1z"],
    ["#FFF0C2", "M7 8h2v1h-2z"],
  ],
  "game-type-what-you-see": [
    ["var(--spO,#4A3228)", "M2 1h12v1h-12zM1 2h1v1h-1zM14 2h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM7 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM5 7h5v1h-5zM14 7h1v1h-1zM1 8h1v1h-1zM5 8h1v1h-1zM9 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM5 9h1v1h-1zM9 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM14 12h1v1h-1zM2 13h12v1h-12z"],
    ["#8FA98A", "M2 2h11v1h-11zM2 3h1v1h-1zM2 4h1v1h-1zM2 5h1v1h-1zM2 6h1v1h-1zM2 7h1v1h-1zM2 8h1v1h-1zM2 9h1v1h-1zM2 10h1v1h-1zM2 11h11v1h-11z"],
    ["#6B8A66", "M13 2h1v1h-1zM13 3h1v1h-1zM13 4h1v1h-1zM13 5h1v1h-1zM13 6h1v1h-1zM13 7h1v1h-1zM13 8h1v1h-1zM13 9h1v1h-1zM13 10h1v1h-1zM13 11h1v1h-1zM2 12h12v1h-12z"],
    ["#FBF4E8", "M3 3h10v1h-10zM3 4h4v1h-4zM8 4h3v1h-3zM12 4h1v1h-1zM3 5h3v1h-3zM7 5h1v1h-1zM9 5h2v1h-2zM12 5h1v1h-1zM3 6h3v1h-3zM7 6h1v1h-1zM9 6h2v1h-2zM12 6h1v1h-1zM3 7h2v1h-2zM10 7h1v1h-1zM12 7h1v1h-1zM3 8h2v1h-2zM6 8h3v1h-3zM10 8h1v1h-1zM12 8h1v1h-1zM3 9h2v1h-2zM6 9h3v1h-3zM10 9h1v1h-1zM12 9h1v1h-1zM3 10h10v1h-10z"],
    ["#C4694A", "M11 4h1v1h-1zM11 5h1v1h-1zM11 6h1v1h-1zM11 7h1v1h-1zM11 8h1v1h-1zM11 9h1v1h-1z"],
  ],
  "game-trivia": [
    ["var(--spO,#4A3228)", "M2 1h12v1h-12zM1 2h1v1h-1zM14 2h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM2 11h2v1h-2zM6 11h8v1h-8zM4 12h2v1h-2zM3 13h2v1h-2z"],
    ["#7FA3B5", "M2 3h4v1h-4zM10 3h3v1h-3zM2 4h3v1h-3zM7 4h2v1h-2zM11 4h2v1h-2zM2 5h7v1h-7zM11 5h2v1h-2zM2 6h6v1h-6zM10 6h3v1h-3zM2 7h5v1h-5zM9 7h4v1h-4zM2 8h11v1h-11zM2 9h5v1h-5zM9 9h4v1h-4zM4 11h2v1h-2z"],
    ["#B9D2DE", "M2 2h12v1h-12z"],
    ["#5C8397", "M13 3h1v1h-1zM13 4h1v1h-1zM13 5h1v1h-1zM13 6h1v1h-1zM13 7h1v1h-1zM13 8h1v1h-1zM13 9h1v1h-1zM2 10h12v1h-12z"],
    ["#FBF4E8", "M6 3h4v1h-4zM5 4h2v1h-2zM9 4h2v1h-2zM9 5h2v1h-2zM8 6h2v1h-2zM7 7h2v1h-2zM7 9h2v1h-2z"],
  ],
  "game-daily-puzzle": [
    ["var(--spO,#4A3228)", "M1 1h4v1h-4zM6 1h4v1h-4zM11 1h4v1h-4zM1 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM9 2h1v1h-1zM11 2h1v1h-1zM14 2h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM11 3h1v1h-1zM14 3h1v1h-1zM1 4h4v1h-4zM6 4h4v1h-4zM11 4h4v1h-4zM1 6h4v1h-4zM6 6h4v1h-4zM11 6h4v1h-4zM1 7h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM9 7h1v1h-1zM11 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM14 8h1v1h-1zM1 9h4v1h-4zM6 9h4v1h-4zM11 9h4v1h-4zM1 11h4v1h-4zM6 11h4v1h-4zM11 11h4v1h-4zM1 12h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM11 12h1v1h-1zM14 12h1v1h-1zM1 13h1v1h-1zM4 13h1v1h-1zM6 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM1 14h4v1h-4zM6 14h4v1h-4zM11 14h4v1h-4z"],
    ["#8FA98A", "M2 2h2v1h-2zM2 3h2v1h-2zM12 7h2v1h-2zM12 8h2v1h-2zM7 12h2v1h-2zM12 12h2v1h-2zM7 13h2v1h-2zM12 13h2v1h-2z"],
    ["#F2C766", "M2 7h2v1h-2zM2 8h2v1h-2z"],
    ["#FBF4E8", "M7 2h2v1h-2zM12 2h2v1h-2zM7 3h2v1h-2zM12 3h2v1h-2zM7 7h2v1h-2zM7 8h2v1h-2zM2 12h2v1h-2zM2 13h2v1h-2z"],
  ],
  "game-daily-anagram": [
    ["var(--spO,#4A3228)", "M1 1h13v1h-13zM1 2h1v1h-1zM5 2h1v1h-1zM9 2h1v1h-1zM13 2h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM13 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM9 5h1v1h-1zM13 5h1v1h-1zM1 6h1v1h-1zM5 6h1v1h-1zM9 6h1v1h-1zM13 6h1v1h-1zM1 7h13v1h-13zM3 9h1v1h-1zM11 9h1v1h-1zM2 10h3v1h-3zM10 10h3v1h-3zM3 11h1v1h-1zM11 11h1v1h-1zM3 12h1v1h-1zM11 12h1v1h-1zM3 13h9v1h-9z"],
    ["#C4694A", "M10 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM11 3h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM8 4h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM7 5h2v1h-2zM11 5h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM11 6h1v1h-1z"],
    ["#FBF4E8", "M2 2h3v1h-3zM6 2h3v1h-3zM11 2h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM10 3h1v1h-1zM12 3h1v1h-1zM3 4h1v1h-1zM6 4h2v1h-2zM10 4h3v1h-3zM3 5h1v1h-1zM6 5h1v1h-1zM10 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM6 6h3v1h-3zM10 6h1v1h-1zM12 6h1v1h-1z"],
  ],
  "game-daily-sudoku": [
    ["var(--spO,#4A3228)", "M1 1h13v1h-13zM1 2h1v1h-1zM5 2h1v1h-1zM9 2h1v1h-1zM13 2h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM13 4h1v1h-1zM1 5h13v1h-13zM1 6h1v1h-1zM5 6h1v1h-1zM9 6h1v1h-1zM13 6h1v1h-1zM1 7h1v1h-1zM5 7h1v1h-1zM9 7h1v1h-1zM13 7h1v1h-1zM1 8h1v1h-1zM5 8h1v1h-1zM9 8h1v1h-1zM13 8h1v1h-1zM1 9h13v1h-13zM1 10h1v1h-1zM5 10h1v1h-1zM9 10h1v1h-1zM13 10h1v1h-1zM1 11h1v1h-1zM5 11h1v1h-1zM9 11h1v1h-1zM13 11h1v1h-1zM1 12h1v1h-1zM5 12h1v1h-1zM9 12h1v1h-1zM13 12h1v1h-1zM1 13h13v1h-13z"],
    ["#FBF4E8", "M4 2h1v1h-1zM6 2h3v1h-3zM2 3h1v1h-1zM4 3h1v1h-1zM6 3h3v1h-3zM10 3h2v1h-2zM6 4h3v1h-3zM10 4h1v1h-1zM12 4h1v1h-1zM2 6h3v1h-3zM7 6h1v1h-1zM10 6h3v1h-3zM2 7h3v1h-3zM10 7h3v1h-3zM2 8h3v1h-3zM6 8h2v1h-2zM10 8h3v1h-3zM2 10h3v1h-3zM10 10h3v1h-3zM2 11h3v1h-3zM8 11h1v1h-1zM10 11h3v1h-3zM2 12h3v1h-3zM10 12h3v1h-3z"],
    ["#C4694A", "M2 2h2v1h-2zM10 2h3v1h-3zM3 3h1v1h-1zM12 3h1v1h-1zM2 4h3v1h-3zM11 4h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM6 7h3v1h-3zM8 8h1v1h-1zM6 10h3v1h-3zM6 11h2v1h-2zM6 12h3v1h-3z"],
  ],
  "game-daily-word-search": [
    ["var(--spO,#4A3228)", "M0 0h16v1h-16zM0 1h1v1h-1zM15 1h1v1h-1zM0 2h1v1h-1zM2 2h2v1h-2zM5 2h2v1h-2zM8 2h2v1h-2zM11 2h1v1h-1zM15 2h1v1h-1zM0 3h1v1h-1zM2 3h2v1h-2zM5 3h1v1h-1zM9 3h1v1h-1zM11 3h2v1h-2zM15 3h1v1h-1zM0 4h1v1h-1zM15 4h1v1h-1zM0 5h1v1h-1zM2 5h2v1h-2zM5 5h2v1h-2zM8 5h2v1h-2zM11 5h2v1h-2zM15 5h1v1h-1zM0 6h1v1h-1zM2 6h1v1h-1zM5 6h2v1h-2zM9 6h1v1h-1zM11 6h2v1h-2zM15 6h1v1h-1zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM2 8h1v1h-1zM5 8h2v1h-2zM8 8h2v1h-2zM11 8h2v1h-2zM15 8h1v1h-1zM0 9h1v1h-1zM2 9h2v1h-2zM6 9h1v1h-1zM8 9h1v1h-1zM11 9h2v1h-2zM15 9h1v1h-1zM0 10h1v1h-1zM15 10h1v1h-1zM0 11h1v1h-1zM2 11h2v1h-2zM5 11h1v1h-1zM8 11h2v1h-2zM11 11h2v1h-2zM15 11h1v1h-1zM0 12h1v1h-1zM3 12h1v1h-1zM5 12h2v1h-2zM8 12h2v1h-2zM11 12h1v1h-1zM15 12h1v1h-1zM0 13h1v1h-1zM15 13h1v1h-1zM0 14h1v1h-1zM15 14h1v1h-1zM0 15h16v1h-16z"],
    ["#F2C766", "M1 4h14v1h-14zM1 5h1v1h-1zM4 5h1v1h-1zM7 5h1v1h-1zM10 5h1v1h-1zM13 5h2v1h-2zM1 6h1v1h-1zM3 6h2v1h-2zM7 6h2v1h-2zM10 6h1v1h-1zM13 6h2v1h-2zM1 7h14v1h-14z"],
    ["#FBF4E8", "M1 1h14v1h-14zM1 2h1v1h-1zM4 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM12 2h3v1h-3zM1 3h1v1h-1zM4 3h1v1h-1zM6 3h3v1h-3zM10 3h1v1h-1zM13 3h2v1h-2zM1 8h1v1h-1zM3 8h2v1h-2zM7 8h1v1h-1zM10 8h1v1h-1zM13 8h2v1h-2zM1 9h1v1h-1zM4 9h2v1h-2zM7 9h1v1h-1zM9 9h2v1h-2zM13 9h2v1h-2zM1 10h14v1h-14zM1 11h1v1h-1zM4 11h1v1h-1zM6 11h2v1h-2zM10 11h1v1h-1zM13 11h2v1h-2zM1 12h2v1h-2zM4 12h1v1h-1zM7 12h1v1h-1zM10 12h1v1h-1zM12 12h3v1h-3zM1 13h14v1h-14zM1 14h14v1h-14z"],
  ],
  "game-in-between": [
    ["var(--spO,#4A3228)", "M6 2h4v1h-4zM6 3h1v1h-1zM9 3h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM1 5h4v1h-4zM6 5h1v1h-1zM9 5h1v1h-1zM11 5h4v1h-4zM1 6h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM11 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM9 7h1v1h-1zM11 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM4 9h1v1h-1zM6 9h1v1h-1zM9 9h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM11 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM4 11h1v1h-1zM6 11h4v1h-4zM11 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM11 12h1v1h-1zM14 12h1v1h-1zM1 13h4v1h-4zM11 13h4v1h-4z"],
    ["#C4694A", "M7 3h1v1h-1zM8 4h1v1h-1zM7 5h1v1h-1zM8 6h1v1h-1zM7 7h1v1h-1zM8 8h1v1h-1zM7 9h1v1h-1zM8 10h1v1h-1z"],
    ["#FBF4E8", "M8 3h1v1h-1zM7 4h1v1h-1zM8 5h1v1h-1zM2 6h2v1h-2zM7 6h1v1h-1zM12 6h2v1h-2zM3 7h1v1h-1zM8 7h1v1h-1zM13 7h1v1h-1zM2 8h2v1h-2zM7 8h1v1h-1zM12 8h2v1h-2zM2 9h2v1h-2zM8 9h1v1h-1zM13 9h1v1h-1zM2 10h2v1h-2zM7 10h1v1h-1zM12 10h2v1h-2zM3 11h1v1h-1zM13 11h1v1h-1zM2 12h2v1h-2zM12 12h2v1h-2z"],
    ["#C4694A", "M2 7h1v1h-1zM12 7h1v1h-1zM12 9h1v1h-1zM2 11h1v1h-1zM12 11h1v1h-1z"],
  ],
  "game-bomb-party": [
    ["var(--spO,#4A3228)", "M11 1h2v1h-2zM9 2h2v1h-2zM5 3h5v1h-5zM5 4h1v1h-1zM9 4h1v1h-1zM5 5h5v1h-5zM3 6h2v1h-2zM10 6h2v1h-2zM3 7h1v1h-1zM11 7h1v1h-1zM2 8h1v1h-1zM12 8h1v1h-1zM2 9h1v1h-1zM12 9h1v1h-1zM2 10h1v1h-1zM12 10h1v1h-1zM2 11h1v1h-1zM12 11h1v1h-1zM3 12h1v1h-1zM11 12h1v1h-1zM3 13h2v1h-2zM10 13h2v1h-2zM5 14h5v1h-5z"],
    ["#5B4A42", "M6 4h3v1h-3zM5 6h5v1h-5zM6 7h2v1h-2zM5 8h1v1h-1zM7 8h1v1h-1zM9 8h1v1h-1zM6 9h2v1h-2zM9 9h1v1h-1zM3 10h1v1h-1zM5 10h1v1h-1zM7 10h1v1h-1zM3 11h1v1h-1zM6 11h2v1h-2zM4 12h3v1h-3zM5 13h1v1h-1z"],
    ["#8A7468", "M3 8h1v1h-1zM3 9h1v1h-1z"],
    ["#3E322C", "M11 8h1v1h-1zM11 9h1v1h-1zM9 10h1v1h-1zM11 10h1v1h-1zM11 11h1v1h-1zM7 12h4v1h-4zM6 13h4v1h-4z"],
    ["#F2C766", "M13 1h2v1h-2zM13 2h1v1h-1z"],
    ["#C4694A", "M13 0h2v1h-2zM14 2h1v1h-1z"],
    ["#FBF4E8", "M4 7h2v1h-2zM8 7h3v1h-3zM4 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM4 9h2v1h-2zM8 9h1v1h-1zM10 9h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM8 10h1v1h-1zM10 10h1v1h-1zM4 11h2v1h-2zM8 11h3v1h-3z"],
  ],
  "section-detours": [
    ["#FBF4E8", "M3 3h9v1h-9zM3 4h10v1h-10zM3 5h9v1h-9zM9 12h2v1h-2z"],
    ["#D9774F", "M4 9h9v1h-9zM3 10h11v1h-11zM4 11h9v1h-9z"],
    ["#C99A62", "M7 1h2v1h-2zM7 6h2v1h-2zM7 7h2v1h-2zM7 13h2v1h-2zM7 14h2v1h-2z"],
    ["var(--spO,#4A3228)", "M7 0h2v1h-2zM6 1h1v1h-1zM9 1h1v1h-1zM2 2h10v1h-10zM2 3h1v1h-1zM12 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM12 5h1v1h-1zM2 6h5v1h-5zM9 6h4v1h-4zM6 7h1v1h-1zM9 7h1v1h-1zM4 8h10v1h-10zM3 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM14 10h1v1h-1zM3 11h1v1h-1zM13 11h1v1h-1zM4 12h5v1h-5zM11 12h1v1h-1zM6 13h1v1h-1zM9 13h1v1h-1zM6 14h1v1h-1zM9 14h1v1h-1zM4 15h8v1h-8z"],
  ],
  "section-weekly": [
    ["#FBF4E8", "M3 3h2v1h-2zM11 3h2v1h-2zM3 4h10v1h-10zM3 5h10v1h-10zM3 6h1v1h-1zM6 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM6 7h7v1h-7zM3 8h10v1h-10zM3 9h1v1h-1zM6 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM6 10h7v1h-7zM3 11h10v1h-10zM3 12h1v1h-1zM6 12h1v1h-1zM12 12h1v1h-1zM3 13h1v1h-1zM6 13h7v1h-7zM3 14h10v1h-10z"],
    ["#8FA98A", "M4 6h2v1h-2zM4 7h2v1h-2zM4 9h2v1h-2zM4 10h2v1h-2zM4 12h2v1h-2zM4 13h2v1h-2z"],
    ["#F2C766", "M6 1h4v1h-4zM6 2h4v1h-4z"],
    ["var(--spO,#4A3228)", "M5 0h6v1h-6zM5 1h1v1h-1zM10 1h1v1h-1zM2 2h4v1h-4zM10 2h4v1h-4zM2 3h1v1h-1zM5 3h6v1h-6zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM7 6h5v1h-5zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM7 9h5v1h-5zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM7 12h5v1h-5zM13 12h1v1h-1zM2 13h1v1h-1zM13 13h1v1h-1zM2 14h1v1h-1zM13 14h1v1h-1zM2 15h12v1h-12z"],
  ],
  "section-keepsakes": [
    ["#F2C766", "M6 6h4v1h-4zM4 7h8v1h-8zM4 8h1v1h-1zM7 8h2v1h-2zM11 8h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM3 10h3v1h-3zM10 10h3v1h-3zM4 11h3v1h-3zM9 11h3v1h-3zM4 12h8v1h-8zM4 13h8v1h-8zM6 14h4v1h-4z"],
    ["#D9774F", "M5 8h2v1h-2zM9 8h2v1h-2zM5 9h6v1h-6zM6 10h4v1h-4zM7 11h2v1h-2z"],
    ["var(--spO,#4A3228)", "M3 0h1v1h-1zM12 0h1v1h-1zM4 1h1v1h-1zM11 1h1v1h-1zM5 2h1v1h-1zM10 2h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM6 5h4v1h-4zM4 6h2v1h-2zM10 6h2v1h-2zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h2v1h-2zM10 14h2v1h-2zM6 15h4v1h-4z"],
  ],
  "goal-show-up": [
    ["currentColor", "M3 1h3v1h-3zM3 2h1v1h-1zM5 2h1v1h-1zM3 3h1v1h-1zM5 3h1v1h-1zM3 4h1v1h-1zM5 4h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM3 6h1v1h-1zM5 6h1v1h-1zM3 7h1v1h-1zM5 7h1v1h-1zM3 8h10v1h-10zM3 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h10v1h-10zM3 12h2v1h-2zM11 12h2v1h-2zM3 13h10v1h-10zM3 14h2v1h-2zM11 14h2v1h-2zM3 15h2v1h-2zM11 15h2v1h-2z"],
    ["var(--ifill,#F3E6D2)", "M4 2h1v1h-1zM4 3h1v1h-1zM4 4h1v1h-1zM4 5h1v1h-1zM4 6h1v1h-1zM4 7h1v1h-1z"],
    ["var(--iacc,#B5573A)", "M4 9h8v1h-8zM4 10h8v1h-8z"],
  ],
  "goal-settle-in": [
    ["currentColor", "M6 2h4v1h-4zM5 3h1v1h-1zM10 3h1v1h-1zM4 4h1v1h-1zM11 4h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM1 8h4v1h-4zM11 8h4v1h-4zM1 9h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM4 10h1v1h-1zM11 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM4 11h1v1h-1zM11 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM11 12h1v1h-1zM14 12h1v1h-1zM1 13h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM1 14h4v1h-4zM11 14h4v1h-4z"],
    ["var(--ifill,#F3E6D2)", "M6 3h4v1h-4zM5 4h1v1h-1zM10 4h1v1h-1zM4 5h1v1h-1zM11 5h1v1h-1zM4 6h1v1h-1zM11 6h1v1h-1z"],
    ["var(--iacc,#B5573A)", "M2 9h2v1h-2zM12 9h2v1h-2zM2 10h2v1h-2zM12 10h2v1h-2zM2 11h2v1h-2zM12 11h2v1h-2zM2 12h2v1h-2zM12 12h2v1h-2zM2 13h2v1h-2zM12 13h2v1h-2z"],
  ],
  "goal-little-detours": [
    ["currentColor", "M10 2h3v1h-3zM9 3h1v1h-1zM13 3h1v1h-1zM9 4h1v1h-1zM13 4h1v1h-1zM9 5h1v1h-1zM13 5h1v1h-1zM10 6h3v1h-3zM2 7h3v1h-3zM1 8h1v1h-1zM5 8h1v1h-1zM10 8h3v1h-3zM1 9h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM1 10h1v1h-1zM5 10h1v1h-1zM10 10h3v1h-3zM2 11h3v1h-3zM2 13h3v1h-3zM2 14h1v1h-1zM4 14h1v1h-1zM2 15h3v1h-3z"],
    ["var(--ifill,#F3E6D2)", "M10 3h3v1h-3zM10 4h3v1h-3zM10 5h3v1h-3zM2 8h3v1h-3zM2 9h3v1h-3zM11 9h1v1h-1zM2 10h3v1h-3zM3 14h1v1h-1z"],
    ["var(--iacc,#B5573A)", "M9 0h1v1h-1zM11 0h1v1h-1zM13 0h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1z"],
  ],
  "section-firsts": [
    ["var(--spO,#4A3228)", "M3 3h10v1h-10zM3 4h1v1h-1zM12 4h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM3 12h10v1h-10z"],
    ["#A8C7D6", "M1 1h1v1h-1zM3 1h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM13 1h1v1h-1zM2 2h11v1h-11zM14 2h1v1h-1zM1 3h2v1h-2zM2 4h1v1h-1zM14 4h1v1h-1zM1 5h2v1h-2zM2 6h1v1h-1zM14 6h1v1h-1zM1 7h2v1h-2zM2 8h1v1h-1zM14 8h1v1h-1zM1 9h2v1h-2zM2 10h1v1h-1zM14 10h1v1h-1zM1 11h2v1h-2zM2 12h1v1h-1zM14 12h1v1h-1zM1 13h1v1h-1zM2 14h1v1h-1zM4 14h1v1h-1zM6 14h1v1h-1zM8 14h1v1h-1zM10 14h1v1h-1zM12 14h1v1h-1zM14 14h1v1h-1z"],
    ["#7FA3B5", "M13 2h1v1h-1zM13 3h1v1h-1zM13 4h1v1h-1zM13 5h1v1h-1zM13 6h1v1h-1zM13 7h1v1h-1zM13 8h1v1h-1zM13 9h1v1h-1zM13 10h1v1h-1zM13 11h1v1h-1zM13 12h1v1h-1zM2 13h12v1h-12z"],
    ["#FBF4E8", "M4 4h8v1h-8zM4 5h3v1h-3zM9 5h3v1h-3zM4 6h2v1h-2zM10 6h2v1h-2zM4 7h1v1h-1zM11 7h1v1h-1zM4 8h2v1h-2zM10 8h2v1h-2zM4 9h3v1h-3zM9 9h3v1h-3zM4 10h8v1h-8zM4 11h8v1h-8z"],
    ["#C4694A", "M7 5h2v1h-2zM6 6h4v1h-4zM5 7h6v1h-6zM6 8h4v1h-4zM7 9h2v1h-2z"],
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
