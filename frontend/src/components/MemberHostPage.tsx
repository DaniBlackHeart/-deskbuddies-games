import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import PixelIcon from "./PixelIcon";
import { gameInfo, type GameKey } from "../lib/gameCatalog";
import { MANAGE, type ManageRow } from "../lib/gameManage";
import { invokeFunction, supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

// The one hosting page for every game, shown to everyone at /mod/sets, /mod/feud-sets,
// /mod/impostor-categories, /mod/wheel-categories and /mod/rebus-sets.
// Members: pick the options and a set or category (or random), then open the lobby.
// They only receive each set's name and size (host_content_options(), migration 0045),
// never questions, answers, words or puzzles.
// MODs: the same page plus New / Import / Edit / Delete / Archived (lib/gameManage.tsx),
// which is what the old MOD list pages did. The editors stay MOD-only routes.
// Starting a game always goes through the game's host Edge Function.

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
  const { profile, user } = useAuth();
  const isMod = !!profile?.is_mod;
  const manage = isMod ? MANAGE[gameKey] : undefined;
  const [rows, setRows] = useState<ManageRow[] | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [importing, setImporting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pace, setPace] = useState<"chill" | "hard">("chill");
  const [teams, setTeams] = useState<"solo" | "team">("solo");
  const [choices, setChoices] = useState<Choice[] | undefined>(game.content ? undefined : []);
  const [choice, setChoice] = useState(""); // "" = random
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!manage) return;
    let cancelled = false;
    manage.load().then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, [manage, reloadKey]);

  useEffect(() => {
    if (!game.content || isMod) return;
    let cancelled = false;
    supabase.rpc("host_content_options").then(({ data }) => {
      if (cancelled) return;
      const rows = ((data ?? []) as (Choice & { game: string })[]).filter((r) => r.game === game.key);
      setChoices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [game, isMod]);

  async function createNew() {
    if (!manage || !user || !newName.trim()) return;
    setBusyId("new");
    const id = await manage.create(newName, user.id);
    setBusyId(null);
    if (!id) {
      setNotice("Could not create that. Please try again.");
      return;
    }
    navigate(manage.editorPath(id));
  }

  async function removeRow(row: ManageRow) {
    if (!manage?.remove) return;
    if (!window.confirm(manage.deleteConfirm ?? "Delete this?")) return;
    setBusyId(row.id);
    setNotice(null);
    const result = await manage.remove(row.id);
    setBusyId(null);
    if (result.outcome === "error" || result.outcome === "blocked") setNotice(result.message);
    else if (result.outcome === "archived") setNotice(manage.archivedNotice ?? "Archived instead of deleted.");
    setReloadKey((k) => k + 1);
  }

  async function restoreRow(row: ManageRow) {
    if (!manage?.restore) return;
    setBusyId(row.id);
    setNotice(null);
    const result = await manage.restore(row.id);
    setBusyId(null);
    if (result.outcome === "error" || result.outcome === "blocked") setNotice(result.message);
    setReloadKey((k) => k + 1);
  }

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

  const unit = UNITS[game.key] ?? "item";
  // What can be picked: members get the name+size list, MODs the full list they manage.
  const options: { id: string; name: string; detail: string }[] | undefined = isMod
    ? rows?.filter((r) => !r.archived)
    : choices?.map((c) => ({ id: c.id, name: c.name, detail: `${c.item_count} ${unit}${c.item_count === 1 ? "" : "s"}` }));
  const chosenName = choice ? options?.find((c) => c.id === choice)?.name : game.content?.randomLabel;
  const archivedRows = rows?.filter((r) => r.archived) ?? [];
  const hasOptions = !!(game.hostOptions.pace || game.hostOptions.teams);

  const startButton = (
    <button type="button" className="rb-open" onClick={start} disabled={busy}>
      {busy ? "Opening the lobby…" : "Open the lobby"}
    </button>
  );
  const summary = [
    game.title,
    chosenName,
    game.hostOptions.pace ? (pace === "hard" ? "Hard" : "Chill") : null,
    game.hostOptions.teams ? (teams === "team" ? "Teams" : "Solo") : null,
  ].filter(Boolean).join(" · ");

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

        <section className="rb-section" aria-label="Game options and start" aria-live="polite">
          <div className="row" style={{ gap: "var(--space-4)", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
            {hasOptions && (
              <div className="row" style={{ gap: "var(--space-4)", flexWrap: "wrap", alignItems: "flex-end" }}>
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
              </div>
            )}
            <div style={{ marginLeft: hasOptions ? undefined : 0 }}>{startButton}</div>
          </div>
          <p className="t-body text-muted" style={{ margin: 0 }}>{summary}</p>
          {error && (
            <p className="hint" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          )}
        </section>

        {notice && (
          <p className="hint" role="alert" style={{ margin: 0 }}>
            {notice}
          </p>
        )}

        {(game.content || manage) && (
          <section className="rb-section" aria-labelledby="mh-choice-h">
            <div className="row-between" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
              <h2 className="t-h2" id="mh-choice-h" style={{ margin: 0 }}>
                {game.content ? game.content.label : manage ? `Manage ${manage.noun}s` : ""}
              </h2>
              {manage && (
                <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                  {manage.renderImport && (
                    <button type="button" className="rb-open rb-open--secondary" onClick={() => setImporting(true)}>
                      {manage.importLabel}
                    </button>
                  )}
                  <button type="button" className="rb-open rb-open--secondary" onClick={() => setCreating((v) => !v)}>
                    + New {manage.noun}
                  </button>
                </div>
              )}
            </div>

            {manage && creating && (
              <form
                className="row"
                style={{ gap: "8px", flexWrap: "wrap" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  createNew();
                }}
              >
                <input
                  className="input"
                  style={{ flex: "1 1 240px" }}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={manage.placeholder}
                  aria-label={`New ${manage.noun} name`}
                  autoFocus
                />
                <button type="submit" className="rb-open" disabled={!newName.trim() || busyId === "new"}>
                  {busyId === "new" ? "Creating…" : "Create"}
                </button>
              </form>
            )}

            {options === undefined && <p className="text-muted">Loading…</p>}
            {options !== undefined && (
              <div className="rb-grid">
                {game.content && (
                  <button type="button" className="rb-card rb-choice" aria-pressed={choice === ""} onClick={() => setChoice("")}>
                    <h3 className="rb-card__title">🎲 {game.content.randomLabel}</h3>
                    <p className="t-body text-muted" style={{ margin: 0 }}>Let the server pick for you.</p>
                  </button>
                )}
                {options.map((c) => (
                  <div key={c.id} className="rb-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {game.content ? (
                      <button
                        type="button"
                        className="rb-choice"
                        style={{ all: "unset", cursor: "pointer", display: "block" }}
                        aria-pressed={choice === c.id}
                        onClick={() => setChoice(c.id)}
                      >
                        <h3 className="rb-card__title">{choice === c.id ? "✓ " : ""}{c.name}</h3>
                        <p className="t-body text-muted" style={{ margin: 0 }}>{c.detail}</p>
                      </button>
                    ) : (
                      <div>
                        <h3 className="rb-card__title">{c.name}</h3>
                        <p className="t-body text-muted" style={{ margin: 0 }}>{c.detail}</p>
                      </div>
                    )}
                    {manage && (
                      <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                        <Link to={manage.editorPath(c.id)} className="rb-open rb-open--secondary">Edit</Link>
                        {manage.remove && (
                          <button type="button" className="rb-open rb-open--secondary" disabled={busyId === c.id} onClick={() => removeRow(c as ManageRow)}>
                            {busyId === c.id ? "Deleting…" : "Delete"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {manage && options !== undefined && options.length === 0 && (
              <p className="text-muted">No {manage.noun}s yet. Use “+ New {manage.noun}” to add one.</p>
            )}

            {manage?.restore && archivedRows.length > 0 && (
              <div>
                <button type="button" className="rb-open rb-open--secondary" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
                  {showArchived ? "Hide archived" : `Show archived (${archivedRows.length})`}
                </button>
                {showArchived && (
                  <div className="rb-grid" style={{ marginTop: "var(--space-3)" }}>
                    {archivedRows.map((r) => (
                      <div key={r.id} className="rb-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div>
                          <h3 className="rb-card__title">{r.name}</h3>
                          <p className="t-body text-muted" style={{ margin: 0 }}>{r.detail} · archived</p>
                        </div>
                        <div>
                          <button type="button" className="rb-open rb-open--secondary" disabled={busyId === r.id} onClick={() => restoreRow(r)}>
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {importing && manage?.renderImport &&
          manage.renderImport(
            () => setImporting(false),
            () => {
              setImporting(false);
              setReloadKey((k) => k + 1);
            },
            user?.id
          )}
      </main>
    </div>
  );
}
