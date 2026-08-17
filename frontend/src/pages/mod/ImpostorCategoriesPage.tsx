import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import ImpostorImportModal from "../../components/ImpostorImportModal";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { deleteImpostorCategory, restoreImpostorCategory } from "../../lib/archiveOrDelete";
import type { ImpostorCategory } from "../../types";
import type { ParsedCategory } from "../../utils/impostorParser";

export default function ImpostorCategoriesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [categories, setCategories] = useState<ImpostorCategory[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<ImpostorCategory[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [startingRandom, setStartingRandom] = useState(false);

  async function loadCategories() {
    setLoading(true);
    const { data } = await supabase.from("impostor_categories").select("*").order("created_at", { ascending: false });

    const withCounts = await Promise.all(
      (data ?? []).map(async (c) => {
        const { count } = await supabase
          .from("impostor_words")
          .select("id", { count: "exact", head: true })
          .eq("category_id", c.id)
          .is("archived_at", null);
        return { ...c, word_count: count ?? 0 };
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
    const result = await deleteImpostorCategory(categoryId);
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
    await restoreImpostorCategory(categoryId);
    setBusyId(null);
    loadCategories();
  }

  async function handleCreate() {
    if (!newName.trim() || !profile) return;
    const { data, error } = await supabase
      .from("impostor_categories")
      .insert({ name: newName.trim(), created_by: profile.id })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }
    navigate(`/mod/impostor-categories/${data.id}`);
  }

  async function handleBulkImport(parsed: ParsedCategory[]) {
    if (!profile) return;
    for (const cat of parsed) {
      const { data: catRow, error } = await supabase
        .from("impostor_categories")
        .insert({ name: cat.name, description: cat.description, created_by: profile.id })
        .select()
        .single();
      if (error || !catRow) continue;
      await supabase.from("impostor_words").insert(cat.words.map((w) => ({ category_id: catRow.id, word: w.word, clue: w.clue })));
    }
    setShowImport(false);
    loadCategories();
  }

  async function handleStartRandom() {
    setStartingRandom(true);
    const { data, error } = await invokeFunction("impostor-host", { action: "create_session", random_category: true });
    setStartingRandom(false);
    if (error) {
      alert(error);
      return;
    }
    navigate(`/mod/impostor-host/${data.session.id}`);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between" style={{ flexWrap: "wrap", gap: "8px" }}>
          <h1>Impostor Categories</h1>
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
              🎲 Don't care which category? Start a session and let the server pick one at random.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleStartRandom} disabled={startingRandom}>
              {startingRandom ? <span className="spinner" /> : "🎲 Start with random category"}
            </button>
          </div>
        </div>

        {creating && (
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="field">
              <label>Category name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Animals"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="row">
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                Create & add words
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
            <p className="text-muted">No categories yet. Create your first one, or import a batch!</p>
          </div>
        )}

        <div className="stack">
          {categories.map((c) => (
            <div key={c.id} className="card row-between">
              <Link to={`/mod/impostor-categories/${c.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                <h3 style={{ marginBottom: "4px" }}>{c.name}</h3>
                <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                  {c.word_count} word{c.word_count === 1 ? "" : "s"}
                  {c.description ? ` · ${c.description}` : ""}
                </span>
              </Link>
              <div className="row">
                <Link to={`/mod/impostor-categories/${c.id}`} className="btn btn-secondary btn-sm">
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

      {showImport && <ImpostorImportModal mode="categories" onCancel={() => setShowImport(false)} onConfirm={handleBulkImport} />}
    </div>
  );
}
