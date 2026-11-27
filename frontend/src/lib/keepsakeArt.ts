// Keepsake medals v1.7 (design canvas "One medal per Keepsake card"). Placeholder art,
// 16x16 grid. Each card has its own picture inside a round medal; the finish (bronze,
// silver, gold) changes only the rim and face colour, set by the .finish-* classes in
// tokens.css. Outline and glyph follow --spO. Keyed by keepsake card key (supabase
// keep_defs.key). Platinum is a proposal and is not drawn here.

export const MEDAL = {
  outline: "M7 0h2v1h-2zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM15 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM7 15h2v1h-2z",
  rim: "M7 1h2v1h-2zM4 2h3v1h-3zM9 2h3v1h-3zM3 3h2v1h-2zM11 3h2v1h-2zM2 4h2v1h-2zM12 4h2v1h-2zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h2v1h-2zM12 11h2v1h-2zM3 12h2v1h-2zM11 12h2v1h-2zM4 13h3v1h-3zM9 13h3v1h-3zM7 14h2v1h-2z",
  face: "M7 2h2v1h-2zM5 3h6v1h-6zM4 4h8v1h-8zM3 5h10v1h-10zM3 6h10v1h-10zM2 7h12v1h-12zM2 8h12v1h-12zM3 9h10v1h-10zM3 10h10v1h-10zM4 11h8v1h-8zM5 12h6v1h-6zM7 13h2v1h-2z",
};

export const MEDAL_GLYPHS: Record<string, { accent: string; glyph: string }> = {
  keep_streak: { accent: "M7 7h1v1h-1zM6 8h3v1h-3zM6 9h4v1h-4zM7 10h2v1h-2z", glyph: "M7 4h1v1h-1zM6 5h3v1h-3zM5 6h5v1h-5zM5 7h2v1h-2zM8 7h3v1h-3zM4 8h2v1h-2zM9 8h3v1h-3zM4 9h2v1h-2zM10 9h2v1h-2zM5 10h2v1h-2zM9 10h2v1h-2zM6 11h4v1h-4z" }, // Buddy Streak
  keep_seat: { accent: "M6 7h4v1h-4zM6 8h4v1h-4z", glyph: "M5 4h6v1h-6zM5 5h6v1h-6zM5 6h1v1h-1zM10 6h1v1h-1zM4 7h2v1h-2zM10 7h2v1h-2zM4 8h2v1h-2zM10 8h2v1h-2zM4 9h8v1h-8zM5 10h1v1h-1zM10 10h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1z" }, // Regular Seat
  keep_seasons: { accent: "M5 6h6v1h-6z", glyph: "M5 4h1v1h-1zM10 4h1v1h-1zM4 5h8v1h-8zM4 6h1v1h-1zM11 6h1v1h-1zM4 7h1v1h-1zM11 7h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM10 8h2v1h-2zM4 9h1v1h-1zM11 9h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM8 10h1v1h-1zM10 10h2v1h-2zM4 11h8v1h-8z" }, // Across the Seasons
  keep_welcome_back: { accent: "M7 9h2v1h-2zM7 10h2v1h-2z", glyph: "M7 4h2v1h-2zM6 5h4v1h-4zM5 6h6v1h-6zM4 7h8v1h-8zM5 8h1v1h-1zM10 8h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM5 10h1v1h-1zM10 10h1v1h-1zM5 11h6v1h-6z" }, // Welcome Back
  keep_focus: { accent: "M7 7h1v1h-1zM7 8h1v1h-1zM7 9h3v1h-3z", glyph: "M6 4h4v1h-4zM7 5h2v1h-2zM5 6h6v1h-6zM4 7h2v1h-2zM10 7h2v1h-2zM4 8h1v1h-1zM11 8h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM4 10h2v1h-2zM10 10h2v1h-2zM5 11h6v1h-6z" }, // Deep Desk
  keep_long_haul: { accent: "M6 5h4v1h-4zM7 6h2v1h-2zM7 9h2v1h-2zM6 10h4v1h-4z", glyph: "M4 4h8v1h-8zM5 5h1v1h-1zM10 5h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM7 7h2v1h-2zM7 8h2v1h-2zM6 9h1v1h-1zM9 9h1v1h-1zM5 10h1v1h-1zM10 10h1v1h-1zM4 11h8v1h-8z" }, // Long Haul
  keep_detour: { accent: "M6 6h4v1h-4z", glyph: "M7 4h2v1h-2zM5 5h5v1h-5zM5 6h1v1h-1zM10 6h1v1h-1zM5 7h5v1h-5zM7 8h2v1h-2zM7 9h2v1h-2zM7 10h2v1h-2zM6 11h4v1h-4z" }, // Daily Detours
  keep_many_detours: { accent: "M4 4h1v1h-1zM11 4h1v1h-1zM7 9h2v1h-2zM7 10h2v1h-2zM7 11h2v1h-2z", glyph: "M5 5h1v1h-1zM10 5h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM7 7h2v1h-2zM7 8h2v1h-2z" }, // Many Detours
  keep_wins: { accent: "M5 7h1v1h-1zM5 9h1v1h-1z", glyph: "M6 4h4v1h-4zM4 5h8v1h-8zM4 6h1v1h-1zM11 6h1v1h-1zM4 7h1v1h-1zM7 7h3v1h-3zM11 7h1v1h-1zM4 8h1v1h-1zM11 8h1v1h-1zM4 9h1v1h-1zM7 9h3v1h-3zM11 9h1v1h-1zM4 10h1v1h-1zM11 10h1v1h-1zM4 11h8v1h-8z" }, // Weekly Wins
  keep_full_week: { accent: "M6 7h4v1h-4zM7 8h2v1h-2z", glyph: "M7 4h2v1h-2zM7 5h2v1h-2zM4 6h8v1h-8zM5 7h1v1h-1zM10 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM5 9h2v1h-2zM9 9h2v1h-2zM5 10h1v1h-1zM10 10h1v1h-1zM4 11h1v1h-1zM11 11h1v1h-1z" }, // A Full Week
};
