import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="center-screen">
      <div className="stack text-center">
        <div className="spinner" style={{ margin: "0 auto" }} />
        <p className="text-muted">{label}</p>
      </div>
    </div>
  );
}

/** Requires a verified DeskBuddies member. Redirects appropriately otherwise. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading" || status === "verifying") {
    return <FullScreenLoader label="Checking your DeskBuddies membership…" />;
  }
  if (status === "signed_out") {
    return <Navigate to="/login" replace />;
  }
  if (status === "not_a_member") {
    return <Navigate to="/not-a-member" replace />;
  }
  return <>{children}</>;
}

/** Requires a verified member who also holds the MOD role in Discord. */
export function ModRoute({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();

  if (status === "loading" || status === "verifying") {
    return <FullScreenLoader label="Checking your DeskBuddies membership…" />;
  }
  if (status === "signed_out") {
    return <Navigate to="/login" replace />;
  }
  if (status === "not_a_member") {
    return <Navigate to="/not-a-member" replace />;
  }
  if (!profile?.is_mod) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
