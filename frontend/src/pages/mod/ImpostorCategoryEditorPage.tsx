import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import ImpostorImportModal from "../../components/ImpostorImportModal";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { ImpostorCategory, ImpostorWord } from "../../types";
import type { ParsedWord } from "../../utils/impostorParser";

export default function ImpostorCategoryEditorPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();

  const [category, setCategory] = useState<ImpostorCategory | null>(null);
  const [words, setWords] = useState<ImpostorWord[]>([]);
  const [archivedWords, setArchivedWords] = useState<ImpostorWord[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState("");
  const [newClue, setNewClue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Local drafts for the inline clue editors, keyed by word id — lets a MOD
  // type without a round trip on every keystroke; "Save" only appears once
  // the draft actually differs from what's stored.
  const [clueDrafts, setClueDrafts] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    const [{ data: categoryData }, { data: wordsData }] = await Promise.all([
      supabase.from("impostor_categories").select("*").eq("id", categoryId).single(),
      supabase.from("impostor_words").select("*").eq("category_id", categoryId).order("created_at", { ascending: true }),
    ]);
    setCategory(categoryData);
    const active = (wordsData ?? []).filter((w) => !w.archived_at);
    setWords(active);
    setArchivedWords((wordsData ?? []).filter((w) => w.archived_at));
    setClueDrafts(Object.fromEntries(active.map((w) => [w.id, w.clue ?? ""])));
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
    const { error } = await supabase
      .from("impostor_words")
      .insert({ category_id: categoryId, word: trimmed, clue: newClue.trim() || null });
    setSaving(false);
    if (error) {
      setFormError("Could not save that word. Try again.");
      return;
    }
    setNewWord("");
    setNewClue("");
    loadData();
  }

  async function handleBulkImport(newWords: ParsedWord[]) {
    await supabase.from("impostor_words").insert(newWords.map((w) => ({ category_id: categoryId, word: w.word, clue: w.clue })));
    setShowImport(false);
    loadData();
  }

  async function handleSaveClue(wordId: string) {
    setBusyId(wordId);
    const draft = clueDrafts[wordId]?.trim() ?? "";
    await supabase.from("impostor_words").update({ clue: draft || null }).eq("id", wordId);
    setBusyId(null);
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

  const wordsMissingClues = words.filter((w) => !w.clue).length;

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
        {words.length > 0 && wordsMissingClues > 0 && (
          <p className="hint" style={{ marginTop: "4px" }}>
            {wordsMissingClues} word{wordsMissingClues === 1 ? "" : "s"} without a clue — if picked, the Impostor will just see
            "{category?.name}" (the category) instead.
          </p>
        )}

        <div className="card card--tight" style={{ margin: "16px 0" }}>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Word</label>
              <input
                type="text"
                placeholder="e.g. Elephant"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
              />
            </div>
            <div className="field" style={{ flex: 2, marginBottom: 0 }}>
              <label>Clue for the Impostor (optional)</label>
              <input
                type="text"
                placeholder="e.g. Large gray mammal with a trunk"
                value={newClue}
                onChange={(e) => setNewClue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
              />
            </div>
          </div>
          <div className="row">
            <button className="btn btn-secondary" onClick={handleAddWord} disabled={saving}>
              {saving ? <span className="spinner" /> : "+ Add word"}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              📋 Import words
            </button>
          </div>
          {formError && <p className="error-text">{formError}</p>}
        </div>

        {words.length === 0 ? (
          <div className="card text-center">
            <p className="text-muted">No words yet — add one above or import a batch.</p>
          </div>
        ) : (
          <div className="stack">
            {words.map((w) => {
              const draft = clueDrafts[w.id] ?? "";
              const dirty = draft.trim() !== (w.clue ?? "");
              return (
                <div key={w.id} className="card card--tight">
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <strong style={{ minWidth: "100px" }}>{w.word}</strong>
                    <div className="row" style={{ flex: 1, marginLeft: "12px" }}>
                      <input
                        type="text"
                        placeholder="No clue yet — the category name will be used instead"
                        value={draft}
                        onChange={(e) => setClueDrafts((d) => ({ ...d, [w.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && dirty && handleSaveClue(w.id)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "var(--radius-sm)",
                          border: "1.5px solid var(--color-border)",
                          background: "var(--color-surface-raised)",
                          fontSize: "0.9rem",
                        }}
                      />
                      {dirty && (
                        <button className="btn btn-secondary btn-sm" disabled={busyId === w.id} onClick={() => handleSaveClue(w.id)}>
                          {busyId === w.id ? <span className="spinner" /> : "Save"}
                        </button>
                      )}
                    </div>
                    <div className="row" style={{ marginLeft: "8px" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === w.id}
                        onClick={() => handleArchiveWord(w.id)}
                        title="Archive (hide from the random pool without deleting)"
                      >
                        📥
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--color-danger)" }}
                        disabled={busyId === w.id}
                        onClick={() => handleDeleteWord(w.id)}
                        title="Delete for good"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {archivedWords.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide" : "Show"} archived words ({archivedWords.length})
            </button>
            {showArchived && (
              <div className="stack" style={{ marginTop: "12px" }}>
                {archivedWords.map((w) => (
                  <div key={w.id} className="card card--tight row-between" style={{ opacity: 0.7 }}>
                    <span>
                      <strong>{w.word}</strong>
                      {w.clue && <span className="text-muted"> — {w.clue}</span>}
                    </span>
                    <button className="btn btn-secondary btn-sm" disabled={busyId === w.id} onClick={() => handleRestoreWord(w.id)}>
                      {busyId === w.id ? <span className="spinner" /> : "Restore"}
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
