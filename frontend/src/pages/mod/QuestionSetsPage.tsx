import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import type { QuestionSet } from "../../types";

export default function QuestionSetsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

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
          .eq("question_set_id", set.id);
        return { ...set, question_count: count ?? 0 };
      })
    );

    setSets(withCounts);
    setLoading(false);
  }

  useEffect(() => {
    loadSets();
  }, []);

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

        {loading && <p className="text-muted">Loading…</p>}

        {!loading && sets.length === 0 && !creating && (
          <div className="card text-center">
            <p className="text-muted">No question sets yet. Create your first one!</p>
          </div>
        )}

        <div className="stack">
          {sets.map((set) => (
            <Link key={set.id} to={`/mod/sets/${set.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="card row-between">
                <div>
                  <h3 style={{ marginBottom: "4px" }}>{set.name}</h3>
                  <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                    {set.question_count} question{set.question_count === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="btn btn-secondary btn-sm">Edit →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
