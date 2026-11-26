import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import PixelIcon from "./PixelIcon";
import { gameInfo, type GameKey } from "../lib/gameCatalog";
import { invokeFunction, supabase } from "../lib/supabaseClient";

// What a member sees on the old MOD set/category pages (/mod/sets, /mod/feud-sets,
// /mod/impostor-categories, /mod/wheel-categories, /mod/rebus-sets). MODs still
// get the original page with its editors. Members get the hosting part of it:
// the same options (Chill/Hard, Solo/Teams), the same choice of set or category
// (or a random one), and Start, in the Debbie design. No question, answer, word or
// puzzle content is sent to the browser, only each set's name and size
// (host_content_options(), migration 0045). Starting still goes through the
// game's host Edge Function.

type Choice = { id: string; name: string; item_count: number };

const INTRO: Record<GameKey, string> = {
  trivia: "Pick how you want it to run. Questions come from the shared sets, so there's nothing to prepare.",
  feud: "Pick a set for the board, then open the lobby. Two teams will form as members join.",
  uno: "Open the lobby and deal as soon as everyone is in.",
  impostor: "Pick a category and one word is chosen at random for the round.",
  wheel: "Choose solo or teams. A new category comes up each round.",
  rebus: "Choose the pace and whether people play solo or in teams. Puzzles are mixed from every set.",
};

const UNITS: Partial<Record<GameKey, string>> = {
  trivia: "question",
  feud: "board question",
  impostor: "word",
};

export default function MemberHostPage({ gameKey }: { gameKey: GameKey }) {
  const game = gameInfo(gameKey)!;
  const navigate = useNavigate();
  const [pace, setPace] = useState<"chill" | "hard">("chill");
  const [teams, setTeams] = useState<"solo" | "team">("solo");
  const [choices, setChoices] = useState<Choice[] | undefined>(game.content ? undefined : []);
  const [choice, setChoice] = useState(""); // "" = random
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!game.content) return;
    let cancelled = false;
    supabase.rpc("host_content_options").then(({ data }) => {
      if (cancelled) return;
      const rows = ((data ?? []) as (Choice & { game: string })[]).filter((r) => r.game === game.key);
      setChoices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  async function start() {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { action: "create_session", ...game.createBody };
    if (game.content) {
      if (choice) body[game.content.param] = choice;
      else Object.assign(body, game.content.randomBody ?? {});
    }
    if (game.hostOptions.pace) body.mode = pace;
    if (game.hostOptions.teams) body.game_mode = teams;
    const { data, error: err } = await invokeFunction(game.hostFunction, body);
    setBusy(false);
    if (err || !data?.session?.id) {
      setError(err ?? "Could not open the lobby. Please try again.");
      return;
    }
    navigate(game.hostPath(data.session.id));
  }

  const chosenName = choice ? choices?.find((c) => c.id === choice)?.name : game.content?.randomLabel;
  const unit = UNITS[game.key] ?? "item";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page rb-page">
        <Link to={game.lobbyPath} className="page-back">
          <span aria-hidden="true">‹</span> Back to {game.title}
        </Link>

        <div className="row" style={{ gap: "var(--space-3)", alignItems: "center" }}>
          <span className="rb-icon" aria-hidden="true">
            <PixelIcon name={game.icon} size={64} />
          </span>
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Host {game.title}</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0 }}>{INTRO[game.key]}</p>
          </div>
        </div>

        {(game.hostOptions.pace || game.hostOptions.teams) && (
          <section className="rb-section" aria-label="Game options">
            {game.hostOptions.pace && (
              <div>
                <h2 className="t-h3" style={{ margin: "0 0 8px" }}>Pace</h2>
                <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="rb-pill" aria-pressed={pace === "chill"} onClick={() => setPace("chill")}>😌 Chill</button>
                  <button type="button" className="rb-pill" aria-pressed={pace === "hard"} onClick={() => setPace("hard")}>🔥 Hard</button>
                </div>
              </div>
            )}
            {game.hostOptions.teams && (
              <div>
                <h2 className="t-h3" style={{ margin: "0 0 8px" }}>Players</h2>
                <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="rb-pill" aria-pressed={teams === "solo"} onClick={() => setTeams("solo")}>🙋 Solo</button>
                  <button type="button" className="rb-pill" aria-pressed={teams === "team"} onClick={() => setTeams("team")}>🤝 Teams</button>
                </div>
              </div>
            )}
          </section>
        )}

        {game.content && (
          <section className="rb-section" aria-labelledby="mh-choice-h">
            <h2 className="t-h2" id="mh-choice-h" style={{ margin: 0 }}>{game.content.label}</h2>
            {choices === undefined && <p className="text-muted">Loading…</p>}
            {choices !== undefined && (
              <div className="rb-grid">
                <button type="button" className="rb-card rb-choice" aria-pressed={choice === ""} onClick={() => setChoice("")}>
                  <h3 className="rb-card__title">🎲 {game.content.randomLabel}</h3>
                  <p className="t-body text-muted" style={{ margin: 0 }}>Let the server pick for you.</p>
                </button>
                {choices.map((c) => (
                  <button key={c.id} type="button" className="rb-card rb-choice" aria-pressed={choice === c.id} onClick={() => setChoice(c.id)}>
                    <h3 className="rb-card__title">{c.name}</h3>
                    <p className="t-body text-muted" style={{ margin: 0 }}>
                      {c.item_count} {unit}{c.item_count === 1 ? "" : "s"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="rb-later-note" aria-live="polite">
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <h2 className="t-h3" style={{ margin: 0 }}>Ready?</h2>
            <p className="t-body text-muted" style={{ margin: "4px 0 0" }}>
              {game.title}
              {chosenName ? ` · ${chosenName}` : ""}
              {game.hostOptions.pace ? ` · ${pace === "hard" ? "Hard" : "Chill"}` : ""}
              {game.hostOptions.teams ? ` · ${teams === "team" ? "Teams" : "Solo"}` : ""}
            </p>
            {error && (
              <p className="hint" role="alert" style={{ margin: "8px 0 0" }}>
                {error}
              </p>
            )}
          </div>
          <button type="button" className="rb-open" onClick={start} disabled={busy}>
            {busy ? "Opening the lobby…" : "Open the lobby"}
          </button>
        </section>
      </main>
    </div>
  );
}
