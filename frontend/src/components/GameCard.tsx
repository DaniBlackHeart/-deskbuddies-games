import { Link } from "react-router-dom";

type GameCardProps = {
  to: string;
  emoji: string;
  title: string;
  description: string;
  disabled?: boolean;
  badge?: string;
};

export default function GameCard({ to, emoji, title, description, disabled, badge }: GameCardProps) {
  const content = (
    <div className="card" style={{ height: "100%", opacity: disabled ? 0.6 : 1 }}>
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

  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {content}
    </Link>
  );
}
