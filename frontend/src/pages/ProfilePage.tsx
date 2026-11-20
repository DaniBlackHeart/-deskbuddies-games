import AppHeader from "../components/AppHeader";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../lib/theme";

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice());

  function pickTheme(choice: ThemeChoice) {
    setTheme(choice);
    setThemeChoice(choice);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow db-page">
        <h1 className="t-h1">Profile</h1>
        <div className="card">
          <div className="row" style={{ gap: "12px" }}>
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                width={56}
                height={56}
                style={{ borderRadius: "50%" }}
              />
            )}
            <div>
              <strong>{profile?.username}</strong>
              {profile?.is_mod && (
                <span className="badge badge-mod" style={{ marginLeft: "8px" }}>
                  MOD
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <h2 className="t-h3" style={{ marginTop: 0 }}>
            Appearance
          </h2>
          <p className="text-muted t-body-sm">Dark mode is new. If a screen looks off, switch back to light.</p>
          <div role="group" aria-label="Theme" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {(
              [
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "Match my device"],
              ] as [ThemeChoice, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                className={"btn " + (theme === value ? "btn-primary" : "btn-secondary")}
                aria-pressed={theme === value}
                onClick={() => pickTheme(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "var(--space-5)" }}>
          <button className="btn btn-secondary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
