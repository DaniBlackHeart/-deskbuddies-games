import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";

type ActiveSession = {
  id: string;
  status: string;
  question_sets: { name: string } | null;
};

export default function ModDashboardPage() {
  const [active, setActive] = useState<ActiveSession[]>([]);

  useEffect(() => {
    supabase
      .from("trivia_sessions")
      .select("id, status, question_sets(name)")
      .in("status", ["lobby", "live", "grading"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setActive((data as unknown as ActiveSession[]) ?? []));
  }, []);

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
              <div key={s.id} className="row-between">
                <span>
                  {s.question_sets?.name} — <span className="badge badge-live">{s.status}</span>
                </span>
                <Link to={`/mod/host/${s.id}`} className="btn btn-primary btn-sm">
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
        </div>
      </div>
    </div>
  );
}
