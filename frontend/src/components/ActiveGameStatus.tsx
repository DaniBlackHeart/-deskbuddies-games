import { useState } from "react";
import { Link } from "react-router-dom";
import { invokeFunction } from "../lib/supabaseClient";
import { gameInfo } from "../lib/gameCatalog";
import { useLiveGames } from "../lib/useLiveGames";
import PixelIcon from "./PixelIcon";

// Sits on Home and answers "what's happening right now?" for every game at
// once. Up to six games (one per game) can be live together, so this lists
// them all. It reads ONE database call (live_games(), migration 0043), not six
// table checks and six realtime listeners.

export default function ActiveGameStatus() {
  const { games, refresh } = useLiveGames();
  const [message, setMessage] = useState<string | null>(null);

  async function stopWatching() {
    setMessage(null);
    const { error } = await invokeFunction("my-game-slots", { action: "release_spectate" });
    if (error) setMessage(error);
    refresh();
  }

  if (games === undefined) {
    return (
      <div className="card card--tight" style={{ marginBottom: "24px" }}>
        <p className="text-muted" style={{ margin: 0 }}>
          Checking for live games…
        </p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="card card--tight row-between" style={{ marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <p className="text-muted" style={{ margin: 0 }}>
          No game is live right now. Start one in Reality Break, or keep an eye on Discord.
        </p>
        <Link to="/games" className="btn btn-secondary btn-sm">
          Open Reality Break
        </Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ marginBottom: "24px", gap: "12px" }}>
      {games.map((g) => {
        const info = gameInfo(g.game);
        if (!info) return null;
        const isLobby = g.status === "lobby";
        return (
          <div key={g.session_id} className="card card--tight row-between" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div className="row" style={{ gap: "12px" }}>
              <PixelIcon name={info.icon} size={32} />
              <div>
                <div className="row" style={{ gap: "8px" }}>
                  <strong>{info.title}</strong>
                  <span className="badge badge-live">🔴 Live</span>
                </div>
                <p className="hint" style={{ margin: 0 }}>
                  {isLobby ? "Lobby is open." : "Game in progress."}
                  {g.host_username ? ` Hosted by ${g.host_username}.` : ""}
                  {` ${g.player_count} ${g.player_count === 1 ? "player" : "players"}.`}
                  {g.my_role === "host" && " You're hosting."}
                  {g.my_role === "player" && " You're in this game."}
                  {g.i_am_spectating && " You're watching."}
                </p>
              </div>
            </div>
            <div className="row" style={{ gap: "8px" }}>
              {g.my_role === "host" ? (
                <Link to={info.hostPath(g.session_id)} className="btn btn-primary btn-sm">
                  Host controls
                </Link>
              ) : (
                <>
                  <Link to={info.lobbyPath} className="btn btn-primary btn-sm">
                    {g.my_role === "player" ? "Back to game" : `Join ${info.title}`}
                  </Link>
                  {g.i_am_spectating ? (
                    <>
                      <Link to={info.spectatePath(g.session_id)} className="btn btn-secondary btn-sm">
                        Keep watching
                      </Link>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={stopWatching}>
                        Stop watching
                      </button>
                    </>
                  ) : (
                    g.my_role !== "player" && (
                      <Link to={info.spectatePath(g.session_id)} className="btn btn-secondary btn-sm">
                        Watch
                      </Link>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      {message && (
        <p className="hint" role="alert" style={{ margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
