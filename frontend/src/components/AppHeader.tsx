import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AppHeader() {
  const { profile, signOut } = useAuth();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border-soft)",
        background: "var(--color-surface)",
      }}
    >
      <div className="container row-between" style={{ padding: "16px 24px" }}>
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="row" style={{ gap: "8px" }}>
            <span style={{ fontSize: "1.4rem" }}>🎲</span>
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem" }}>
              DeskBuddies Games
            </strong>
          </div>
        </Link>

        <div className="row">
          {profile?.is_mod && (
            <Link to="/mod" className="btn btn-secondary btn-sm">
              🛠️ MOD Dashboard
            </Link>
          )}
          <div className="row" style={{ gap: "8px" }}>
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                width={28}
                height={28}
                style={{ borderRadius: "50%" }}
              />
            )}
            <span className="text-muted" style={{ fontSize: "0.9rem" }}>
              {profile?.username}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
