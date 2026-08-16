import type { UnoCard, UnoColor, UnoPendingDrawType } from "../types";

/**
 * UI-hinting only — mirrors supabase/functions/_shared/utils.ts's
 * isUnoLegalPlayAgainst. The server re-validates everything; this just
 * decides which cards look tappable so people aren't guessing.
 */
export function isUnoLegalPlayAgainst(card: UnoCard, discardTop: UnoCard, currentColor: UnoColor, pendingDrawType: UnoPendingDrawType): boolean {
  if (pendingDrawType === "draw_two") return card.value === "draw2";
  if (pendingDrawType === "draw_four") return card.value === "wild4";
  if (card.color === "wild") return true;
  return card.color === currentColor || card.value === discardTop.value;
}

export function isUnoJumpInMatch(card: UnoCard, discardTop: UnoCard): boolean {
  return card.color === discardTop.color && card.value === discardTop.value;
}

export function isUnoWildCard(card: UnoCard): boolean {
  return card.color === "wild";
}
