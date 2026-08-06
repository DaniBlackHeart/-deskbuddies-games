import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { status, verifyError, signInWithDiscord } = useAuth();

  if (status === "member") return <Navigate to="/" replace />;
  if (status === "not_a_member") return <Navigate to="/not-a-member" replace />;

  return (
    <div className="center-screen">
      <div className="card container--narrow text-center">
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🎲</div>
        <h1>DeskBuddies Games</h1>
        <p className="text-muted">
          Trivia Night and more, made for the DeskBuddies crew. Sign in with your Discord
          account to play.
        </p>

        {verifyError && <p className="error-text">{verifyError}</p>}

        <button
          className="btn btn-primary btn-block"
          disabled={status === "verifying" || status === "loading"}
          onClick={() => signInWithDiscord()}
        >
          {status === "verifying" || status === "loading" ? (
            <span className="spinner" />
          ) : (
            <>💬 Sign in with Discord</>
          )}
        </button>

        <p className="hint" style={{ marginTop: "16px" }}>
          You'll need to be a member of the DeskBuddies Discord server.
        </p>
      </div>
    </div>
  );
}
