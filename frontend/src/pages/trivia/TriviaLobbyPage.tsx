import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";

type OpenSession = {
  id: string;
  status: string;
  join_code: string;
  question_set_id: string | null;
  question_sets: { name: string } | null;
};

export default function TriviaLobbyPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<OpenSession | null | undefined>(undefined); // undefined = loading
  const [joining, setJoining] = useState(false);

  async function loadOpenSession() {
    const { data, error } = await supabase
      .from("trivia_sessions")
      .select("id, status, join_code, question_set_id, question_sets(name)")
      .in("status", ["lobby", "live", "grading"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setSession(null);
      return;
    }
    setSession((data as unknown as OpenSession) ?? null);
  }

  useEffect(() => {
    loadOpenSession();

    const channel = supabase
      .channel("trivia-sessions-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trivia_sessions" },
        () => loadOpenSession()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleJoin() {
    if (!session) return;
    setJoining(true);
    navigate(`/trivia/play/${session.id}`);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container container--narrow">
        <div className="card text-center">
          <div style={{ fontSize: "2.5rem" }}>🧠</div>
          <h1>Trivia Night</h1>

          {session === undefined && <p className="text-muted">Checking for a live session…</p>}

          {session === null && (
            <>
              <p className="text-muted">
                No Trivia Night happening right now. Keep an eye on Discord for the next
                announcement!
              </p>
              <button className="btn btn-secondary" onClick={() => navigate("/")}>
                Back to games
              </button>
            </>
          )}

          {session && (
            <>
              <p className="text-muted">
                A session is {session.status === "lobby" ? "about to start" : "in progress"}
                {session.question_sets?.name ? (
                  <>
                    : <strong>{session.question_sets.name}</strong>
                  </>
                ) : (
                  " — questions are mixed fresh every time."
                )}
              </p>
              <button className="btn btn-primary btn-block" onClick={handleJoin} disabled={joining}>
                {joining ? <span className="spinner" /> : "Join Trivia Night"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
