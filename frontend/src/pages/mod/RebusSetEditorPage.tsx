import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import RebusImportModal from "../../components/RebusImportModal";
import { supabase } from "../../lib/supabaseClient";
import { deleteRebusPuzzle, restoreRebusPuzzle, deleteRebusSprintPuzzle } from "../../lib/archiveOrDelete";
import {
  parseRebusSprintInput,
  REBUS_SPRINT_TEMPLATE_EXAMPLE,
  REBUS_PUZZLE_TYPE_LABELS,
  REBUS_TYPE_EXAMPLES,
  REBUS_DIFFICULTY_LABELS,
  REBUS_DIFFICULTY_ORDER,
  REBUS_ROUND_DEFAULTS,
  type ParsedRebusPuzzle,
} from "../../utils/rebusPuzzleParser";
import type { RebusPuzzle, RebusPuzzleType, RebusRound, RebusSet, RebusSprintPuzzle } from "../../types";

// Labels and examples live in rebusPuzzleParser.ts now — shared with the
// import modal, which shows the same per-type examples as a paste
// reference and uses the same labels to show its auto-detected guess.
const TYPE_OPTIONS: { value: RebusPuzzleType; label: string }[] = (
  Object.entries(REBUS_PUZZLE_TYPE_LABELS) as [RebusPuzzleType, string][]
).map(([value, label]) => ({ value, label }));

const emptyDraft = (round: RebusRound) => ({
  round,
  puzzleType: "phonetic" as RebusPuzzleType,
  display: "",
  answer: "",
  acceptedAnswers: "",
  points: REBUS_ROUND_DEFAULTS[round].points,
  timeLimit: REBUS_ROUND_DEFAULTS[round].time_limit_seconds,
});

