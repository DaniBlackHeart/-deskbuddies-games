import { useState } from "react";
import {
  parsePhraseListInput,
  parseWheelCategoryImportInput,
  PHRASE_LIST_EXAMPLE,
  WHEEL_CATEGORY_IMPORT_EXAMPLE,
  type ParsedWheelCategory,
} from "../utils/wheelParser";

type PhrasesModalProps = {
  mode: "phrases";
  onCancel: () => void;
  onConfirm: (phrases: string[]) => Promise<void>;
};

type CategoriesModalProps = {
  mode: "categories";
  onCancel: () => void;
  onConfirm: (categories: ParsedWheelCategory[]) => Promise<void>;
};

type WheelImportModalProps = PhrasesModalProps | CategoriesModalProps;

// Same "paste, preview, confirm" shape as ImpostorImportModal/
// QuestionImportModal, just with an even simpler preview — a phrase has
// no clue/answer-key field riding along with it, so there's nothing to
// show per-item besides the phrase itself.
export default function WheelImportModal(props: WheelImportModalProps) {
  const { mode, onCancel } = props;
  const [raw, setRaw] = useState("");
  const [parsedPhrases, setParsedPhrases] = useState<string[] | null>(null);
  const [parsedCategories, setParsedCategories] = useState<ParsedWheelCategory[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  function handlePreview() {
    if (mode === "phrases") {
      const result = parsePhraseListInput(raw);
      setParsedPhrases(result.phrases);
      setErrors(result.errors);
    } else {
      const result = parseWheelCategoryImportInput(raw);
      setParsedCategories(result.categories);
      setErrors(result.errors);
    }
  }

  async function handleConfirm() {
    setImporting(true);
    try {
      if (mode === "phrases" && parsedPhrases && parsedPhrases.length > 0) {
        await props.onConfirm(parsedPhrases);
      } else if (mode === "categories" && parsedCategories && parsedCategories.length > 0) {
        await props.onConfirm(parsedCategories);
      }
    } finally {
      setImporting(false);
    }
  }

  const readyCount = mode === "phrases" ? parsedPhrases?.length ?? 0 : parsedCategories?.length ?? 0;
  const hasReady = readyCount > 0;

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
        <h2>{mode === "phrases" ? "Import phrases" : "Import categories"}</h2>
        <p className="text-muted">
          {mode === "phrases"
            ? "Paste a JSON array of phrases, or one phrase per line."
            : "Paste a JSON array of categories, or use the simple text template."}{" "}
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
            {mode === "phrases" ? PHRASE_LIST_EXAMPLE : WHEEL_CATEGORY_IMPORT_EXAMPLE}
          </pre>
        )}

        <div className="field">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setParsedPhrases(null);
              setParsedCategories(null);
            }}
            placeholder={mode === "phrases" ? "Paste your phrases here…" : "Paste your categories here…"}
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

        {mode === "phrases" && parsedPhrases && parsedPhrases.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ fontWeight: 700 }}>
              Ready to import {parsedPhrases.length} phrase{parsedPhrases.length > 1 ? "s" : ""}:
            </p>
            <div className="stack">
              {parsedPhrases.map((p, i) => (
                <div key={i} style={{ fontSize: "0.9rem" }}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "categories" && parsedCategories && parsedCategories.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ fontWeight: 700 }}>
              Ready to import {parsedCategories.length} categor{parsedCategories.length > 1 ? "ies" : "y"}:
            </p>
            <div className="stack">
              {parsedCategories.map((c, i) => (
                <div key={i} className="card card--tight">
                  <strong>{c.name}</strong>
                  {c.description && (
                    <p className="hint" style={{ margin: "2px 0" }}>
                      {c.description}
                    </p>
                  )}
                  <div className="stack" style={{ marginTop: "6px" }}>
                    {c.phrases.map((p, pi) => (
                      <div key={pi} style={{ fontSize: "0.85rem" }}>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: "20px", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!hasReady || importing} onClick={handleConfirm}>
            {importing ? <span className="spinner" /> : `Import ${hasReady ? readyCount : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
