import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import BackToModDashboardLink from "../../components/BackToModDashboardLink";
import UnoCardView from "../../components/UnoCardView";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { UnoCard, UnoParticipant, UnoSessionPublic } from "../../types";

// The host's own view of uno_sessions — a raw table row, NOT get-uno-state's
// response shape. Notably: no draw_pile/discard_pile here either, same
// reason as everywhere else — that data lives in uno_deck_state, which
// only uno-host/uno-play (service role) ever touch. The host doesn't need
// to see the deck order, only the same public state everyone else sees.
type HostSessionRow = Omit<UnoSessionPublic, "draw_pile_count">;

const STATUS_LABELS: Record<string, string> = {
  lobby: "Waiting in the lobby",
  live: "Live",
  ended: "Ended",
};

export default function HostUnoSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<HostSessionRow | null>(null);
  const [roster, setRoster] = useState<UnoParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadSession() {
    const { data } = await supabase.from("uno_sessions").select("*").eq("id", sessionId).single();
    setSession(data);
  }

  async function loadRoster() {
    const { data } = await supabase
      .from("uno_participants")
      .select("user_id, seat_order, hand_count, has_called_uno, finished_at, finish_rank, profiles(username, avatar_url)")
      .eq("session_id", sessionId)
      .order("seat_order");
    setRoster((data as unknown as UnoParticipant[]) ?? []);
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadSession(), loadRoster()]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel(`uno-host-watch-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uno_sessions", filter: `id=eq.${sessionId}` }, () => loadSession())
      .on("postgres_changes", { event: "*", schema: "public", table: "uno_participants", filter: `session_id=eq.${sessionId}` }, () => loadRoster())
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
    const { data, error } = await invokeFunction("uno-host", { action, session_id: sessionId, ...extra });
    setBusy(false);
    if (error) {
      alert(error);
      return null;
    }
    return data;
  }

  async function moveSeat(userId: string, direction: -1 | 1) {
    const ids = roster.map((p) => p.user_id);
    const idx = ids.indexOf(userId);
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    await callHost("set_seat_order", { ordered_user_ids: ids });
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
        <BackToModDashboardLink />
        <div className="row-between">
          <h1>🎴 Hosting UNO</h1>
          {session.status !== "ended" && (
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={handleEndSession}>
              {session.status === "lobby" ? "Cancel game" : "End game"}
            </button>
          )}
        </div>

        {session.status !== "ended" && <p className="hint">{STATUS_LABELS[session.status] ?? session.status}</p>}

        {session.status === "lobby" && (
          <div className="card">
            <p className="text-muted">Players join from the UNO lobby. Reorder with ↑↓ to set deal order (2–10 players).</p>
            <div className="stack" style={{ marginTop: "12px" }}>
              {roster.length === 0 && <p className="hint">No one yet</p>}
              {roster.map((p, i) => (
                <div key={p.user_id} className="row-between">
                  <span>
                    {i + 1}. {p.profiles?.username}
                  </span>
                  <div className="row" style={{ gap: "4px" }}>
                    <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveSeat(p.user_id, -1)}>
                      ↑
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={i === roster.length - 1} onClick={() => moveSeat(p.user_id, 1)}>
                      ↓
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => callHost("remove_player", { user_id: p.user_id })}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: "16px" }}
              disabled={roster.length < 2 || roster.length > 10 || busy}
              onClick={() => callHost("start_game")}
            >
              ▶ Start game
            </button>
            {roster.length === 1 && <p className="hint">Need at least 2 players.</p>}
            {roster.length > 10 && <p className="error-text">UNO tops out at 10 players.</p>}
          </div>
        )}

        {session.status === "live" && (
          <div className="card">
            <div className="row-between">
              <span className={`uno-direction ${session.direction === -1 ? "uno-direction--reversed" : ""}`}>➜</span>
              <span className="badge badge-neutral">{usernameFor(session.current_turn_user_id)}'s turn</span>
              {session.current_color && <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{session.current_color}</span>}
            </div>
            {session.discard_top && (
              <div className="text-center" style={{ margin: "16px 0" }}>
                <UnoCardView card={session.discard_top as UnoCard} size="lg" />
              </div>
            )}
            {session.pending_draw_type && (
              <p className="text-center">
                <span className="uno-pending-badge">⚠️ {session.pending_draw} owed by {usernameFor(session.current_turn_user_id)}</span>
              </p>
            )}
            <div className="uno-roster">
              {roster.map((p) => (
                <div key={p.user_id} className={`uno-roster__seat ${p.user_id === session.current_turn_user_id ? "uno-roster__seat--active" : ""} ${p.finished_at ? "uno-roster__seat--finished" : ""}`}>
                  <span>{p.profiles?.username}</span>
                  <span className="hint">
                    {p.hand_count} card{p.hand_count === 1 ? "" : "s"}
                    {p.finish_rank && ` · #${p.finish_rank}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="hint text-center" style={{ marginTop: "12px" }}>
              Players run the game themselves from their own screens — nothing to click here except End game.
            </p>
          </div>
        )}

        {session.status === "ended" && (
          <div className="card text-center">
            <h2>Game ended</h2>
            <button className="btn btn-secondary" style={{ marginTop: "12px" }} onClick={() => navigate("/mod")}>
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
