import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";

type ActiveSession = {
  id: string;
  status: string;
  mode: string;
  spectator_id: string | null;
  question_sets: { name: string } | null;
  spectator: { username: string } | null;
};

type ActiveFeudSession = {
  id: string;
  status: string;
  feud_sets: { name: string } | null;
};

export default function ModDashboardPage() {
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [activeFeud, setActiveFeud] = useState<ActiveFeudSession[]>([]);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [clearingLock, setClearingLock] = useState(false);
  const [lockResult, setLockResult] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("trivia_sessions")
      .select("id, status, mode, spectator_id, question_sets(name), spectator:profiles!spectator_id(username)")
      .in("status", ["lobby", "live", "grading"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setActive((data as unknown as ActiveSession[]) ?? []));

    supabase
      .from("feud_sessions")
      .select("id, status, feud_sets(name)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveFeud((data as unknown as ActiveFeudSession[]) ?? []));
  }, []);

  async function handleForceReleaseLock() {
    if (
      !confirm(
        "This clears the global lock that stops two sessions from running at once. " +
          "Only use this if starting a new session says one's already running, but nothing shows above. Continue?"
      )
    ) {
      return;
    }
    setClearingLock(true);
    setLockResult(null);
    const { data, error } = await supabase.functions.invoke("trivia-host", {
      body: { action: "force_release_lock" },
    });
    setClearingLock(false);
    if (error || data?.error) {
      setLockResult(data?.error ?? "Could not clear the lock.");
      return;
    }
    setLockResult(
      data.released
        ? `Cleared a stuck ${data.released.game} lock (started ${new Date(data.released.started_at).toLocaleString()}).`
        : "Nothing was stuck — there was no lock to clear."
    );
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <h1>🛠️ MOD Dashboard</h1>
        <p className="text-muted">Manage question sets and run Trivia Night.</p>

        {active.length > 0 && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>Session in progress</h3>
            {active.map((s) => (
              <div key={s.id} className="stack" style={{ marginTop: "8px" }}>
                <div className="row-between">
                  <span>
                    {s.question_sets?.name} — <span className="badge badge-live">{s.status}</span>{" "}
                    <span className="badge badge-neutral">{s.mode === "hard" ? "🔥 hard" : "😌 chill"}</span>
                  </span>
                  <div className="row">
                    <Link to={`/mod/spectate/${s.id}`} className="btn btn-secondary btn-sm">
                      👀 Watch as spectator
                    </Link>
                    <Link to={`/mod/host/${s.id}`} className="btn btn-primary btn-sm">
                      Go to host controls
                    </Link>
                  </div>
                </div>
                {s.spectator && (
                  <p className="hint" style={{ margin: 0 }}>
                    Currently being spectated by <strong>{s.spectator.username}</strong>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeFeud.length > 0 && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>Family Feud in progress</h3>
            {activeFeud.map((s) => (
              <div key={s.id} className="row-between" style={{ marginTop: "8px" }}>
                <span>
                  {s.feud_sets?.name} — <span className="badge badge-live">{s.status}</span>
                </span>
                <Link to={`/mod/feud-host/${s.id}`} className="btn btn-primary btn-sm">
                  Go to host controls
                </Link>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <Link to="/mod/sets" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card">
              <div style={{ fontSize: "2rem" }}>📋</div>
              <h3 style={{ marginTop: "12px" }}>Question Sets</h3>
              <p className="text-muted" style={{ marginBottom: 0 }}>
                Create, edit, or import questions for Trivia Night.
              </p>
            </div>
          </Link>
          <Link to="/mod/feud-sets" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card">
              <div style={{ fontSize: "2rem" }}>🎙️</div>
              <h3 style={{ marginTop: "12px" }}>Feud Sets</h3>
              <p className="text-muted" style={{ marginBottom: 0 }}>
                Author board questions and Fast Money rounds for Family Feud.
              </p>
            </div>
          </Link>
        </div>

        <p className="text-muted" style={{ marginTop: "28px" }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowTroubleshooting((s) => !s)}
            style={{ padding: 0 }}
          >
            {showTroubleshooting ? "Hide troubleshooting" : "Troubleshooting"}
          </button>
        </p>

        {showTroubleshooting && (
          <div className="card card--tight">
            <p className="hint" style={{ marginTop: 0 }}>
              If starting a new session says one's already running, but nothing shows above, a
              previous session likely ended abnormally without releasing its lock. This clears it.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleForceReleaseLock} disabled={clearingLock}>
              {clearingLock ? <span className="spinner" /> : "Force-clear stuck session lock"}
            </button>
            {lockResult && (
              <p className="hint" style={{ marginTop: "8px" }}>
                {lockResult}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
