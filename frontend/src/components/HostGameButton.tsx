import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invokeFunction } from "../lib/supabaseClient";
import type { GameInfo } from "../lib/gameCatalog";

// "Host a game": any member can start a lobby for a game that isn't live yet.
// Content (questions, puzzles, categories) is picked automatically, the same
// "mixed" way the MOD-started sessions already work, so a member never needs
// access to the authoring tools. Chill/Hard and Solo/Team are chosen up front
// because they can't change once the lobby opens.

export default function HostGameButton({ game, onError }: { game: GameInfo; onError?: (message: string | null) => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pace, setPace] = useState<"chill" | "hard">("chill");
  const [teams, setTeams] = useState<"solo" | "team">("solo");

  async function start() {
    setBusy(true);
    onError?.(null);
    const body: Record<string, unknown> = { action: "create_session", ...game.createBody };
    if (game.hostOptions.pace) body.mode = pace;
    if (game.hostOptions.teams) body.game_mode = teams;
    const { data, error } = await invokeFunction(game.hostFunction, body);
    setBusy(false);
    if (error || !data?.session?.id) {
      onError?.(error ?? "Could not start a game");
      setOpen(false);
      return;
    }
    navigate(game.hostPath(data.session.id));
  }

  const hasOptions = !!(game.hostOptions.pace || game.hostOptions.teams);

  if (!open) {
    return (
      <button
        type="button"
        className="rb-open"
        disabled={busy}
        aria-label={`Host a ${game.title} game`}
        onClick={() => (hasOptions ? setOpen(true) : start())}
      >
        {busy ? "Starting…" : "Host a game"}
      </button>
    );
  }

  return (
    <div className="rb-host-options" role="group" aria-label={`${game.title} options`}>
      {game.hostOptions.pace && (
        <label className="t-body-sm">
          Pace{" "}
          <select value={pace} onChange={(e) => setPace(e.target.value as "chill" | "hard")}>
            <option value="chill">Chill</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      )}
      {game.hostOptions.teams && (
        <label className="t-body-sm">
          Players{" "}
          <select value={teams} onChange={(e) => setTeams(e.target.value as "solo" | "team")}>
            <option value="solo">Solo</option>
            <option value="team">Teams</option>
          </select>
        </label>
      )}
      <div className="row" style={{ gap: "8px" }}>
        <button type="button" className="rb-open" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Open the lobby"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
