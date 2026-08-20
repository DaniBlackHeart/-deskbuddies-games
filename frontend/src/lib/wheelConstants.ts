// Wheel of Fortune — frontend-side constants.
// Deliberately duplicated from supabase/functions/_shared/utils.ts rather
// than imported — that file is Deno-only (Deno.env, npm: specifiers) and
// isn't part of the Vite bundle. Same "small duplication flagged, not
// worth centralizing" spirit as randomJoinCode/broadcast noted in
// PROJECT_CONTEXT.md. Keep these in sync if the server-side values change.

export const WHEEL_VOWELS = ["A", "E", "I", "O", "U"];
export const WHEEL_CONSONANTS = [
  "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
];

export const WHEEL_VOWEL_COST = 350;
export const WHEEL_MIN_PLAYERS = 2;
export const WHEEL_MAX_PLAYERS = 10;
export const WHEEL_MAIN_ROUNDS = 5;
export const WHEEL_BONUS_GIVEN_LETTERS = ["R", "S", "T", "L", "N", "E"];

export function wedgeLabel(wedge: { type: string; value?: number } | null | undefined): string {
  if (!wedge) return "";
  switch (wedge.type) {
    case "points":
      return `${wedge.value} points`;
    case "bankrupt":
      return "BANKRUPT!";
    case "lose_turn":
      return "Lose a Turn";
    case "free_play":
      return "Free Play!";
    case "wild_card":
      return "Wild Card!";
    case "mystery":
      return "Mystery Wedge";
    default:
      return "";
  }
}
