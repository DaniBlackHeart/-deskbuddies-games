import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import QuestionImportModal from "../../components/QuestionImportModal";
import { supabase } from "../../lib/supabaseClient";
import type { ParsedQuestion } from "../../utils/questionParser";
import type { Question, QuestionSet, QuestionType } from "../../types";

const emptyDraft = {
  type: "multiple_choice" as QuestionType,
  prompt: "",
  choices: ["", ""],
  correctChoice: 0,
  acceptedAnswers: "",
  points: 100,
  timeLimit: 20,
};

export default function QuestionSetEditorPage() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();

  const [set, setSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [{ data: setData }, { data: questionsData }] = await Promise.all([
      supabase.from("question_sets").select("*").eq("id", setId).single(),
      supabase
        .from("questions")
        .select("*")
        .eq("question_set_id", setId)
        .order("order_index", { ascending: true }),
    ]);
    setSet(setData);
    setQuestions(questionsData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (setId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  function nextOrderIndex() {
    return questions.length === 0 ? 0 : Math.max(...questions.map((q) => q.order_index)) + 1;
  }

  async function handleAddManual() {
    setFormError(null);
    if (!draft.prompt.trim()) {
      setFormError("Add a question prompt.");
      return;
    }

    let row: Partial<Question>;
    if (draft.type === "multiple_choice") {
      const cleanChoices = draft.choices.map((c) => c.trim()).filter(Boolean);
      if (cleanChoices.length < 2) {
        setFormError("Add at least 2 non-empty choices.");
        return;
      }
      if (draft.correctChoice >= cleanChoices.length) {
        setFormError("Pick a valid correct choice.");
        return;
      }
      row = {
        type: "multiple_choice",
        prompt: draft.prompt.trim(),
        choices: cleanChoices,
        correct_choice: draft.correctChoice,
        accepted_answers: null,
      };
    } else {
      const accepted = draft.acceptedAnswers.split(",").map((a) => a.trim()).filter(Boolean);
      if (accepted.length === 0) {
        setFormError("Add at least one accepted answer.");
        return;
      }
      row = {
        type: "typed",
        prompt: draft.prompt.trim(),
        choices: null,
        correct_choice: null,
        accepted_answers: accepted,
      };
    }

    setSaving(true);
    const { error } = await supabase.from("questions").insert({
      ...row,
      question_set_id: setId,
      order_index: nextOrderIndex(),
      points: draft.points,
      time_limit_seconds: draft.timeLimit,
    });
    setSaving(false);

    if (error) {
      setFormError("Could not save that question. Try again.");
      return;
    }

    setDraft(emptyDraft);
    setShowManualForm(false);
    loadData();
  }

  async function handleImportConfirm(parsedQuestions: ParsedQuestion[]) {
    const startIndex = nextOrderIndex();
    const rows = parsedQuestions.map((q, i) => ({
      question_set_id: setId,
      order_index: startIndex + i,
      type: q.type,
      prompt: q.prompt,
      choices: q.choices,
      correct_choice: q.correct_choice,
      accepted_answers: q.accepted_answers,
      points: q.points,
      time_limit_seconds: q.time_limit_seconds,
    }));

    const { error } = await supabase.from("questions").insert(rows);
    if (error) {
      console.error(error);
      return;
    }
    setShowImport(false);
    loadData();
  }

  async function handleDelete(questionId: string) {
    if (!confirm("Delete this question?")) return;
    await supabase.from("questions").delete().eq("id", questionId);
    loadData();
  }

  async function handleStartSession() {
    if (questions.length === 0) return;
    setLaunching(true);
    const { data, error } = await supabase.functions.invoke("trivia-host", {
      body: { action: "create_session", question_set_id: setId },
    });
    setLaunching(false);
    if (error || data?.error) {
      alert(data?.error ?? "Could not create a session.");
      return;
    }
    navigate(`/mod/host/${data.session.id}`);
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
        <div className="row-between">
          <div>
            <h1>{set?.name}</h1>
            <p className="text-muted" style={{ marginTop: "-8px" }}>
              {questions.length} question{questions.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleStartSession}
            disabled={questions.length === 0 || launching}
          >
            {launching ? <span className="spinner" /> : "▶ Start a session"}
          </button>
        </div>

        <div className="row" style={{ margin: "16px 0" }}>
          <button className="btn btn-secondary" onClick={() => setShowManualForm((s) => !s)}>
            + Add question manually
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            📋 Import / paste questions
          </button>
        </div>

        {showManualForm && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="field">
              <label>Question type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as QuestionType })}
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="typed">Typed answer</option>
              </select>
            </div>

            <div className="field">
              <label>Prompt</label>
              <textarea
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                placeholder="What is the capital of France?"
              />
            </div>

            {draft.type === "multiple_choice" ? (
              <div className="field">
                <label>Choices (mark the correct one)</label>
                <div className="stack">
                  {draft.choices.map((choice, i) => (
                    <div key={i} className="row">
                      <input
                        type="radio"
                        name="correct"
                        checked={draft.correctChoice === i}
                        onChange={() => setDraft({ ...draft, correctChoice: i })}
                      />
                      <input
                        type="text"
                        value={choice}
                        placeholder={`Choice ${i + 1}`}
                        onChange={(e) => {
                          const choices = [...draft.choices];
                          choices[i] = e.target.value;
                          setDraft({ ...draft, choices });
                        }}
                      />
                      {draft.choices.length > 2 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setDraft({ ...draft, choices: draft.choices.filter((_, idx) => idx !== i) })
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {draft.choices.length < 6 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: "8px" }}
                    onClick={() => setDraft({ ...draft, choices: [...draft.choices, ""] })}
                  >
                    + Add choice
                  </button>
                )}
              </div>
            ) : (
              <div className="field">
                <label>Accepted answers (comma separated)</label>
                <input
                  type="text"
                  value={draft.acceptedAnswers}
                  placeholder="Jupiter, the planet Jupiter"
                  onChange={(e) => setDraft({ ...draft, acceptedAnswers: e.target.value })}
                />
                <p className="hint">Matching ignores capitalization, punctuation, and extra spaces.</p>
              </div>
            )}

            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>Points</label>
                <input
                  type="number"
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Time limit (seconds)</label>
                <input
                  type="number"
                  value={draft.timeLimit}
                  onChange={(e) => setDraft({ ...draft, timeLimit: Number(e.target.value) })}
                />
              </div>
            </div>

            {formError && <p className="error-text">{formError}</p>}

            <div className="row">
              <button className="btn btn-primary" onClick={handleAddManual} disabled={saving}>
                {saving ? <span className="spinner" /> : "Save question"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowManualForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="stack">
          {questions.map((q, i) => (
            <div key={q.id} className="card card--tight">
              <div className="row-between">
                <strong>
                  {i + 1}. {q.prompt}
                </strong>
                <div className="row">
                  <span className="badge badge-neutral">
                    {q.type === "multiple_choice" ? "Multiple choice" : "Typed"}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(q.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <p className="hint" style={{ marginTop: "6px" }}>
                {q.points} pts · {q.time_limit_seconds}s ·{" "}
                {q.type === "multiple_choice" && q.choices
                  ? `correct: ${q.choices[q.correct_choice ?? 0]}`
                  : `accepted: ${q.accepted_answers?.join(", ")}`}
              </p>
            </div>
          ))}
          {questions.length === 0 && !showManualForm && (
            <div className="card text-center">
              <p className="text-muted">No questions yet — add one manually or import a list.</p>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <QuestionImportModal onCancel={() => setShowImport(false)} onConfirm={handleImportConfirm} />
      )}
    </div>
  );
}
