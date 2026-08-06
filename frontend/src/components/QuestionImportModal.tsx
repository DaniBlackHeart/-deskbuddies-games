import { useState } from "react";
import { parseQuestionInput, TEMPLATE_EXAMPLE, type ParsedQuestion } from "../utils/questionParser";

type QuestionImportModalProps = {
  onCancel: () => void;
  onConfirm: (questions: ParsedQuestion[]) => Promise<void>;
};

export default function QuestionImportModal({ onCancel, onConfirm }: QuestionImportModalProps) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  function handlePreview() {
    const result = parseQuestionInput(raw);
    setParsed(result.questions);
    setErrors(result.errors);
  }

  async function handleConfirm() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    try {
      await onConfirm(parsed);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61, 50, 41, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 50,
      }}
    >
      <div className="card" style={{ maxWidth: "620px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <h2>Import questions</h2>
        <p className="text-muted">
          Paste a JSON array, or use the simple text template.{" "}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExample((s) => !s)} style={{ padding: 0 }}>
            {showExample ? "Hide example" : "Show example"}
          </button>
        </p>

        {showExample && (
          <pre
            style={{
              background: "var(--color-bg-alt)",
              padding: "12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {TEMPLATE_EXAMPLE}
          </pre>
        )}

        <div className="field">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setParsed(null);
            }}
            placeholder="Paste your questions here…"
            style={{ minHeight: "180px", fontFamily: "monospace", fontSize: "0.85rem" }}
          />
        </div>

        <button className="btn btn-secondary" onClick={handlePreview} disabled={!raw.trim()}>
          Preview
        </button>

        {errors.length > 0 && (
          <div className="stack" style={{ marginTop: "16px" }}>
            <p className="error-text" style={{ fontWeight: 700, marginBottom: "4px" }}>
              {errors.length} issue{errors.length > 1 ? "s" : ""} found:
            </p>
            {errors.map((e, i) => (
              <p key={i} className="error-text" style={{ margin: 0 }}>
                • {e}
              </p>
            ))}
          </div>
        )}

        {parsed && parsed.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ fontWeight: 700 }}>
              Ready to import {parsed.length} question{parsed.length > 1 ? "s" : ""}:
            </p>
            <div className="stack">
              {parsed.map((q, i) => (
                <div key={i} className="card card--tight">
                  <div className="row-between">
                    <strong>{q.prompt}</strong>
                    <span className="badge badge-neutral">
                      {q.type === "multiple_choice" ? "Multiple choice" : "Typed"}
                    </span>
                  </div>
                  <p className="hint" style={{ marginTop: "4px" }}>
                    {q.points} pts · {q.time_limit_seconds}s
                    {q.type === "multiple_choice" && q.choices
                      ? ` · correct: ${q.choices[q.correct_choice ?? 0]}`
                      : ` · accepted: ${q.accepted_answers?.join(", ")}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: "20px", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!parsed || parsed.length === 0 || importing}
            onClick={handleConfirm}
          >
            {importing ? <span className="spinner" /> : `Import ${parsed?.length ?? ""} question(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
