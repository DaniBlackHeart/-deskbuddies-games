import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import WheelImportModal from "../../components/WheelImportModal";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { deleteWheelCategory, restoreWheelCategory } from "../../lib/archiveOrDelete";
import type { WheelCategory } from "../../types";
import type { ParsedWheelCategory } from "../../utils/wheelParser";

export default function WheelCategoriesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [categories, setCategories] = useState<WheelCategory[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<WheelCategory[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [gameMode, setGameMode] = useState<"solo" | "team">("solo");

  async function loadCategories() {
    setLoading(true);
    const { data } = await supabase.from("wheel_categories").select("*").order("created_at", { ascending: false });

    const withCounts = await Promise.all(
      (data ?? []).map(async (c) => {
        const { count } = await supabase
          .from("wheel_phrases")
          .select("id", { count: "exact", head: true })
          .eq("category_id", c.id)
          .is("archived_at", null);
        return { ...c, phrase_count: count ?? 0 };
      })
    );

    setCategories(withCounts.filter((c) => !c.archived_at));
    setArchivedCategories(withCounts.filter((c) => c.archived_at));
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleDelete(e: React.MouseEvent, categoryId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this category?")) return;

    setBusyId(categoryId);
    const result = await deleteWheelCategory(categoryId);
    setBusyId(null);

    if (result.outcome === "error") {
      setMessage(result.message);
    } else if (result.outcome === "archived") {
      setMessage(
        "That category has already been used in a game, so it's been archived instead of deleted — past games are still safe. You can restore it from \"Show archived\" below."
      );
    } else {
      setMessage(null);
    }
    loadCategories();
  }

  async function handleRestore(categoryId: string) {
    setBusyId(categoryId);
    await restoreWheelCategory(categoryId);
    setBusyId(null);
    loadCategories();
  }

  async function handleCreate() {
    if (!newName.trim() || !profile) return;
    const { data, error } = await supabase
      .from("wheel_categories")
      .insert({ name: newName.trim(), created_by: profile.id })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }
    navigate(`/mod/wheel-categories/${data.id}`);
  }

  async function handleBulkImport(parsed: ParsedWheelCategory[]) {
    if (!profile) return;
    for (const cat of parsed) {
      const { data: catRow, error } = await supabase
        .from("wheel_categories")
        .insert({ name: cat.name, description: cat.description, created_by: profile.id })
        .select()
        .single();
      if (error || !catRow) continue;
      await supabase.from("wheel_phrases").insert(cat.phrases.map((p) => ({ category_id: catRow.id, phrase: p })));
    }
    setShowImport(false);
    loadCategories();
  }

  async function handleStartGame() {
    setStartingGame(true);
    const { data, error } = await invokeFunction("wheel-host", { action: "create_session", game_mode: gameMode });
    setStartingGame(false);
    if (error) {
      alert(error);
      return;
    }
    navigate(`/mod/wheel-host/${data.session.id}`);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between" style={{ flexWrap: "wrap", gap: "8px" }}>
          <h1>Wheel of Fortune</h1>
          <div className="row">
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              📋 Import categories
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + New category
            </button>
          </div>
        </div>

        <div className="card card--tight" style={{ marginBottom: "16px" }}>
          <div className="row-between" style={{ flexWrap: "wrap", gap: "8px" }}>
            <p className="hint" style={{ margin: 0 }}>
              🎡 Every round randomizes its own category and phrase — nothing to pick up front.
            </p>
          </div>
          <div className="row" style={{ marginTop: "10px", flexWrap: "wrap", gap: "8px" }}>
            <button
              className={gameMode === "solo" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={() => setGameMode("solo")}
            >
              🧍 Solo — 2-10 players
            </button>
            <button
              className={gameMode === "team" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={() => setGameMode("team")}
            >
              👥 Teams — 3-12 teams of 2-3
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleStartGame} disabled={startingGame || categories.length === 0}>
              {startingGame ? <span className="spinner" /> : "▶ Start new game"}
            </button>
          </div>
          {categories.length === 0 && (
            <p className="hint" style={{ marginTop: "8px", marginBottom: 0 }}>
              Add at least one category with a phrase before starting.
            </p>
          )}
        </div>

        {creating && (
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="field">
              <label>Category name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Person, Place, Phrase, Around the House"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="row">
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                Create & add phrases
              </button>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className="card card--tight" style={{ marginBottom: "16px" }}>
            <p className="hint" style={{ margin: 0 }}>
              {message}
            </p>
          </div>
        )}

        {loading && <p className="text-muted">Loading…</p>}

        {!loading && categories.length === 0 && !creating && (
          <div className="card text-center">
            <p className="text-muted">No categories yet. Create your first one!</p>
          </div>
        )}

        <div className="stack">
          {categories.map((c) => (
            <div key={c.id} className="card row-between">
              <Link to={`/mod/wheel-categories/${c.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                <h3 style={{ marginBottom: "4px" }}>{c.name}</h3>
                <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                  {c.phrase_count} phrase{c.phrase_count === 1 ? "" : "s"}
                  {c.description ? ` · ${c.description}` : ""}
                </span>
              </Link>
              <div className="row">
                <Link to={`/mod/wheel-categories/${c.id}`} className="btn btn-secondary btn-sm">
                  Edit →
                </Link>
                <button className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={(e) => handleDelete(e, c.id)}>
                  {busyId === c.id ? <span className="spinner" /> : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {archivedCategories.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide" : "Show"} archived ({archivedCategories.length})
            </button>

            {showArchived && (
              <div className="stack" style={{ marginTop: "12px" }}>
                {archivedCategories.map((c) => (
                  <div key={c.id} className="card row-between" style={{ opacity: 0.7 }}>
                    <div>
                      <h3 style={{ marginBottom: "4px" }}>{c.name}</h3>
                      <span className="badge badge-neutral">Archived</span>
                    </div>
                    <button className="btn btn-secondary btn-sm" disabled={busyId === c.id} onClick={() => handleRestore(c.id)}>
                      {busyId === c.id ? <span className="spinner" /> : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && <WheelImportModal mode="categories" onCancel={() => setShowImport(false)} onConfirm={handleBulkImport} />}
    </div>
  );
}
