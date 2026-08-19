import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { supabase, invokeFunction } from "../../lib/supabaseClient";
import type { FeudAnswer, FeudFastMoneyQuestion, FeudRoundQuestion, FeudSet } from "../../types";

type AnswerDraft = { text: string; points: number; alt: string };

function emptyAnswers(count: number): AnswerDraft[] {
  return Array.from({ length: count }, () => ({ text: "", points: 0, alt: "" }));
}

function AnswersEditor({
  answers,
  onChange,
  max,
}: {
  answers: AnswerDraft[];
  onChange: (answers: AnswerDraft[]) => void;
  max: number;
}) {
  return (
    <div className="stack">
      {answers.map((a, i) => (
        <div key={i} className="row" style={{ alignItems: "center" }}>
          <span className="hint" style={{ width: "18px" }}>
            {i + 1}
          </span>
          <input
            type="text"
            placeholder="Answer"
            value={a.text}
            style={{ flex: 2 }}
            onChange={(e) => {
              const next = [...answers];
              next[i] = { ...next[i], text: e.target.value };
              onChange(next);
            }}
          />
          <input
            type="number"
            placeholder="Pts"
            value={a.points}
            style={{ width: "70px" }}
            onChange={(e) => {
              const next = [...answers];
              next[i] = { ...next[i], points: Number(e.target.value) };
              onChange(next);
            }}
          />
          <input
            type="text"
            placeholder="Alt phrasings (comma sep.)"
            value={a.alt}
            style={{ flex: 2 }}
            onChange={(e) => {
              const next = [...answers];
              next[i] = { ...next[i], alt: e.target.value };
              onChange(next);
            }}
          />
          {answers.length > 2 && (
            <button className="btn btn-ghost btn-sm" onClick={() => onChange(answers.filter((_, idx) => idx !== i))}>
              ✕
            </button>
          )}
        </div>
      ))}
      {answers.length < max && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange([...answers, { text: "", points: 0, alt: "" }])}>
          + Add answer
        </button>
      )}
    </div>
  );
}

// 1-based position of a question among only the normal (non-tiebreaker)
// rounds, for numbering the list the same way players experience it.
function normalRoundIndex(all: FeudRoundQuestion[], q: FeudRoundQuestion): number {
  return all.filter((x) => !x.is_tiebreaker).findIndex((x) => x.id === q.id) + 1;
}

