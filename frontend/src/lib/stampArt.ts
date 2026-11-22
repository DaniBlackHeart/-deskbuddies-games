// Firsts stamps, from the locked Stamps v1 set shown in the "Debbie Buddybook" design.
// Postage-style, 16x16 grid, drawn at 64px. "#4A3228" is the outline and follows --spO
// so it reads on light and dark paper. Keyed by stamp key (supabase stamp_defs.key).

export type StampArt = [fill: string, d: string][];

export const STAMP_ART: Record<string, StampArt> = {
  stamp_first_hello: [
    ["var(--spO,#4A3228)", "M3 1h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM13 1h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM5 4h6v1h-6zM1 5h1v1h-1zM4 5h1v1h-1zM11 5h1v1h-1zM14 5h1v1h-1zM4 6h1v1h-1zM11 6h1v1h-1zM1 7h1v1h-1zM4 7h1v1h-1zM11 7h1v1h-1zM14 7h1v1h-1zM5 8h6v1h-6zM1 9h1v1h-1zM6 9h1v1h-1zM8 9h1v1h-1zM14 9h1v1h-1zM6 10h2v1h-2zM1 11h1v1h-1zM14 11h1v1h-1zM1 13h1v1h-1zM14 13h1v1h-1zM3 14h1v1h-1zM5 14h1v1h-1zM7 14h1v1h-1zM9 14h1v1h-1zM11 14h1v1h-1zM13 14h1v1h-1z"],
    ["#E8977A", "M2 2h12v1h-12zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM5 5h6v1h-6zM13 5h1v1h-1zM2 6h1v1h-1zM5 6h1v1h-1zM7 6h1v1h-1zM9 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM5 7h6v1h-6zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM7 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM2 13h12v1h-12z"],
    ["#FBF4E8", "M3 3h10v1h-10zM3 4h2v1h-2zM11 4h2v1h-2zM3 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h2v1h-2zM11 8h2v1h-2zM3 9h3v1h-3zM9 9h4v1h-4zM3 10h3v1h-3zM8 10h5v1h-5zM3 11h10v1h-10zM3 12h10v1h-10z"],
    ["#FFFFFF", "M6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1z"],
  ],
  stamp_first_block: [
    ["var(--spO,#4A3228)", "M3 1h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM13 1h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM4 4h8v1h-8zM1 5h1v1h-1zM5 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM7 7h2v1h-2zM14 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM1 9h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM14 9h1v1h-1zM4 10h8v1h-8zM1 11h1v1h-1zM14 11h1v1h-1zM1 13h1v1h-1zM14 13h1v1h-1zM3 14h1v1h-1zM5 14h1v1h-1zM7 14h1v1h-1zM9 14h1v1h-1zM11 14h1v1h-1zM13 14h1v1h-1z"],
    ["#A9C2A4", "M2 2h12v1h-12zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM6 5h4v1h-4zM13 5h1v1h-1zM2 6h1v1h-1zM7 6h2v1h-2zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM7 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM6 9h4v1h-4zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM2 13h12v1h-12z"],
    ["#FBF4E8", "M3 3h10v1h-10zM3 4h1v1h-1zM12 4h1v1h-1zM3 5h2v1h-2zM11 5h2v1h-2zM3 6h3v1h-3zM10 6h3v1h-3zM3 7h4v1h-4zM9 7h4v1h-4zM3 8h3v1h-3zM10 8h3v1h-3zM3 9h2v1h-2zM11 9h2v1h-2zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h10v1h-10zM3 12h10v1h-10z"],
    ["#FFFFFF", "M8 8h1v1h-1z"],
  ],
  stamp_first_detour: [
    ["var(--spO,#4A3228)", "M5 3h6v1h-6zM4 4h1v1h-1zM11 4h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM4 11h1v1h-1zM11 11h1v1h-1zM5 12h6v1h-6z"],
    ["#F2C766", "M5 4h6v1h-6zM4 5h1v1h-1zM7 5h5v1h-5zM4 6h1v1h-1zM6 6h6v1h-6zM4 7h8v1h-8zM4 8h8v1h-8zM4 9h6v1h-6zM4 10h5v1h-5zM6 11h4v1h-4z"],
    ["#FFF0C2", "M5 5h2v1h-2zM5 6h1v1h-1z"],
    ["#D9A13B", "M10 9h2v1h-2zM9 10h3v1h-3zM5 11h1v1h-1zM10 11h1v1h-1z"],
  ],
  stamp_first_win: [
    ["#B8A082", "M3 1h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM13 1h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM1 13h1v1h-1zM14 13h1v1h-1zM3 14h1v1h-1zM5 14h1v1h-1zM7 14h1v1h-1zM9 14h1v1h-1zM11 14h1v1h-1zM13 14h1v1h-1z"],
    ["#DCCAB0", "M2 2h12v1h-12zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM7 4h2v1h-2zM13 4h1v1h-1zM2 5h1v1h-1zM6 5h4v1h-4zM13 5h1v1h-1zM2 6h1v1h-1zM4 6h8v1h-8zM13 6h1v1h-1zM2 7h1v1h-1zM4 7h8v1h-8zM13 7h1v1h-1zM2 8h1v1h-1zM5 8h6v1h-6zM13 8h1v1h-1zM2 9h1v1h-1zM6 9h4v1h-4zM13 9h1v1h-1zM2 10h1v1h-1zM5 10h6v1h-6zM13 10h1v1h-1zM2 11h1v1h-1zM5 11h2v1h-2zM9 11h2v1h-2zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM2 13h12v1h-12z"],
    ["#FFFDF8", "M3 3h10v1h-10zM3 4h4v1h-4zM9 4h4v1h-4zM3 5h3v1h-3zM10 5h3v1h-3zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM3 8h2v1h-2zM11 8h2v1h-2zM3 9h3v1h-3zM10 9h3v1h-3zM3 10h2v1h-2zM11 10h2v1h-2zM3 11h2v1h-2zM7 11h2v1h-2zM11 11h2v1h-2zM3 12h10v1h-10z"],
  ],
  stamp_made_it_mine: [
    ["var(--spO,#4A3228)", "M3 1h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM13 1h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM5 4h2v1h-2zM9 4h2v1h-2zM1 5h1v1h-1zM4 5h1v1h-1zM11 5h1v1h-1zM14 5h1v1h-1zM4 6h1v1h-1zM11 6h1v1h-1zM1 7h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM14 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM1 9h1v1h-1zM7 9h2v1h-2zM14 9h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM1 13h1v1h-1zM14 13h1v1h-1zM3 14h1v1h-1zM5 14h1v1h-1zM7 14h1v1h-1zM9 14h1v1h-1zM11 14h1v1h-1zM13 14h1v1h-1z"],
    ["#E8977A", "M2 2h12v1h-12zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM5 5h1v1h-1zM7 5h4v1h-4zM13 5h1v1h-1zM2 6h1v1h-1zM5 6h6v1h-6zM13 6h1v1h-1zM2 7h1v1h-1zM6 7h4v1h-4zM13 7h1v1h-1zM2 8h1v1h-1zM7 8h2v1h-2zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM2 13h12v1h-12z"],
    ["#FBF4E8", "M3 3h10v1h-10zM3 4h2v1h-2zM7 4h2v1h-2zM11 4h2v1h-2zM3 5h1v1h-1zM12 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM3 7h2v1h-2zM11 7h2v1h-2zM3 8h3v1h-3zM10 8h3v1h-3zM3 9h4v1h-4zM9 9h4v1h-4zM3 10h10v1h-10zM3 11h10v1h-10zM3 12h10v1h-10z"],
    ["#FFFFFF", "M6 5h1v1h-1z"],
  ],
};
