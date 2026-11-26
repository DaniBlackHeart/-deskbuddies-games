import { useState } from "react";
import { Link } from "react-router-dom";
import { gameInfo, type GameKey } from "../lib/gameCatalog";
import { invokeFunction } from "../lib/supabaseClient";
import { useLiveGames } from "../lib/useLiveGames";
import HostGameButton from "./HostGameButton";

// Sits under the existing game lobby page (Trivia Night, UNO, ...). The lobby
// page keeps doing what it always did (shows the open session, the roster,
// the Join button). This adds the two things members can do now:
//   - nobody's playing: HOST the game, choosing the set / category where the
//     game has them
//   - a game is live: WATCH it (one game at a time), or get back to the host
//     controls if you're the host.

export default function GameHostPanel({ gameKey }: { gameKey: GameKey }) {
  const game = gameInfo(gameKey);
  const { games: live, refresh } = useLiveGames();
  const [message, setMessage] = useState<string | null>(null);

  if (!game || live === undefined) return null;

  const row = live.find((l) => l.game === gameKey);
  const inAnotherGame = live.some((l) => l.my_role !== null && l.game !== gameKey);

  async function stopWatching() {
    setMessage(null);
    const { error } = await invokeFunction("my-game-slots", { action: "release_spectate" });
    if (error) setMessage(error);
    refresh();
  }

  if (!row) {
    return (
      <div className="card stack" style={{ marginTop: "16px", gap: "12px" }}>
        <h2 style={{ margin: 0 }}>Host {game.title}</h2>
        {inAnotherGame ? (
          <p className="text-muted" style={{ margin: 0 }}>
            You're already in another game. Finish or leave it before hosting this one.
          </p>
        ) : (
          <>
            <p className="text-muted" style={{ margin: 0 }}>
              Nobody is playing yet. Choose your options and open the lobby, and other members can join you.
            </p>
            <HostGameButton game={game} alwaysOpen />
          </>
        )}
      </div>
    );
  }

  // A game is live: the lobby page above has the Join button; here is watch / host controls.
  if (row.my_role === "player") return null;

  return (
    <div className="card card--tight stack" style={{ marginTop: "16px", gap: "8px" }}>
      {row.my_role === "host" ? (
        <div className="row-between" style={{ flexWrap: "wrap", gap: "8px" }}>
          <span>You're hosting this game.</span>
          <Link to={game.hostPath(row.session_id)} className="btn btn-primary btn-sm">
            Go to host controls
          </Link>
        </div>
      ) : (
        <div className="row-between" style={{ flexWrap: "wrap", gap: "8px" }}>
          <span className="text-muted">
            {row.host_username ? `Hosted by ${row.host_username}. ` : ""}
            Not playing? You can watch instead.
          </span>
          <div className="row" style={{ gap: "8px" }}>
            <Link to={game.spectatePath(row.session_id)} className="btn btn-secondary btn-sm">
              {row.i_am_spectating ? "Keep watching" : "Watch"}
            </Link>
            {row.i_am_spectating && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={stopWatching}>
                Stop watching
              </button>
            )}
          </div>
        </div>
      )}
      {message && (
        <p className="hint" role="alert" style={{ margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
