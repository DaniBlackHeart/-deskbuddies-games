import { useAuth } from "../contexts/AuthContext";

export default function NotAMemberPage() {
  const { signOut, retryVerification, status } = useAuth();

  return (
    <div className="center-screen">
      <div className="card container--narrow text-center">
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🔒</div>
        <h1>Members only</h1>
        <p className="text-muted">
          This app is just for DeskBuddies server members. We couldn't find your Discord
          account in the server — join DeskBuddies first, then come back and try again.
        </p>
        <div className="stack">
          <button
            className="btn btn-primary btn-block"
            onClick={() => retryVerification()}
            disabled={status === "verifying"}
          >
            {status === "verifying" ? <span className="spinner" /> : "I just joined — check again"}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
