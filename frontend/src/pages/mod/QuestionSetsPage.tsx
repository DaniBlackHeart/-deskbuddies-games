import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { deleteQuestionSet, restoreQuestionSet } from "../../lib/archiveOrDelete";
import type { QuestionSet } from "../../types";

export default function QuestionSetsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [archivedSets, setArchivedSets] = useState<QuestionSet[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSets() {
    setLoading(true);
    const { data: setsData } = await supabase
      .from("question_sets")
      .select("*")
      .order("created_at", { ascending: false });

    const withCounts = await Promise.all(
      (setsData ?? []).map(async (set) => {
        const { count } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("question_set_id", set.id)
          .is("archived_at", null);
        return { ...set, question_count: count ?? 0 };
      })
    );

    setSets(withCounts.filter((s) => !s.archived_at));
    setArchivedSets(withCounts.filter((s) => s.archived_at));
    setLoading(false);
  }

  useEffect(() => {
    loadSets();
  }, []);

  async function handleDeleteSet(e: React.MouseEvent, setId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this question set?")) return;

    setBusyId(setId);
    const result = await deleteQuestionSet(setId);
    setBusyId(null);

    if (result.outcome === "error") {
      setMessage(result.message);
    } else if (result.outcome === "archived") {
      setMessage("That set has already been used to host a session, so it's been archived instead of deleted — past leaderboards are still safe. You can restore it from \"Show archived\" below.");
    } else {
      setMessage(null);
    }
    loadSets();
  }

  async function handleRestoreSet(setId: string) {
    setBusyId(setId);
    await restoreQuestionSet(setId);
    setBusyId(null);
    loadSets();
  }

  async function handleCreate() {
    if (!newName.trim() || !profile) return;
    const { data, error } = await supabase
      .from("question_sets")
      .insert({ name: newName.trim(), created_by: profile.id })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }
    navigate(`/mod/sets/${data.id}`);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between">
          <h1>Question Sets</h1>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + New set
          </button>
        </div>

        {creating && (
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="field">
              <label>Set name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. General Knowledge #1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="row">
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                Create & add questions
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

        {!loading && sets.length === 0 && !creating && (
          <div className="card text-center">
            <p className="text-muted">No question sets yet. Create your first one!</p>
          </div>
        )}

        <div className="stack">
          {sets.map((set) => (
            <div key={set.id} className="card row-between">
              <Link
                to={`/mod/sets/${set.id}`}
                style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
              >
                <h3 style={{ marginBottom: "4px" }}>{set.name}</h3>
                <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                  {set.question_count} question{set.question_count === 1 ? "" : "s"}
                </span>
              </Link>
              <div className="row">
                <Link to={`/mod/sets/${set.id}`} className="btn btn-secondary btn-sm">
                  Edit →
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === set.id}
                  onClick={(e) => handleDeleteSet(e, set.id)}
                >
                  {busyId === set.id ? <span className="spinner" /> : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {archivedSets.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide" : "Show"} archived ({archivedSets.length})
            </button>

            {showArchived && (
              <div className="stack" style={{ marginTop: "12px" }}>
                {archivedSets.map((set) => (
                  <div key={set.id} className="card row-between" style={{ opacity: 0.7 }}>
                    <div>
                      <h3 style={{ marginBottom: "4px" }}>{set.name}</h3>
                      <span className="badge badge-neutral">Archived</span>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === set.id}
                      onClick={() => handleRestoreSet(set.id)}
                    >
                      {busyId === set.id ? <span className="spinner" /> : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
