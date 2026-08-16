import type { UnoCard } from "../types";

type UnoCardViewProps = {
  card: UnoCard;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
};

const VALUE_LABELS: Record<string, string> = {
  skip: "⊘",
  reverse: "⇄",
  draw2: "+2",
  wild: "★",
  wild4: "+4",
};

/** A single UNO card face. Also used face-down for the draw pile and other players' hands. */
export default function UnoCardView({ card, onClick, disabled, size = "md", faceDown }: UnoCardViewProps) {
  if (faceDown) {
    return <div className={`uno-card uno-card--back uno-card--${size}`} aria-hidden="true" />;
  }

  const label = VALUE_LABELS[card.value] ?? card.value;

  return (
    <button
      type="button"
      className={`uno-card uno-card--${card.color} uno-card--${size} ${onClick ? "uno-card--playable" : ""}`}
      onClick={onClick}
      disabled={!onClick || disabled}
      aria-label={`${card.color === "wild" ? "Wild" : card.color} ${label}`}
    >
      <span className="uno-card__corner uno-card__corner--tl">{label}</span>
      <span className="uno-card__value">{label}</span>
      <span className="uno-card__corner uno-card__corner--br">{label}</span>
    </button>
  );
}