function toFeudAnswers(drafts: AnswerDraft[]): FeudAnswer[] {
  return drafts
    .filter((a) => a.text.trim())
    .map((a) => ({
      text: a.text.trim(),
      points: Number(a.points) || 0,
      ...(a.alt.trim() ? { alt_answers: a.alt.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
    }))
    .sort((a, b) => b.points - a.points);
}

function fromFeudAnswers(answers: FeudAnswer[]): AnswerDraft[] {
  return answers.map((a) => ({ text: a.text, points: a.points, alt: (a.alt_answers ?? []).join(", ") }));
}

export default function FeudSetEditorPage() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();

  const [set, setSet] = useState<FeudSet | null>(null);
  const [roundQuestions, setRoundQuestions] = useState<FeudRoundQuestion[]>([]);
  const [fmQuestions, setFmQuestions] = useState<FeudFastMoneyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);

  const [showBoardForm, setShowBoardForm] = useState(false);
  const [boardPrompt, setBoardPrompt] = useState("");
  const [boardAnswers, setBoardAnswers] = useState<AnswerDraft[]>(emptyAnswers(6));
  const [boardIsTiebreaker, setBoardIsTiebreaker] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showFmForm, setShowFmForm] = useState<number | null>(null);
  const [fmPrompt, setFmPrompt] = useState("");
  const [fmAnswers, setFmAnswers] = useState<AnswerDraft[]>(emptyAnswers(4));
  const [fmError, setFmError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [{ data: setData }, { data: roundData }, { data: fmData }] = await Promise.all([
      supabase.from("feud_sets").select("*").eq("id", setId).single(),
      supabase.from("feud_round_questions").select("*").eq("feud_set_id", setId).order("order_index"),
      supabase.from("feud_fastmoney_questions").select("*").eq("feud_set_id", setId).order("order_index"),
    ]);
    setSet(setData);
    setRoundQuestions(roundData ?? []);
    setFmQuestions(fmData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (setId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  async function handleAddBoardQuestion() {
    setBoardError(null);
    if (!boardPrompt.trim()) {
      setBoardError("Add a prompt.");
      return;
    }
    const answers = toFeudAnswers(boardAnswers);
    if (answers.length < 2) {
      setBoardError("Add at least 2 answers with point values.");
      return;
    }

    setSaving(true);
    const nextIndex = roundQuestions.length === 0 ? 0 : Math.max(...roundQuestions.map((q) => q.order_index)) + 1;
    const { error } = await supabase.from("feud_round_questions").insert({
      feud_set_id: setId,
      order_index: nextIndex,
      prompt: boardPrompt.trim(),
      answers,
      is_tiebreaker: boardIsTiebreaker,
    });
    setSaving(false);
    if (error) {
      setBoardError("Could not save that question.");
      return;
    }
    setBoardPrompt("");
    setBoardAnswers(emptyAnswers(6));
    setBoardIsTiebreaker(false);
    setShowBoardForm(false);
    loadData();
  }

  async function handleDeleteBoardQuestion(id: string) {
    if (!confirm("Delete this board question?")) return;
    await supabase.from("feud_round_questions").delete().eq("id", id);
    loadData();
  }

  async function handleAddFastMoney(orderIndex: number) {
    setFmError(null);
    if (!fmPrompt.trim()) {
      setFmError("Add a prompt.");
      return;
    }
    const answers = toFeudAnswers(fmAnswers);
    if (answers.length < 2) {
      setFmError("Add at least 2 answers with point values.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("feud_fastmoney_questions")
      .upsert({ feud_set_id: setId, order_index: orderIndex, prompt: fmPrompt.trim(), answers }, { onConflict: "feud_set_id,order_index" });
    setSaving(false);
    if (error) {
      setFmError("Could not save that question.");
      return;
    }
    setFmPrompt("");
    setFmAnswers(emptyAnswers(4));
    setShowFmForm(null);
    loadData();
  }

  async function handleDeleteFastMoney(id: string) {
    if (!confirm("Delete this Fast Money question?")) return;
    await supabase.from("feud_fastmoney_questions").delete().eq("id", id);
    loadData();
  }

  function openFmEditor(orderIndex: number) {
    const existing = fmQuestions.find((q) => q.order_index === orderIndex);
    setFmPrompt(existing?.prompt ?? "");
    setFmAnswers(existing ? fromFeudAnswers(existing.answers) : emptyAnswers(4));
    setFmError(null);
    setShowFmForm(orderIndex);
  }

  async function handleStartSession() {
    if (normalRoundCount === 0) return;
    setLaunching(true);
    const { data, error } = await invokeFunction("feud-host", { action: "create_session", feud_set_id: setId });
    setLaunching(false);
    if (error) {
      alert(error);
      return;
    }
    navigate(`/mod/feud-host/${data.session.id}`);
  }

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const fmReady = fmQuestions.length === 5;
  const normalRoundCount = roundQuestions.filter((q) => !q.is_tiebreaker).length;
  const tiebreakerRoundCount = roundQuestions.length - normalRoundCount;

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1>{set?.name}</h1>
            <p className="text-muted" style={{ marginTop: "-8px" }}>
              {normalRoundCount} board question{normalRoundCount === 1 ? "" : "s"}
              {tiebreakerRoundCount > 0 && ` · ${tiebreakerRoundCount} tiebreaker`} · Fast Money {fmQuestions.length}/5
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleStartSession} disabled={normalRoundCount === 0 || launching}>
            {launching ? <span className="spinner" /> : "▶ Host a session"}
          </button>
        </div>
        {!fmReady && (
          <p className="hint">
            Fast Money needs all 5 questions filled in before you can run that round — the main game works fine without it in the meantime.
          </p>
        )}

        {/* --- Board questions --- */}
        <h2 style={{ marginTop: "28px" }}>Board questions</h2>
        <div className="row" style={{ margin: "12px 0" }}>
          <button className="btn btn-secondary" onClick={() => setShowBoardForm((s) => !s)}>
            + Add board question
          </button>
        </div>

        {showBoardForm && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="field">
              <label>Prompt</label>
              <textarea value={boardPrompt} onChange={(e) => setBoardPrompt(e.target.value)} placeholder="Name something you do before bed" />
            </div>
            <div className="field">
              <label>Answers, ranked by how many people said it (points = survey %)</label>
              <AnswersEditor answers={boardAnswers} onChange={setBoardAnswers} max={8} />
              <p className="hint">Alt phrasings let you accept close variants (e.g. "sleep, sleeping, nap").</p>
            </div>
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={boardIsTiebreaker}
                  onChange={(e) => setBoardIsTiebreaker(e.target.checked)}
                  style={{ width: "auto" }}
                />
                ⚡ This is a tiebreaker round
              </label>
              <p className="hint">
                Only played if the main game ends tied — add tiebreaker rounds after all your normal ones.
              </p>
            </div>
            {boardError && <p className="error-text">{boardError}</p>}
            <div className="row">
              <button className="btn btn-primary" onClick={handleAddBoardQuestion} disabled={saving}>
                {saving ? <span className="spinner" /> : "Save question"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowBoardForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="stack">
          {roundQuestions.map((q) => (
            <div key={q.id} className="card card--tight">
              <div className="row-between">
                <strong>
                  {q.is_tiebreaker ? "⚡ Tiebreaker" : `${normalRoundIndex(roundQuestions, q)}.`} {q.prompt}
                </strong>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteBoardQuestion(q.id)}>
                  Delete
                </button>
              </div>
              <p className="hint" style={{ marginTop: "6px" }}>
                {q.answers.map((a) => `${a.text} (${a.points})`).join(" · ")}
              </p>
            </div>
          ))}
          {roundQuestions.length === 0 && !showBoardForm && (
            <div className="card text-center">
              <p className="text-muted">No board questions yet.</p>
            </div>
          )}
        </div>

        {/* --- Fast Money --- */}
        <h2 style={{ marginTop: "28px" }}>Fast Money (exactly 5)</h2>
        <div className="stack" style={{ marginTop: "12px" }}>
          {Array.from({ length: 5 }).map((_, i) => {
            const existing = fmQuestions.find((q) => q.order_index === i);
            return (
              <div key={i} className="card card--tight">
                {showFmForm === i ? (
                  <>
                    <div className="field">
                      <label>Question {i + 1} prompt</label>
                      <textarea value={fmPrompt} onChange={(e) => setFmPrompt(e.target.value)} placeholder="Name a reason to be late for work" />
                    </div>
                    <div className="field">
                      <label>Top survey answers</label>
                      <AnswersEditor answers={fmAnswers} onChange={setFmAnswers} max={6} />
                    </div>
                    {fmError && <p className="error-text">{fmError}</p>}
                    <div className="row">
                      <button className="btn btn-primary" onClick={() => handleAddFastMoney(i)} disabled={saving}>
                        {saving ? <span className="spinner" /> : "Save"}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setShowFmForm(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="row-between">
                    <div>
                      <strong>
                        {i + 1}. {existing?.prompt ?? <span className="text-muted">Not set yet</span>}
                      </strong>
                      {existing && <p className="hint" style={{ marginTop: "4px" }}>{existing.answers.map((a) => `${a.text} (${a.points})`).join(" · ")}</p>}
                    </div>
                    <div className="row">
                      <button className="btn btn-secondary btn-sm" onClick={() => openFmEditor(i)}>
                        {existing ? "Edit" : "Add"}
                      </button>
                      {existing && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteFastMoney(existing.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
