import AppHeader from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";

export default function ProfilePage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <h1>Profile</h1>
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

        <div style={{ marginTop: "var(--space-5)" }}>
          <button className="btn btn-secondary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
