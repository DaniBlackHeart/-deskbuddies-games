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

// The wheel graphic's 24 wedges — same values/order as WHEEL_WEDGES in
// _shared/utils.ts, duplicated here for the same Deno/browser-boundary
// reason as everything else in this file. Landing here is still purely
// decorative (see WheelSpinner.tsx) — this is what makes the graphic show
// real, readable wedge values instead of a plain unlabeled color wheel.
export type WheelWedgeLayout = { type: string; value?: number };

export const WHEEL_WEDGE_LAYOUT: WheelWedgeLayout[] = [
  { type: "points", value: 500 },
  { type: "points", value: 600 },
  { type: "points", value: 700 },
  { type: "points", value: 300 },
  { type: "points", value: 400 },
  { type: "bankrupt" },
  { type: "points", value: 500 },
  { type: "points", value: 800 },
  { type: "points", value: 300 },
  { type: "points", value: 600 },
  { type: "lose_turn" },
  { type: "points", value: 700 },
  { type: "points", value: 400 },
  { type: "points", value: 500 },
  { type: "points", value: 900 },
  { type: "free_play" },
  { type: "points", value: 300 },
  { type: "points", value: 600 },
  { type: "wild_card" },
  { type: "points", value: 400 },
  { type: "mystery" },
  { type: "points", value: 700 },
  { type: "points", value: 300 },
  { type: "lose_turn" },
];

export function wedgeShortLabel(wedge: WheelWedgeLayout): string {
  switch (wedge.type) {
    case "points":
      return String(wedge.value ?? "");
    case "bankrupt":
      return "BANKRUPT";
    case "lose_turn":
      return "LOSE TURN";
    case "free_play":
      return "FREE PLAY";
    case "wild_card":
      return "WILD CARD";
    case "mystery":
      return "MYSTERY";
    default:
      return "";
  }
}

export function wedgeFillColor(wedge: WheelWedgeLayout, index: number): string {
  switch (wedge.type) {
    case "bankrupt":
      return "#3d3229"; // var(--color-text) — the board's own dark tone, unmistakably "bad"
    case "lose_turn":
      return "#7a6c5d"; // var(--color-text-muted)
    case "free_play":
      return "#6e9b5e"; // var(--color-success)
    case "wild_card":
      return "#d6a03c"; // var(--color-warning)
    case "mystery":
      return "#7c9473"; // var(--color-secondary)
    default:
      // Alternate the two brand tones for plain point wedges.
      return index % 2 === 0 ? "#d97a5f" : "#c8664b";
  }
}
