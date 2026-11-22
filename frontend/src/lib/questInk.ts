// Side Quest ink marks, from the "Debbie Buddybook" design (placeholder art). 16x16, drawn at 64px.
// Quests without their own mark use the mark for their theme.

export const QUEST_INK: Record<string, [fill: string, d: string]> = {
  sq_name_that_tree: ["#2F5F9A", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM6 4h3v1h-3zM14 4h1v1h-1zM1 5h1v1h-1zM5 5h5v1h-5zM14 5h1v1h-1zM0 6h2v1h-2zM4 6h7v1h-7zM14 6h2v1h-2zM0 7h1v1h-1zM5 7h5v1h-5zM15 7h1v1h-1zM0 8h1v1h-1zM4 8h7v1h-7zM15 8h1v1h-1zM0 9h2v1h-2zM7 9h2v1h-2zM14 9h2v1h-2zM1 10h1v1h-1zM7 10h2v1h-2zM14 10h1v1h-1zM1 11h1v1h-1zM6 11h4v1h-4zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM6 15h4v1h-4z"],
  sq_touch_grass: ["#3F7A45", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM14 5h1v1h-1zM0 6h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1zM8 6h2v1h-2zM11 6h1v1h-1zM14 6h2v1h-2zM0 7h1v1h-1zM4 7h1v1h-1zM6 7h4v1h-4zM11 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM4 8h8v1h-8zM15 8h1v1h-1zM0 9h2v1h-2zM4 9h8v1h-8zM14 9h2v1h-2zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h1v1h-1zM11 14h1v1h-1zM6 15h4v1h-4z"],
  sq_dance_it_out: ["#A94F33", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM7 4h4v1h-4zM14 4h1v1h-1zM1 5h1v1h-1zM7 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM0 6h2v1h-2zM7 6h1v1h-1zM10 6h1v1h-1zM14 6h2v1h-2zM0 7h1v1h-1zM7 7h1v1h-1zM10 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM5 8h3v1h-3zM9 8h3v1h-3zM15 8h1v1h-1zM0 9h2v1h-2zM5 9h3v1h-3zM9 9h3v1h-3zM14 9h2v1h-2zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM6 15h4v1h-4z"],
  sq_read_outside: ["#3F7A45", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM5 5h2v1h-2zM9 5h2v1h-2zM14 5h1v1h-1zM0 6h2v1h-2zM4 6h1v1h-1zM7 6h2v1h-2zM11 6h1v1h-1zM14 6h2v1h-2zM0 7h1v1h-1zM4 7h1v1h-1zM7 7h2v1h-2zM11 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM4 8h1v1h-1zM7 8h2v1h-2zM11 8h1v1h-1zM15 8h1v1h-1zM0 9h2v1h-2zM4 9h1v1h-1zM7 9h2v1h-2zM11 9h1v1h-1zM14 9h2v1h-2zM1 10h1v1h-1zM5 10h6v1h-6zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM6 15h4v1h-4z"],
  sq_kumustahan: ["#B03A5B", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM5 4h6v1h-6zM14 4h1v1h-1zM1 5h1v1h-1zM4 5h1v1h-1zM11 5h1v1h-1zM14 5h1v1h-1zM0 6h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM11 6h1v1h-1zM14 6h2v1h-2zM0 7h1v1h-1zM4 7h1v1h-1zM7 7h2v1h-2zM11 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM5 8h6v1h-6zM15 8h1v1h-1zM0 9h2v1h-2zM6 9h1v1h-1zM14 9h2v1h-2zM1 10h1v1h-1zM5 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h1v1h-1zM6 14h1v1h-1zM9 14h3v1h-3zM6 15h4v1h-4z"],
  sq_savor_it: ["#8A5A00", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM8 5h1v1h-1zM14 5h1v1h-1zM0 6h2v1h-2zM14 6h2v1h-2zM0 7h1v1h-1zM4 7h6v1h-6zM15 7h1v1h-1zM0 8h1v1h-1zM4 8h1v1h-1zM9 8h3v1h-3zM15 8h1v1h-1zM0 9h2v1h-2zM4 9h1v1h-1zM9 9h1v1h-1zM11 9h1v1h-1zM14 9h2v1h-2zM1 10h1v1h-1zM4 10h1v1h-1zM9 10h3v1h-3zM14 10h1v1h-1zM1 11h1v1h-1zM5 11h4v1h-4zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM6 15h4v1h-4z"],
  sq_three_good_things: ["#6E4FA0", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM4 5h3v1h-3zM9 5h3v1h-3zM14 5h1v1h-1zM0 6h2v1h-2zM5 6h1v1h-1zM10 6h1v1h-1zM14 6h2v1h-2zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM7 8h1v1h-1zM15 8h1v1h-1zM0 9h2v1h-2zM6 9h3v1h-3zM14 9h2v1h-2zM1 10h1v1h-1zM7 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM6 15h4v1h-4z"],
  sq_first_light: ["#3F7A45", "M6 0h4v1h-4zM4 1h3v1h-3zM9 1h3v1h-3zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM7 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM7 5h1v1h-1zM9 5h1v1h-1zM14 5h1v1h-1zM0 6h2v1h-2zM6 6h3v1h-3zM14 6h2v1h-2zM0 7h1v1h-1zM5 7h5v1h-5zM15 7h1v1h-1zM0 8h1v1h-1zM4 8h8v1h-8zM15 8h1v1h-1zM0 9h2v1h-2zM14 9h2v1h-2zM1 10h1v1h-1zM4 10h8v1h-8zM14 10h1v1h-1zM1 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h3v1h-3zM9 14h3v1h-3zM6 15h4v1h-4z"],
};

export const THEME_INK: Record<string, string> = {
  New: "sq_name_that_tree",
  Outside: "sq_touch_grass",
  Move: "sq_dance_it_out",
  Connect: "sq_kumustahan",
  Community: "sq_kumustahan",
  Gratitude: "sq_savor_it",
  Positivity: "sq_three_good_things",
};

export function inkFor(questKey: string, theme: string): [string, string] | null {
  return QUEST_INK[questKey] ?? QUEST_INK[THEME_INK[theme] ?? ""] ?? null;
}
