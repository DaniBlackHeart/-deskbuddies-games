import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import ImpostorImportModal from "../../components/ImpostorImportModal";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { ImpostorCategory, ImpostorWord } from "../../types";

export default function ImpostorCategoryEditorPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();

  const [category, setCategory] = useState<ImpostorCategory | null>(null);
  const [words, setWords] = useState<ImpostorWord[]>([]);
  const [archivedWords, setArchivedWords] = useState<ImpostorWord[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState("");
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [{ data: categoryData }, { data: wordsData }] = await Promise.all([
      supabase.from("impostor_categories").select("*").eq("id", categoryId).single(),
      supabase.from("impostor_words").select("*").eq("category_id", categoryId).order("created_at", { ascending: true }),
    ]);
    setCategory(categoryData);
    setWords((wordsData ?? []).filter((w) => !w.archived_at));
    setArchivedWords((wordsData ?? []).filter((w) => w.archived_at));
    setLoading(false);
  }

  useEffect(() => {
    if (categoryId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function handleAddWord() {
    setFormError(null);
    const trimmed = newWord.trim();
    if (!trimmed) {
      setFormError("Type a word first.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("impostor_words").insert({ category_id: categoryId, word: trimmed });
    setSaving(false);
    if (error) {
      setFormError("Could not save that word. Try again.");
      return;
    }
    setNewWord("");
    loadData();
  }

  async function handleBulkImport(newWords: string[]) {
    await supabase.from("impostor_words").insert(newWords.map((word) => ({ category_id: categoryId, word })));
    setShowImport(false);
    loadData();
  }

  async function handleArchiveWord(wordId: string) {
    setBusyId(wordId);
    await supabase.from("impostor_words").update({ archived_at: new Date().toISOString() }).eq("id", wordId);
    setBusyId(null);
    loadData();
  }

  async function handleRestoreWord(wordId: string) {
    setBusyId(wordId);
    await supabase.from("impostor_words").update({ archived_at: null }).eq("id", wordId);
    setBusyId(null);
    loadData();
  }

  async function handleDeleteWord(wordId: string) {
    if (!confirm("Delete this word for good?")) return;
    // No FK anywhere points at impostor_words (a session only ever copies
    // the text out at start_game), so this always hard-deletes cleanly —
    // no archive-or-delete fallback needed, unlike questions/categories.
    setBusyId(wordId);
    await supabase.from("impostor_words").delete().eq("id", wordId);
    setBusyId(null);
    loadData();
  }

  async function handleStartSession() {
    if (words.length === 0 || !categoryId) return;
    setLaunching(true);
    const { data, error } = await invokeFunction("impostor-host", { action: "create_session", category_id: categoryId });
    setLaunching(false);
    if (error) {
      alert(error);
      return;
    }
    navigate(`/mod/impostor-host/${data.session.id}`);
  }

  if (loading) {
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
        <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1>{category?.name}</h1>
            <p className="text-muted" style={{ marginTop: "-8px" }}>
              {words.length} word{words.length === 1 ? "" : "s"}
              {category?.description ? ` · ${category.description}` : ""}
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleStartSession} disabled={words.length === 0 || launching}>
            {launching ? <span className="spinner" /> : "▶ Start a session with this category"}
          </button>
        </div>
        {words.length === 0 && (
          <p className="hint" style={{ marginTop: "4px" }}>
            Add at least one word before starting a session — the secret word is picked at random from this list each game.
          </p>
        )}

        <div className="row" style={{ margin: "16px 0" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Add a word, e.g. Elephant"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
            />
          </div>
          <button className="btn btn-secondary" onClick={handleAddWord} disabled={saving}>
            {saving ? <span className="spinner" /> : "+ Add"}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            📋 Import words
          </button>
        </div>
        {formError && <p className="error-text">{formError}</p>}

        {words.length === 0 ? (
          <div className="card text-center">
            <p className="text-muted">No words yet — add one above or import a batch.</p>
          </div>
        ) : (
          <div className="row" style={{ flexWrap: "wrap", gap: "8px" }}>
            {words.map((w) => (
              <div key={w.id} className="badge badge-neutral" style={{ padding: "6px 10px", gap: "8px" }}>
                {w.word}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "0 0 0 6px" }}
                  disabled={busyId === w.id}
                  onClick={() => handleArchiveWord(w.id)}
                  title="Archive (hide from the random pool without deleting)"
                >
                  📥
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "0 0 0 2px", color: "var(--color-danger)" }}
                  disabled={busyId === w.id}
                  onClick={() => handleDeleteWord(w.id)}
                  title="Delete for good"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {archivedWords.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide" : "Show"} archived words ({archivedWords.length})
            </button>
            {showArchived && (
              <div className="row" style={{ flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                {archivedWords.map((w) => (
                  <div key={w.id} className="badge badge-neutral" style={{ padding: "6px 10px", gap: "8px", opacity: 0.7 }}>
                    {w.word}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "0 0 0 6px" }}
                      disabled={busyId === w.id}
                      onClick={() => handleRestoreWord(w.id)}
                      title="Restore to the active pool"
                    >
                      ↩️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && <ImpostorImportModal mode="words" onCancel={() => setShowImport(false)} onConfirm={handleBulkImport} />}
    </div>
  );
}
