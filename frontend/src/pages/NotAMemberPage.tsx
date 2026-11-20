import { useAuth } from "../contexts/AuthContext";
import AuthScreen from "../components/AuthScreen";

export default function NotAMemberPage() {
  const { signOut, retryVerification, status } = useAuth();
  const checking = status === "verifying";

  return (
    <AuthScreen title="Members only" lead="This seat is for DeskBuddies members.">
      <p className="t-body text-muted" style={{ margin: 0 }}>
        We couldn't find your Discord account in the server. Join DeskBuddies first, then come
        back and try again.
      </p>
      <button
        className="btn btn-primary btn-block db-auth__btn"
        onClick={() => retryVerification()}
        disabled={checking}
      >
        {checking ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Checking…
          </>
        ) : (
          "I just joined — check again"
        )}
      </button>
      <button className="btn btn-ghost btn-block" onClick={() => signOut()}>
        Sign out
      </button>
    </AuthScreen>
  );
}
