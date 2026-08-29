import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import GameCard from "../../components/GameCard";
import { supabase, invokeFunction } from "../../lib/supabaseClient";

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
  spectator_id: string | null;
  spectator: { username: string } | null;
};

type ActiveUnoSession = {
  id: string;
  status: string;
  spectator_id: string | null;
  spectator: { username: string } | null;
};

type ActiveImpostorSession = {
  id: string;
  status: string;
  category_name: string;
  spectator_id: string | null;
  spectator: { username: string } | null;
};

type ActiveWheelSession = {
  id: string;
  status: string;
  current_round_index: number;
  spectator_id: string | null;
  spectator: { username: string } | null;
};

type ActiveRebusSession = {
  id: string;
  status: string;
  mode: string;
  game_mode: string;
  spectator_id: string | null;
  spectator: { username: string } | null;
};

export default function ModDashboardPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [activeFeud, setActiveFeud] = useState<ActiveFeudSession[]>([]);
  const [activeUno, setActiveUno] = useState<ActiveUnoSession[]>([]);
  const [activeImpostor, setActiveImpostor] = useState<ActiveImpostorSession[]>([]);
  const [activeWheel, setActiveWheel] = useState<ActiveWheelSession[]>([]);
  const [activeRebus, setActiveRebus] = useState<ActiveRebusSession[]>([]);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [clearingLock, setClearingLock] = useState(false);
  const [lockResult, setLockResult] = useState<string | null>(null);
  const [startingUno, setStartingUno] = useState(false);

  useEffect(() => {
    supabase
      .from("trivia_sessions")
      .select("id, status, mode, spectator_id, question_sets(name), spectator:profiles!spectator_id(username)")
      .in("status", ["lobby", "live", "grading"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setActive((data as unknown as ActiveSession[]) ?? []));

    supabase
      .from("feud_sessions")
      .select("id, status, feud_sets(name), spectator_id, spectator:profiles!spectator_id(username)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveFeud((data as unknown as ActiveFeudSession[]) ?? []));

    supabase
      .from("uno_sessions")
      .select("id, status, spectator_id, spectator:profiles!spectator_id(username)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveUno((data as unknown as ActiveUnoSession[]) ?? []));

    supabase
      .from("impostor_sessions")
      .select("id, status, category_name, spectator_id, spectator:profiles!spectator_id(username)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveImpostor((data as unknown as ActiveImpostorSession[]) ?? []));

    supabase
      .from("wheel_sessions")
      .select("id, status, current_round_index, spectator_id, spectator:profiles!spectator_id(username)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveWheel((data as unknown as ActiveWheelSession[]) ?? []));

    supabase
      .from("rebus_sessions")
      .select("id, status, mode, game_mode, spectator_id, spectator:profiles!spectator_id(username)")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveRebus((data as unknown as ActiveRebusSession[]) ?? []));
  }, []);

  async function handleStartUno() {
    setStartingUno(true);
    const { data, error } = await invokeFunction("uno-host", { action: "create_session" });
    setStartingUno(false);
    if (error) {
      alert(error);
      return;
    }
    navigate(`/mod/uno-host/${data.session.id}`);
  }

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
    const { data, error } = await invokeFunction("trivia-host", { action: "force_release_lock" });
    setClearingLock(false);
    if (error) {
      setLockResult(error);
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
        <p className="text-muted">Manage question sets and run Trivia Night, Family Feud, UNO, Impostor WHO?, Wheel of Fortune, and Type What You See.</p>

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
              <div key={s.id} className="stack" style={{ marginTop: "8px" }}>
                <div className="row-between">
                  <span>
                    {s.feud_sets?.name} — <span className="badge badge-live">{s.status}</span>
                  </span>
                  <div className="row">
                    <Link to={`/mod/feud-spectate/${s.id}`} className="btn btn-secondary btn-sm">
                      👀 Watch as spectator
                    </Link>
                    <Link to={`/mod/feud-host/${s.id}`} className="btn btn-primary btn-sm">
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

        {activeUno.length > 0 && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>UNO in progress</h3>
            {activeUno.map((s) => (
              <div key={s.id} className="stack" style={{ marginTop: "8px" }}>
                <div className="row-between">
                  <span>
                    <span className="badge badge-live">{s.status}</span>
                  </span>
                  <div className="row">
                    <Link to={`/mod/uno-spectate/${s.id}`} className="btn btn-secondary btn-sm">
                      👀 Watch as spectator
                    </Link>
                    <Link to={`/mod/uno-host/${s.id}`} className="btn btn-primary btn-sm">
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

        {activeImpostor.length > 0 && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>Impostor WHO? in progress</h3>
            {activeImpostor.map((s) => (
              <div key={s.id} className="stack" style={{ marginTop: "8px" }}>
                <div className="row-between">
                  <span>
                    {s.category_name} — <span className="badge badge-live">{s.status}</span>
                  </span>
                  <div className="row">
                    <Link to={`/mod/impostor-spectate/${s.id}`} className="btn btn-secondary btn-sm">
                      👀 Watch as spectator
                    </Link>
                    <Link to={`/mod/impostor-host/${s.id}`} className="btn btn-primary btn-sm">
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

        {activeWheel.length > 0 && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>Wheel of Fortune in progress</h3>
            {activeWheel.map((s) => (
              <div key={s.id} className="stack" style={{ marginTop: "8px" }}>
                <div className="row-between">
                  <span>
                    {s.status === "live" || s.status === "tiebreaker" ? `Round ${s.current_round_index + 1}` : s.status} —{" "}
                    <span className="badge badge-live">{s.status}</span>
                  </span>
                  <div className="row">
                    <Link to={`/mod/wheel-spectate/${s.id}`} className="btn btn-secondary btn-sm">
                      👀 Watch as spectator
                    </Link>
                    <Link to={`/mod/wheel-host/${s.id}`} className="btn btn-primary btn-sm">
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

        {activeRebus.length > 0 && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>Type What You See in progress</h3>
            {activeRebus.map((s) => (
              <div key={s.id} className="stack" style={{ marginTop: "8px" }}>
                <div className="row-between">
                  <span>
                    <span className="badge badge-live">{s.status}</span>{" "}
                    <span className="badge badge-neutral">{s.mode === "hard" ? "🔥 hard" : "😌 chill"}</span>{" "}
                    <span className="badge badge-neutral">{s.game_mode === "team" ? "🤝 team" : "🙋 solo"}</span>
                  </span>
                  <div className="row">
                    <Link to={`/mod/rebus-spectate/${s.id}`} className="btn btn-secondary btn-sm">
                      👀 Watch as spectator
                    </Link>
                    <Link to={`/mod/rebus-host/${s.id}`} className="btn btn-primary btn-sm">
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <GameCard
            to="/mod/sets"
            emoji="🧠"
            title="Trivia Night"
            description="Create, edit, or import questions for Trivia Night."
          />
          <GameCard
            to="/mod/feud-sets"
            emoji="🎙️"
            title="Feud Sets"
            description="Author board questions and Fast Money rounds for Family Feud."
          />
          {/* UNO has no MOD-authored content — unlike the two cards above,
              which link to a set-editor, this one starts a session
              directly (uno-host's create_session needs nothing but who's
              hosting). */}
          <GameCard
            onClick={handleStartUno}
            busy={startingUno}
            emoji="🎴"
            title="UNO"
            description={startingUno ? "Starting a new game…" : "Start a new UNO game — deals as soon as everyone's in."}
          />
          <GameCard
            to="/mod/impostor-categories"
            emoji="🕵️"
            title="Impostor WHO?"
            description="Manage categories and words, then start a session from inside one."
          />
          <GameCard
            to="/mod/wheel-categories"
            emoji="🎡"
            title="Wheel of Fortune"
            description="Manage categories and phrases, then start a session from inside one."
          />
          <GameCard
            to="/mod/rebus-sets"
            emoji="🔤"
            title="Type What You See"
            description="Author rebus puzzles across all four rounds — every session automatically mixes them from all your sets."
          />
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
