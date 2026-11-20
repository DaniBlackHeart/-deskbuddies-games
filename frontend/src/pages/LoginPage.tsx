import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthScreen from "../components/AuthScreen";

export default function LoginPage() {
  const { status, verifyError, signInWithDiscord } = useAuth();

  if (status === "member") return <Navigate to="/" replace />;
  if (status === "not_a_member") return <Navigate to="/not-a-member" replace />;

  const checking = status === "verifying" || status === "loading";

  return (
    <AuthScreen title="Debbie" lead="Pull up a chair.">
      <p className="t-body text-muted" style={{ margin: 0 }}>
        The DeskBuddies companion app. Sign in with your Discord account to jump in.
      </p>

      {verifyError && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {verifyError}
        </p>
      )}

      <button
        className="btn btn-primary btn-block db-auth__btn"
        disabled={checking}
        onClick={() => signInWithDiscord()}
      >
        {checking ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Checking…
          </>
        ) : (
          "Sign in with Discord"
        )}
      </button>

      <p className="t-caption text-muted" style={{ margin: 0 }}>
        You'll need to be a member of the DeskBuddies Discord server.
      </p>
    </AuthScreen>
  );
}
