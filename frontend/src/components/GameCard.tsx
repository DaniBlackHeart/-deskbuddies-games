import { Link } from "react-router-dom";

type GameCardProps = {
  // Either a destination to navigate to, or a click handler to run directly
  // (e.g. "start a session") — provide exactly one. `to`-based cards are the
  // common case (see DashboardPage); `onClick` exists for tiles like MOD
  // Dashboard's UNO card that kick off an action instead of linking anywhere.
  to?: string;
  onClick?: () => void;
  emoji: string;
  title: string;
  description: string;
  disabled?: boolean;
  // For onClick cards: shows a "working on it" state (wait cursor, dimmed,
  // clicks ignored) while the action is in flight — mirrors `disabled`'s
  // styling but stays semantically distinct (temporary vs. permanently off).
  busy?: boolean;
  badge?: string;
};

export default function GameCard({
  to,
  onClick,
  emoji,
  title,
  description,
  disabled,
  busy,
  badge,
}: GameCardProps) {
  const content = (
    <div className="card" style={{ height: "100%", opacity: disabled ? 0.6 : busy ? 0.7 : 1 }}>
      <div className="row-between">
        <div style={{ fontSize: "2rem" }}>{emoji}</div>
        {badge && <span className="badge badge-neutral">{badge}</span>}
      </div>
      <h3 style={{ marginTop: "12px" }}>{title}</h3>
      <p className="text-muted" style={{ marginBottom: 0 }}>
        {description}
      </p>
    </div>
  );

  if (disabled) {
    return <div style={{ cursor: "not-allowed" }}>{content}</div>;
  }

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        onClick={() => !busy && onClick()}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={{ cursor: busy ? "wait" : "pointer", display: "block" }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link to={to ?? "#"} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {content}
    </Link>
  );
}