export default function RebusSetEditorPage() {
  const { setId } = useParams<{ setId: string }>();

  const [set, setSet] = useState<RebusSet | null>(null);
  const [puzzles, setPuzzles] = useState<RebusPuzzle[]>([]);
  const [archivedPuzzles, setArchivedPuzzles] = useState<RebusPuzzle[]>([]);
  const [sprintPuzzles, setSprintPuzzles] = useState<RebusSprintPuzzle[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"puzzles" | "sprint">("puzzles");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [draft, setDraft] = useState(emptyDraft("warmup"));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const [sprintDisplay, setSprintDisplay] = useState("");
  const [sprintAnswer, setSprintAnswer] = useState("");
  const [sprintAccepted, setSprintAccepted] = useState("");
  const [sprintBulk, setSprintBulk] = useState("");
  const [showSprintExample, setShowSprintExample] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [{ data: setData }, { data: puzzleData }, { data: sprintData }] = await Promise.all([
      supabase.from("rebus_sets").select("*").eq("id", setId).single(),
      supabase.from("rebus_puzzles").select("*").eq("rebus_set_id", setId).order("order_index", { ascending: true }),
      supabase.from("rebus_sprint_puzzles").select("*").eq("rebus_set_id", setId).order("order_index", { ascending: true }),
    ]);
    setSet(setData);
    setPuzzles((puzzleData ?? []).filter((p) => !p.archived_at));
    setArchivedPuzzles((puzzleData ?? []).filter((p) => p.archived_at));
    setSprintPuzzles(sprintData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (setId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  function nextOrderIndex() {
    return puzzles.length === 0 ? 0 : Math.max(...puzzles.map((p) => p.order_index)) + 1;
  }

  function nextSprintOrderIndex() {
    return sprintPuzzles.length === 0 ? 0 : Math.max(...sprintPuzzles.map((p) => p.order_index)) + 1;
  }

  async function handleAddManual() {
    setFormError(null);
    if (!draft.display.trim()) {
      setFormError("Add the puzzle's display text (what shows on screen).");
      return;
    }
    if (!draft.answer.trim()) {
      setFormError("Add the answer.");
      return;
    }
    const accepted = draft.acceptedAnswers.split(",").map((a) => a.trim()).filter(Boolean);

    setSaving(true);
    const { error } = await supabase.from("rebus_puzzles").insert({
      rebus_set_id: setId,
      order_index: nextOrderIndex(),
      round: draft.round,
      puzzle_type: draft.puzzleType,
      display_text: draft.display.trim(),
      answer_text: draft.answer.trim(),
      accepted_answers: accepted.length > 0 ? accepted : [draft.answer.trim()],
      points: draft.points,
      time_limit_seconds: draft.timeLimit,
    });
    setSaving(false);

    if (error) {
      setFormError("Could not save that puzzle. Try again.");
      return;
    }

    setDraft(emptyDraft(draft.round));
    setShowManualForm(false);
    loadData();
  }

  async function handleImportConfirm(parsedPuzzles: ParsedRebusPuzzle[]) {
    const startIndex = nextOrderIndex();
    const rows = parsedPuzzles.map((p, i) => ({
      rebus_set_id: setId,
      order_index: startIndex + i,
      round: p.round,
      puzzle_type: p.puzzle_type,
      display_text: p.display_text,
      answer_text: p.answer_text,
      accepted_answers: p.accepted_answers,
      points: p.points,
      time_limit_seconds: p.time_limit_seconds,
    }));

    const { error } = await supabase.from("rebus_puzzles").insert(rows);
    if (error) {
      console.error(error);
      return;
    }
    setShowImport(false);
    loadData();
  }

  async function handleDelete(puzzle: RebusPuzzle) {
    if (!confirm("Delete this puzzle?")) return;
    setDeleteBusyId(puzzle.id);
    const result = await deleteRebusPuzzle({ id: puzzle.id, rebus_set_id: puzzle.rebus_set_id });
    setDeleteBusyId(null);

    if (result.outcome === "error" || result.outcome === "blocked") {
      setDeleteMessage(result.message);
    } else if (result.outcome === "archived") {
      setDeleteMessage(
        "That puzzle has already been used in a past session, so it's been archived instead of deleted — past scores are still safe. You can restore it from \"Show archived\" below."
      );
    } else {
      setDeleteMessage(null);
    }
    loadData();
  }

  async function handleRestore(puzzle: RebusPuzzle) {
    setDeleteBusyId(puzzle.id);
    await restoreRebusPuzzle({ id: puzzle.id, rebus_set_id: puzzle.rebus_set_id });
    setDeleteBusyId(null);
    loadData();
  }

  async function handleAddSprintManual() {
    setSprintError(null);
    if (!sprintDisplay.trim() || !sprintAnswer.trim()) {
      setSprintError("Add both the display text and the answer.");
      return;
    }
    const accepted = sprintAccepted.split(",").map((a) => a.trim()).filter(Boolean);
    const { error } = await supabase.from("rebus_sprint_puzzles").insert({
      rebus_set_id: setId,
      order_index: nextSprintOrderIndex(),
      display_text: sprintDisplay.trim(),
      answer_text: sprintAnswer.trim(),
      accepted_answers: accepted.length > 0 ? accepted : [sprintAnswer.trim()],
    });
    if (error) {
      setSprintError("Could not save that puzzle. Try again.");
      return;
    }
    setSprintDisplay("");
    setSprintAnswer("");
    setSprintAccepted("");
    loadData();
  }

  async function handleSprintBulkImport() {
    setSprintError(null);
    const { puzzles: parsed, errors } = parseRebusSprintInput(sprintBulk);
    if (errors.length > 0) {
      setSprintError(errors.join(" · "));
      return;
    }
    if (parsed.length === 0) return;
    const startIndex = nextSprintOrderIndex();
    const rows = parsed.map((p, i) => ({
      rebus_set_id: setId,
      order_index: startIndex + i,
      display_text: p.display_text,
      answer_text: p.answer_text,
      accepted_answers: p.accepted_answers,
    }));
    const { error } = await supabase.from("rebus_sprint_puzzles").insert(rows);
    if (error) {
      setSprintError("Could not import those puzzles. Try again.");
      return;
    }
    setSprintBulk("");
    loadData();
  }

  async function handleDeleteSprint(id: string) {
    if (!confirm("Delete this Sprint puzzle?")) return;
    setDeleteBusyId(id);
    await deleteRebusSprintPuzzle(id);
    setDeleteBusyId(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const puzzlesByDifficulty = REBUS_DIFFICULTY_ORDER.map((round) => ({
    round,
    label: REBUS_DIFFICULTY_LABELS[round],
    items: puzzles.filter((p) => p.round === round),
    archived: archivedPuzzles.filter((p) => p.round === round),
  }));
  const summary = puzzlesByDifficulty.map((g) => `${g.items.length} ${g.label}`).join(" · ");

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div>
          <h1>{set?.name}</h1>
          <p className="text-muted" style={{ marginTop: "-8px" }}>
            {summary} · {sprintPuzzles.length} Sprint puzzle{sprintPuzzles.length === 1 ? "" : "s"}
          </p>
          <p className="hint" style={{ marginTop: "-4px" }}>
            Chill/Hard, Solo/Team, and starting a session now live on the{" "}
            <Link to="/mod/rebus-sets">Type What You See</Link> page — every session mixes puzzles from all your sets.
          </p>
        </div>

        <div className="row" style={{ marginTop: "20px", flexWrap: "wrap", gap: "8px" }}>
          <button
            className={`btn btn-sm ${activeTab === "puzzles" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("puzzles")}
          >
            Puzzles ({puzzles.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === "sprint" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("sprint")}
          >
            ⚡ Sprint Pool ({sprintPuzzles.length})
          </button>
        </div>

        {activeTab !== "sprint" ? (
          <>
            <div className="row" style={{ margin: "16px 0" }}>
              <button className="btn btn-secondary" onClick={() => setShowManualForm((s) => !s)}>
                + Add puzzle manually
              </button>
              <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                📋 Import / paste puzzles
              </button>
            </div>

            {showManualForm && (
              <div className="card" style={{ marginBottom: "20px" }}>
                <div className="row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>Difficulty</label>
                    <select
                      value={draft.round}
                      onChange={(e) => {
                        const round = e.target.value as RebusRound;
                        setDraft({ ...draft, round, points: REBUS_ROUND_DEFAULTS[round].points, timeLimit: REBUS_ROUND_DEFAULTS[round].time_limit_seconds });
                      }}
                    >
                      {REBUS_DIFFICULTY_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {REBUS_DIFFICULTY_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Puzzle type</label>
                    <select value={draft.puzzleType} onChange={(e) => setDraft({ ...draft, puzzleType: e.target.value as RebusPuzzleType })}>
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="hint">
                      e.g. "{REBUS_TYPE_EXAMPLES[draft.puzzleType].display.replace(/\n/g, " / ")}" → {REBUS_TYPE_EXAMPLES[draft.puzzleType].answer}
                    </p>
                  </div>
                </div>

                <div className="field">
                  <label>Display text (what shows on screen)</label>
                  <textarea
                    value={draft.display}
                    onChange={(e) => setDraft({ ...draft, display: e.target.value })}
                    placeholder="SIR USE LEE"
                  />
                  <p className="hint">Line breaks are preserved as-is — useful for visual-arrangement puzzles.</p>
                </div>

                <div className="field">
                  <label>Answer</label>
                  <input type="text" value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} placeholder="Seriously" />
                </div>

                <div className="field">
                  <label>Other accepted answers (comma separated, optional)</label>
                  <input
                    type="text"
                    value={draft.acceptedAnswers}
                    onChange={(e) => setDraft({ ...draft, acceptedAnswers: e.target.value })}
                    placeholder="e.g. Very seriously"
                  />
                  <p className="hint">Matching ignores capitalization, punctuation, and extra spaces. The main answer is always accepted too.</p>
                </div>

                <div className="row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>Points</label>
                    <input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Time limit (seconds)</label>
                    <input type="number" value={draft.timeLimit} onChange={(e) => setDraft({ ...draft, timeLimit: Number(e.target.value) })} />
                  </div>
                </div>
                <p className="hint" style={{ marginTop: "-8px" }}>
                  Every correct answer also earns a flat +300 speed bonus. In Hard mode, a wrong answer costs half the points shown here.
                </p>

                {formError && <p className="error-text">{formError}</p>}

                <div className="row">
                  <button className="btn btn-primary" onClick={handleAddManual} disabled={saving}>
                    {saving ? <span className="spinner" /> : "Save puzzle"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowManualForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {deleteMessage && (
              <div className="card card--tight" style={{ marginBottom: "16px" }}>
                <p className="hint" style={{ margin: 0 }}>
                  {deleteMessage}
                </p>
              </div>
            )}

            {puzzlesByDifficulty.map((group) => (
              <div key={group.round} style={{ marginTop: "20px" }}>
                <h3 style={{ marginBottom: "8px" }}>
                  {group.label} <span className="text-muted">({group.items.length})</span>
                </h3>
                <div className="stack">
                  {group.items.map((p, i) => (
                    <div key={p.id} className="card card--tight">
                      <div className="row-between">
                        <strong>
                          {i + 1}. {p.display_text}
                        </strong>
                        <div className="row">
                          <span className="badge badge-neutral">{REBUS_PUZZLE_TYPE_LABELS[p.puzzle_type]}</span>
                          <button className="btn btn-ghost btn-sm" disabled={deleteBusyId === p.id} onClick={() => handleDelete(p)}>
                            {deleteBusyId === p.id ? <span className="spinner" /> : "Delete"}
                          </button>
                        </div>
                      </div>
                      <p className="hint" style={{ marginTop: "6px" }}>
                        {p.points} pts (+300 speed bonus) · {p.time_limit_seconds}s · answer: {p.answer_text}
                        {p.accepted_answers.length > 1 && ` (also: ${p.accepted_answers.filter((a) => a !== p.answer_text).join(", ")})`}
                      </p>
                    </div>
                  ))}
                  {group.items.length === 0 && (
                    <div className="card text-center">
                      <p className="text-muted">No {group.label} puzzles yet — add one manually or import a list.</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {archivedPuzzles.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
                  {showArchived ? "Hide" : "Show"} archived ({archivedPuzzles.length})
                </button>

                {showArchived && (
                  <div className="stack" style={{ marginTop: "12px" }}>
                    {archivedPuzzles.map((p) => (
                      <div key={p.id} className="card card--tight" style={{ opacity: 0.7 }}>
                        <div className="row-between">
                          <strong>{p.display_text}</strong>
                          <div className="row">
                            <span className="badge badge-neutral">{REBUS_DIFFICULTY_LABELS[p.round]}</span>
                            <span className="badge badge-neutral">Archived</span>
                            <button className="btn btn-secondary btn-sm" disabled={deleteBusyId === p.id} onClick={() => handleRestore(p)}>
                              {deleteBusyId === p.id ? <span className="spinner" /> : "Restore"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="hint" style={{ marginTop: "16px" }}>
              A flat pool of quick puzzles for Round 4 (the Sprint) — the two chosen players race through this list, in
              order, for 30 seconds each. No round, type, points, or timer to set — every correct answer is worth 500
              points flat.
            </p>

            <div className="card" style={{ marginTop: "12px" }}>
              <h3>Add one</h3>
              <div className="row">
                <div className="field" style={{ flex: 1 }}>
                  <label>Display text</label>
                  <input type="text" value={sprintDisplay} onChange={(e) => setSprintDisplay(e.target.value)} placeholder="GR8" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Answer</label>
                  <input type="text" value={sprintAnswer} onChange={(e) => setSprintAnswer(e.target.value)} placeholder="Great" />
                </div>
              </div>
              <div className="field">
                <label>Other accepted answers (comma separated, optional)</label>
                <input type="text" value={sprintAccepted} onChange={(e) => setSprintAccepted(e.target.value)} />
              </div>
              {sprintError && <p className="error-text">{sprintError}</p>}
              <button className="btn btn-primary" onClick={handleAddSprintManual}>
                Add puzzle
              </button>
            </div>

            <div className="card" style={{ marginTop: "16px" }}>
              <h3>Bulk paste</h3>
              <p className="text-muted">
                One puzzle per line: <code>DISPLAY :: ANSWER</code> or <code>DISPLAY :: ANSWER :: alt1, alt2</code>.{" "}
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSprintExample((s) => !s)} style={{ padding: 0 }}>
                  {showSprintExample ? "Hide example" : "Show example"}
                </button>
              </p>
              {showSprintExample && (
                <pre style={{ background: "var(--color-bg-alt)", padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
                  {REBUS_SPRINT_TEMPLATE_EXAMPLE}
                </pre>
              )}
              <textarea
                value={sprintBulk}
                onChange={(e) => setSprintBulk(e.target.value)}
                placeholder={"GR8 :: Great\n2 + NIGHT :: Tonight"}
                style={{ minHeight: "120px", fontFamily: "monospace", fontSize: "0.85rem" }}
              />
              <button className="btn btn-secondary" onClick={handleSprintBulkImport} disabled={!sprintBulk.trim()} style={{ marginTop: "8px" }}>
                Import
              </button>
            </div>

            <div className="stack" style={{ marginTop: "16px" }}>
              {sprintPuzzles.map((p, i) => (
                <div key={p.id} className="card card--tight">
                  <div className="row-between">
                    <strong>
                      {i + 1}. {p.display_text}
                    </strong>
                    <button className="btn btn-ghost btn-sm" disabled={deleteBusyId === p.id} onClick={() => handleDeleteSprint(p.id)}>
                      {deleteBusyId === p.id ? <span className="spinner" /> : "Delete"}
                    </button>
                  </div>
                  <p className="hint" style={{ marginTop: "6px" }}>
                    answer: {p.answer_text}
                    {p.accepted_answers.length > 1 && ` (also: ${p.accepted_answers.filter((a) => a !== p.answer_text).join(", ")})`}
                  </p>
                </div>
              ))}
              {sprintPuzzles.length === 0 && (
                <div className="card text-center">
                  <p className="text-muted">No Sprint puzzles yet.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showImport && activeTab === "puzzles" && (
        <RebusImportModal onCancel={() => setShowImport(false)} onConfirm={handleImportConfirm} />
      )}
    </div>
  );
}
