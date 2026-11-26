import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invokeFunction, supabase } from "../lib/supabaseClient";
import type { GameInfo } from "../lib/gameCatalog";

// "Host a game": any member can start a lobby for a game that isn't live yet.
// Content (questions, puzzles, categories) is picked automatically, the same
// "mixed" way the MOD-started sessions already work, so a member never needs
// access to the authoring tools. Chill/Hard and Solo/Team are chosen up front
// because they can't change once the lobby opens.

export default function HostGameButton({ game, onError }: { game: GameInfo; onError?: (message: string | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pace, setPace] = useState<"chill" | "hard">("chill");
  const [teams, setTeams] = useState<"solo" | "team">("solo");
  const [choices, setChoices] = useState<{ id: string; name: string; item_count: number }[]>([]);
  const [choice, setChoice] = useState(""); // "" = random

  // Only the names of what's playable are fetched (host_content_options(), migration 0045).
  useEffect(() => {
    if (!open || !game.content) return;
    let cancelled = false;
    supabase.rpc("host_content_options").then(({ data }) => {
      if (cancelled) return;
      const rows = ((data ?? []) as { game: string; id: string; name: string; item_count: number }[]).filter((r) => r.game === game.key);
      setChoices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, game]);

  async function start() {
    setBusy(true);
    setError(null);
    onError?.(null);
    const body: Record<string, unknown> = { action: "create_session", ...game.createBody };
    if (game.content) {
      if (choice) body[game.content.param] = choice;
      else Object.assign(body, game.content.randomBody ?? {});
    }
    if (game.hostOptions.pace) body.mode = pace;
    if (game.hostOptions.teams) body.game_mode = teams;
    const { data, error } = await invokeFunction(game.hostFunction, body);
    setBusy(false);
    if (error || !data?.session?.id) {
      // Shown right here on the card, not only at the top of the page.
      setError(error ?? "Could not start a game. Please try again.");
      return;
    }
    navigate(game.hostPath(data.session.id));
  }

  const hasOptions = !!(game.content || game.hostOptions.pace || game.hostOptions.teams);

  if (!open) {
    return (
      <>
      <button
        type="button"
        className="rb-open"
        disabled={busy}
        aria-label={`Host a ${game.title} game`}
        onClick={() => (hasOptions ? setOpen(true) : start())}
      >
        {busy ? "Starting…" : "Host a game"}
      </button>
      {error && (
        <p className="hint" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      </>
    );
  }

  return (
    <div className="rb-host-options" role="group" aria-label={`${game.title} options`}>
      {game.content && (
        <label className="t-body-sm">
          {game.content.label}{" "}
          <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ maxWidth: "100%" }}>
            <option value="">{game.content.randomLabel}</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.item_count})
              </option>
            ))}
          </select>
        </label>
      )}
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
      {error && (
        <p className="hint" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className="row" style={{ gap: "8px" }}>
        <button type="button" className="rb-open" onClick={start} disabled={busy}>
          {busy ? "Opening the lobby…" : "Start hosting"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
