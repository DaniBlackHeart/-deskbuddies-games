import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import ImpostorClueBoard from "../../components/ImpostorClueBoard";
import ImpostorVoteResults from "../../components/ImpostorVoteResults";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { ImpostorClue, ImpostorParticipant, ImpostorSessionPublic } from "../../types";

// The host's own view of impostor_sessions — a raw table row is actually
// safe to read directly here (revealed_impostor_user_id/revealed_secret_word
// stay null until the game legitimately ends, same reasoning as
// uno_sessions.winner_id), so no separate get-impostor-state round trip is
// needed just to run the host screen.
type HostSessionRow = ImpostorSessionPublic;

const STATUS_LABELS: Record<string, string> = {
  lobby: "Waiting in the lobby",
  clue_giving: "Clue-giving",
  voting: "Voting",
  ended: "Ended",
};

export default function HostImpostorSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<HostSessionRow | null>(null);
  const [roster, setRoster] = useState<ImpostorParticipant[]>([]);
  const [clues, setClues] = useState<ImpostorClue[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadSession() {
    const { data } = await supabase.from("impostor_sessions").select("*").eq("id", sessionId).single();
    setSession(
      data
        ? {
            id: data.id,
            status: data.status,
            category_name: data.category_name,
            round_number: data.round_number,
            turn_index: data.turn_index,
            round_set_starter_user_id: data.round_set_starter_user_id,
            current_turn_user_id: data.current_turn_user_id,
            clue_deadline_ms: data.clue_deadline ? new Date(data.clue_deadline).getTime() : null,
            vote_round: data.vote_round,
            vote_deadline_ms: data.vote_deadline ? new Date(data.vote_deadline).getTime() : null,
            winner: data.winner,
            completed: data.completed,
            revealed_impostor_user_id: data.revealed_impostor_user_id,
            revealed_secret_word: data.revealed_secret_word,
            final_vote_tally: data.final_vote_tally,
            state_version: data.state_version,
          }
        : null
    );

    if (data?.status === "voting" && data.vote_round) {
      const { count } = await supabase
        .from("impostor_votes")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("vote_round", data.vote_round);
      setVotedCount(count ?? 0);
    } else {
      setVotedCount(0);
    }
  }

  async function loadRoster() {
    const { data } = await supabase
      .from("impostor_participants")
      .select("user_id, seat_order, profiles(username, avatar_url)")
      .eq("session_id", sessionId)
      .order("seat_order");
    setRoster((data as unknown as ImpostorParticipant[]) ?? []);
  }

  async function loadClues() {
    const { data } = await supabase
      .from("impostor_clues")
      .select("round_number, user_id, clue_text, timed_out")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true })
      .order("created_at", { ascending: true });
    setClues((data as unknown as ImpostorClue[]) ?? []);
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadSession(), loadRoster(), loadClues()]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel(`impostor-host-watch-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "impostor_sessions", filter: `id=eq.${sessionId}` }, () => loadSession())
      .on("postgres_changes", { event: "*", schema: "public", table: "impostor_participants", filter: `session_id=eq.${sessionId}` }, () => loadRoster())
      .on("postgres_changes", { event: "*", schema: "public", table: "impostor_clues", filter: `session_id=eq.${sessionId}` }, () => loadClues())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function usernameFor(userId: string | null): string {
    if (!userId) return "";
    return roster.find((p) => p.user_id === userId)?.profiles?.username ?? "Someone";
  }

  async function callHost(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const { data, error } = await invokeFunction("impostor-host", { action, session_id: sessionId, ...extra });
    setBusy(false);
    if (error) {
      alert(error);
      return null;
    }
    return data;
  }

  async function handleEndSession() {
    const message = session?.status === "lobby" ? "Cancel this game before it starts?" : "End the game for everyone?";
    if (!confirm(message)) return;
    await callHost("end_session");
    loadSession();
  }

  if (loading || !session) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between">
          <h1>🕵️ Hosting Impostor WHO?</h1>
          {session.status !== "ended" && (
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={handleEndSession}>
              {session.status === "lobby" ? "Cancel game" : "End game"}
            </button>
          )}
        </div>

        {session.status !== "ended" && (
          <p className="hint">
            {STATUS_LABELS[session.status] ?? session.status} · Category: <strong>{session.category_name}</strong>
          </p>
        )}

        {session.status === "lobby" && (
          <div className="card">
            <p className="text-muted">Players join from the Impostor WHO? lobby. Need at least 3 to start.</p>
            <div className="stack" style={{ marginTop: "12px" }}>
              {roster.length === 0 && <p className="hint">No one yet</p>}
              {roster.map((p, i) => (
                <div key={p.user_id} className="row-between">
                  <span>
                    {i + 1}. {p.profiles?.username}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => callHost("remove_player", { user_id: p.user_id })}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: "16px" }}
              disabled={roster.length < 3 || busy}
              onClick={() => callHost("start_game")}
            >
              ▶ Start game
            </button>
            {roster.length > 0 && roster.length < 3 && <p className="hint">Need at least 3 players.</p>}
          </div>
        )}

        {(session.status === "clue_giving" || session.status === "voting") && (
          <>
            <ImpostorClueBoard clues={clues} roster={roster} currentTurnUserId={session.status === "clue_giving" ? session.current_turn_user_id : null} />
            <div className="card">
              {session.status === "clue_giving" && (
                <p className="text-center" style={{ margin: 0 }}>
                  Round {session.round_number} of 4 — waiting on <strong>{usernameFor(session.current_turn_user_id)}</strong>
                </p>
              )}
              {session.status === "voting" && (
                <p className="text-center" style={{ margin: 0 }}>
                  Vote {session.vote_round} — {votedCount}/{roster.length} voted
                </p>
              )}
              <p className="hint text-center" style={{ marginTop: "12px", marginBottom: 0 }}>
                Players run the game themselves from their own screens — nothing to click here except End game.
              </p>
            </div>
          </>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2>
              {session.completed
                ? session.winner === "crew"
                  ? "🎉 Crew wins!"
                  : "🎭 The Impostor wins!"
                : "Game cancelled"}
            </h2>
            {session.completed && session.revealed_impostor_user_id && (
              <p style={{ fontWeight: 700 }}>
                The Impostor was <strong>{usernameFor(session.revealed_impostor_user_id)}</strong> — the word was{" "}
                <strong>{session.revealed_secret_word}</strong>
              </p>
            )}
            <button className="btn btn-secondary" style={{ marginTop: "12px" }} onClick={() => navigate("/mod")}>
              Back to dashboard
            </button>
          </div>
        )}

        {session.status === "ended" && session.final_vote_tally && (
          <div style={{ marginTop: "16px" }}>
            <ImpostorVoteResults
              headline="How the vote went:"
              roster={roster}
              tally={session.final_vote_tally.tally}
              totalVotes={session.final_vote_tally.total_votes}
              accusedUserId={session.final_vote_tally.accused_user_id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
