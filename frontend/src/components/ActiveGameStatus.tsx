import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Sits at the top of the member dashboard and answers "is anything happening
// right now?" across the whole catalogue. There's no shared games/sessions
// table (see PROJECT_CONTEXT.md §5) and active_session_lock is intentionally
// not client-facing (0008_active_session_lock.sql — it exists to enforce the
// one-live-session-at-a-time rule server-side, not to announce who's
// hosting), so this checks each game's own session table the same way that
// game's own Lobby page already does — same status filters, just all six at
// once. Only one will ever come back non-null thanks to that lock.

type LiveGame = {
  key: string;
  emoji: string;
  title: string;
  lobbyPath: string;
  status: string;
  detail: string | null;
};

async function checkTrivia(): Promise<LiveGame | null> {
  const { data } = await supabase
    .from("trivia_sessions")
    .select("status, question_sets(name)")
    .in("status", ["lobby", "live", "grading"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { status: string; question_sets: { name: string } | null };
  return {
    key: "trivia",
    emoji: "🧠",
    title: "Trivia Night",
    lobbyPath: "/trivia",
    status: row.status,
    detail: row.question_sets?.name ?? "Random mix",
  };
}

async function checkFeud(): Promise<LiveGame | null> {
  const { data } = await supabase
    .from("feud_sessions")
    .select("status, feud_sets(name)")
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { status: string; feud_sets: { name: string } | null };
  return {
    key: "feud",
    emoji: "🎙️",
    title: "Family Feud",
    lobbyPath: "/feud/lobby",
    status: row.status,
    detail: row.feud_sets?.name ?? null,
  };
}

async function checkUno(): Promise<LiveGame | null> {
  const { data } = await supabase
    .from("uno_sessions")
    .select("status")
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    key: "uno",
    emoji: "🎴",
    title: "UNO",
    lobbyPath: "/uno/lobby",
    status: (data as { status: string }).status,
    detail: null,
  };
}

async function checkImpostor(): Promise<LiveGame | null> {
  const { data } = await supabase
    .from("impostor_sessions")
    .select("status, category_name")
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { status: string; category_name: string | null };
  return {
    key: "impostor",
    emoji: "🕵️",
    title: "Impostor WHO?",
    lobbyPath: "/impostor/lobby",
    status: row.status,
    detail: row.category_name ?? null,
  };
}

async function checkWheel(): Promise<LiveGame | null> {
  const { data } = await supabase
    .from("wheel_sessions")
    .select("status")
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    key: "wheel",
    emoji: "🎡",
    title: "Wheel of Fortune",
    lobbyPath: "/wheel/lobby",
    status: (data as { status: string }).status,
    detail: null,
  };
}

async function checkRebus(): Promise<LiveGame | null> {
  const { data } = await supabase
    .from("rebus_sessions")
    .select("status, game_mode")
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { status: string; game_mode: string };
  return {
    key: "rebus",
    emoji: "🔤",
    title: "Type What You See",
    lobbyPath: "/rebus/lobby",
    status: row.status,
    detail: row.game_mode === "team" ? "Team mode" : "Solo mode",
  };
}

// Order doubles as tie-break priority if the lock is ever bypassed/stale —
// doesn't matter in practice since at most one of these resolves non-null.
const CHECKS = [checkTrivia, checkFeud, checkUno, checkImpostor, checkWheel, checkRebus];
const WATCHED_TABLES = [
  "trivia_sessions",
  "feud_sessions",
  "uno_sessions",
  "impostor_sessions",
  "wheel_sessions",
  "rebus_sessions",
];

export default function ActiveGameStatus() {
  const [active, setActive] = useState<LiveGame | null | undefined>(undefined);

  async function refresh() {
    const results = await Promise.all(CHECKS.map((check) => check()));
    setActive(results.find((r) => r !== null) ?? null);
  }

  useEffect(() => {
    refresh();
    // One channel, one listener per game table — mirrors how each Lobby
    // page watches its own table, just consolidated since this component
    // needs to watch all six at once.
    const channel = supabase.channel("dashboard-active-game-watch");
    WATCHED_TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => refresh());
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (active === undefined) {
    return (
      <div className="card card--tight" style={{ marginBottom: "24px" }}>
        <p className="text-muted" style={{ margin: 0 }}>
          Checking for a live game…
        </p>
      </div>
    );
  }

  if (active === null) {
    return (
      <div className="card card--tight" style={{ marginBottom: "24px" }}>
        <p className="text-muted" style={{ margin: 0 }}>
          No game is live right now — keep an eye on Discord for the next announcement!
        </p>
      </div>
    );
  }

  const isLobby = active.status === "lobby";

  return (
    <div className="card card--tight row-between" style={{ marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
      <div className="row" style={{ gap: "12px" }}>
        <div style={{ fontSize: "1.8rem" }}>{active.emoji}</div>
        <div>
          <div className="row" style={{ gap: "8px" }}>
            <strong>{active.title}</strong>
            <span className="badge badge-live">🔴 Live</span>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            {active.detail && `${active.detail} — `}
            {isLobby ? "Lobby is open, join before it starts." : "Game in progress."}
          </p>
        </div>
      </div>
      <Link to={active.lobbyPath} className="btn btn-primary">
        Join {active.title}
      </Link>
    </div>
  );
}
