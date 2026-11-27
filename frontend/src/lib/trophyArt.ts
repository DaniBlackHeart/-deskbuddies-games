// Buddy Boards trophy cups v1.8 (design canvas "Where the trophies go"). PROPOSED set: Rika has
// not reviewed it. Placeholder art, 16x16 grid. One cup in three finishes for 1st, 2nd and 3rd;
// the rim and face colours come from the .finish-gold / -silver / -bronze classes in tokens.css.
// The emblem on the cup differs by place (star, diamond, dot), so place is never colour alone.
// Layers: [fill, d, opacity?]. Outline follows --spO.

export type TrophyLayer = [fill: string, d: string, opacity?: number];

export const TROPHIES: Record<1 | 2 | 3, TrophyLayer[]> = {
  1: [
    ["var(--mf)", "M3 2h9v1h-9zM3 3h4v1h-4zM9 3h3v1h-3zM3 4h2v1h-2zM11 4h1v1h-1zM3 5h3v1h-3zM10 5h2v1h-2zM3 6h3v1h-3zM7 6h2v1h-2zM10 6h2v1h-2zM3 7h9v1h-9zM4 8h8v1h-8zM5 9h6v1h-6zM7 10h2v1h-2zM7 11h2v1h-2zM7 12h1v1h-1zM5 14h5v1h-5z"],
    ["var(--mr)", "M12 2h1v1h-1zM1 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM12 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM12 7h1v1h-1zM8 12h1v1h-1zM10 14h1v1h-1z"],
    ["#FFFFFF", "M3 2h1v1h-1zM3 3h1v1h-1zM3 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM3 7h1v1h-1z", 0.45],
    ["#B5573A", "M7 3h2v1h-2zM5 4h6v1h-6zM6 5h4v1h-4zM6 6h1v1h-1zM9 6h1v1h-1z"],
    ["var(--spO,#4A3228)", "M2 1h12v1h-12zM0 2h3v1h-3zM13 2h3v1h-3zM0 3h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM15 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM15 4h1v1h-1zM0 5h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM15 5h1v1h-1zM0 6h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM15 6h1v1h-1zM0 7h3v1h-3zM13 7h3v1h-3zM3 8h1v1h-1zM12 8h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM5 10h2v1h-2zM9 10h2v1h-2zM6 11h1v1h-1zM9 11h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM5 13h6v1h-6zM4 14h1v1h-1zM11 14h1v1h-1zM4 15h8v1h-8z"],
  ],
  2: [
    ["var(--mf)", "M3 2h9v1h-9zM3 3h4v1h-4zM9 3h3v1h-3zM3 4h3v1h-3zM10 4h2v1h-2zM3 5h4v1h-4zM9 5h3v1h-3zM3 6h9v1h-9zM3 7h9v1h-9zM4 8h8v1h-8zM5 9h6v1h-6zM7 10h2v1h-2zM7 11h2v1h-2zM7 12h1v1h-1zM5 14h5v1h-5z"],
    ["var(--mr)", "M12 2h1v1h-1zM1 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM12 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM12 7h1v1h-1zM8 12h1v1h-1zM10 14h1v1h-1z"],
    ["#FFFFFF", "M3 2h1v1h-1zM3 3h1v1h-1zM3 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM3 7h1v1h-1z", 0.45],
    ["#B5573A", "M7 3h2v1h-2zM6 4h4v1h-4zM7 5h2v1h-2z"],
    ["var(--spO,#4A3228)", "M2 1h12v1h-12zM0 2h3v1h-3zM13 2h3v1h-3zM0 3h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM15 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM15 4h1v1h-1zM0 5h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM15 5h1v1h-1zM0 6h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM15 6h1v1h-1zM0 7h3v1h-3zM13 7h3v1h-3zM3 8h1v1h-1zM12 8h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM5 10h2v1h-2zM9 10h2v1h-2zM6 11h1v1h-1zM9 11h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM5 13h6v1h-6zM4 14h1v1h-1zM11 14h1v1h-1zM4 15h8v1h-8z"],
  ],
  3: [
    ["var(--mf)", "M3 2h9v1h-9zM3 3h9v1h-9zM3 4h4v1h-4zM9 4h3v1h-3zM3 5h4v1h-4zM9 5h3v1h-3zM3 6h9v1h-9zM3 7h9v1h-9zM4 8h8v1h-8zM5 9h6v1h-6zM7 10h2v1h-2zM7 11h2v1h-2zM7 12h1v1h-1zM5 14h5v1h-5z"],
    ["var(--mr)", "M12 2h1v1h-1zM1 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM12 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM12 7h1v1h-1zM8 12h1v1h-1zM10 14h1v1h-1z"],
    ["#FFFFFF", "M3 2h1v1h-1zM3 3h1v1h-1zM3 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM3 7h1v1h-1z", 0.45],
    ["#B5573A", "M7 4h2v1h-2zM7 5h2v1h-2z"],
    ["var(--spO,#4A3228)", "M2 1h12v1h-12zM0 2h3v1h-3zM13 2h3v1h-3zM0 3h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM15 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM15 4h1v1h-1zM0 5h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM15 5h1v1h-1zM0 6h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM15 6h1v1h-1zM0 7h3v1h-3zM13 7h3v1h-3zM3 8h1v1h-1zM12 8h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM5 10h2v1h-2zM9 10h2v1h-2zM6 11h1v1h-1zM9 11h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM5 13h6v1h-6zM4 14h1v1h-1zM11 14h1v1h-1zM4 15h8v1h-8z"],
  ],
};

export const TROPHY_FINISH = { 1: "gold", 2: "silver", 3: "bronze" } as const;
