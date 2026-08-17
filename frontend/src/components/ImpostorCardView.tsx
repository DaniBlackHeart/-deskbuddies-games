import type { ImpostorCard } from "../types";

type ImpostorCardViewProps = {
  card: ImpostorCard | null;
  revealed: boolean;
  onReveal?: () => void;
};

/**
 * The player's own secret card. Starts face-down (mirrors handing someone
 * a physical card face-down) — tapping flips it. Crew members see their
 * category + word; the impostor sees only the category, framed as their
 * one clue for bluffing.
 */
export default function ImpostorCardView({ card, revealed, onReveal }: ImpostorCardViewProps) {
  if (!card) return null;

  if (!revealed) {
    return (
      <button type="button" className="impostor-card impostor-card--back" onClick={onReveal} aria-label="Reveal your card">
        <span className="impostor-card__back-icon">🂠</span>
        <span className="impostor-card__back-label">Tap to reveal your card</span>
      </button>
    );
  }

  if (card.is_impostor) {
    return (
      <div className="impostor-card impostor-card--impostor">
        <span className="impostor-card__eyebrow">🎭 You're the Impostor</span>
        <span className="impostor-card__word impostor-card__word--impostor">???</span>
        <span className="impostor-card__hint">Your only clue — category: {card.category_name}</span>
      </div>
    );
  }

  return (
    <div className="impostor-card impostor-card--crew">
      <span className="impostor-card__eyebrow">Category: {card.category_name}</span>
      <span className="impostor-card__word">{card.word}</span>
      <span className="impostor-card__hint">Give a clue without saying the word</span>
    </div>
  );
}
