import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import WheelImportModal from "../../components/WheelImportModal";
import { supabase } from "../../lib/supabaseClient";
import type { WheelCategory, WheelPhrase } from "../../types";

export default function WheelCategoryEditorPage() {
  const { categoryId } = useParams<{ categoryId: string }>();

  const [category, setCategory] = useState<WheelCategory | null>(null);
  const [phrases, setPhrases] = useState<WheelPhrase[]>([]);
  const [archivedPhrases, setArchivedPhrases] = useState<WheelPhrase[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPhrase, setNewPhrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  async function loadData() {
    setLoading(true);
    const [{ data: categoryData }, { data: phrasesData }] = await Promise.all([
      supabase.from("wheel_categories").select("*").eq("id", categoryId).single(),
      supabase.from("wheel_phrases").select("*").eq("category_id", categoryId).order("created_at", { ascending: true }),
    ]);
    setCategory(categoryData);
    setPhrases((phrasesData ?? []).filter((p) => !p.archived_at));
    setArchivedPhrases((phrasesData ?? []).filter((p) => p.archived_at));
    setLoading(false);
  }

  useEffect(() => {
    if (categoryId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function handleAddPhrase() {
    setFormError(null);
    const trimmed = newPhrase.trim();
    if (!trimmed) {
      setFormError("Type a phrase first.");
      return;
    }
    if (!/[A-Za-z]/.test(trimmed)) {
      setFormError("A phrase needs at least one letter.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("wheel_phrases").insert({ category_id: categoryId, phrase: trimmed });
    setSaving(false);
    if (error) {
      setFormError("Could not save that phrase. Try again.");
      return;
    }
    setNewPhrase("");
    loadData();
  }

  async function handleBulkImport(newPhrases: string[]) {
    await supabase.from("wheel_phrases").insert(newPhrases.map((p) => ({ category_id: categoryId, phrase: p })));
    setShowImport(false);
    loadData();
  }

  async function handleArchivePhrase(phraseId: string) {
    setBusyId(phraseId);
    await supabase.from("wheel_phrases").update({ archived_at: new Date().toISOString() }).eq("id", phraseId);
    setBusyId(null);
    loadData();
  }

  async function handleRestorePhrase(phraseId: string) {
    setBusyId(phraseId);
    await supabase.from("wheel_phrases").update({ archived_at: null }).eq("id", phraseId);
    setBusyId(null);
    loadData();
  }

  async function handleDeletePhrase(phraseId: string) {
    if (!confirm("Delete this phrase for good?")) return;
    // No FK anywhere points at wheel_phrases (a round only ever copies the
    // text out when it starts), so this always hard-deletes cleanly — no
    // archive-or-delete fallback needed, unlike wheel_categories.
    setBusyId(phraseId);
    await supabase.from("wheel_phrases").delete().eq("id", phraseId);
    setBusyId(null);
    loadData();
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
        <div>
          <h1>{category?.name}</h1>
          <p className="text-muted" style={{ marginTop: "-8px" }}>
            {phrases.length} phrase{phrases.length === 1 ? "" : "s"}
            {category?.description ? ` · ${category.description}` : ""}
          </p>
        </div>
        {phrases.length === 0 && (
          <p className="hint" style={{ marginTop: "4px" }}>
            Add at least one phrase — a random one from this category gets picked whenever a round lands here.
          </p>
        )}

        <div className="card card--tight" style={{ margin: "16px 0" }}>
          <div className="field" style={{ marginBottom: "8px" }}>
            <label>Phrase</label>
            <input
              type="text"
              placeholder="e.g. A Trip Down Memory Lane"
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPhrase()}
            />
            <p className="hint" style={{ marginBottom: 0 }}>
              Spaces and punctuation show through on the board as-is — only letters get hidden.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={handleAddPhrase} disabled={saving}>
            {saving ? <span className="spinner" /> : "+ Add phrase"}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            📋 Import phrases
          </button>
          {formError && <p className="error-text">{formError}</p>}
        </div>

        {phrases.length === 0 ? (
          <div className="card text-center">
            <p className="text-muted">No phrases yet — add one above.</p>
          </div>
        ) : (
          <div className="stack">
            {phrases.map((p) => (
              <div key={p.id} className="card card--tight row-between">
                <span style={{ fontWeight: 700 }}>{p.phrase}</span>
                <div className="row">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === p.id}
                    onClick={() => handleArchivePhrase(p.id)}
                    title="Archive (hide from the random pool without deleting)"
                  >
                    📥
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--color-danger)" }}
                    disabled={busyId === p.id}
                    onClick={() => handleDeletePhrase(p.id)}
                    title="Delete for good"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {archivedPhrases.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide" : "Show"} archived phrases ({archivedPhrases.length})
            </button>
            {showArchived && (
              <div className="stack" style={{ marginTop: "12px" }}>
                {archivedPhrases.map((p) => (
                  <div key={p.id} className="card card--tight row-between" style={{ opacity: 0.7 }}>
                    <span>{p.phrase}</span>
                    <button className="btn btn-secondary btn-sm" disabled={busyId === p.id} onClick={() => handleRestorePhrase(p.id)}>
                      {busyId === p.id ? <span className="spinner" /> : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && <WheelImportModal mode="phrases" onCancel={() => setShowImport(false)} onConfirm={handleBulkImport} />}
    </div>
  );
}
