import { useState } from "react";
import {
  parseWordListInput,
  parseCategoryImportInput,
  WORD_LIST_EXAMPLE,
  CATEGORY_IMPORT_EXAMPLE,
  type ParsedCategory,
  type ParsedWord,
} from "../utils/impostorParser";

type WordsModalProps = {
  mode: "words";
  onCancel: () => void;
  onConfirm: (words: ParsedWord[]) => Promise<void>;
};

type CategoriesModalProps = {
  mode: "categories";
  onCancel: () => void;
  onConfirm: (categories: ParsedCategory[]) => Promise<void>;
};

type ImpostorImportModalProps = WordsModalProps | CategoriesModalProps;

// One modal handles both import contexts (words-only, into an already-open
// category; or whole categories+words in bulk from the categories list) —
// same "paste, preview, confirm" flow as QuestionImportModal, just with a
// simpler preview since there's no answer key/points/timing to show.
export default function ImpostorImportModal(props: ImpostorImportModalProps) {
  const { mode, onCancel } = props;
  const [raw, setRaw] = useState("");
  const [parsedWords, setParsedWords] = useState<ParsedWord[] | null>(null);
  const [parsedCategories, setParsedCategories] = useState<ParsedCategory[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  function handlePreview() {
    if (mode === "words") {
      const result = parseWordListInput(raw);
      setParsedWords(result.words);
      setErrors(result.errors);
    } else {
      const result = parseCategoryImportInput(raw);
      setParsedCategories(result.categories);
      setErrors(result.errors);
    }
  }

  async function handleConfirm() {
    setImporting(true);
    try {
      if (mode === "words" && parsedWords && parsedWords.length > 0) {
        await props.onConfirm(parsedWords);
      } else if (mode === "categories" && parsedCategories && parsedCategories.length > 0) {
        await props.onConfirm(parsedCategories);
      }
    } finally {
      setImporting(false);
    }
  }

  const readyCount = mode === "words" ? parsedWords?.length ?? 0 : parsedCategories?.length ?? 0;
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
        <h2>{mode === "words" ? "Import words" : "Import categories"}</h2>
        <p className="text-muted">
          {mode === "words"
            ? "Paste a JSON array of words, or one word per line. Add \" | a clue\" after a word to give the Impostor a hint about it — optional, but recommended."
            : "Paste a JSON array of categories, or use the simple text template. Add \" | a clue\" after a word for the Impostor's hint — optional."}{" "}
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
            {mode === "words" ? WORD_LIST_EXAMPLE : CATEGORY_IMPORT_EXAMPLE}
          </pre>
        )}

        <div className="field">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setParsedWords(null);
              setParsedCategories(null);
            }}
            placeholder={mode === "words" ? "Paste your words here…" : "Paste your categories here…"}
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

        {mode === "words" && parsedWords && parsedWords.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ fontWeight: 700 }}>
              Ready to import {parsedWords.length} word{parsedWords.length > 1 ? "s" : ""}:
            </p>
            <div className="stack">
              {parsedWords.map((w, i) => (
                <div key={i} className="row-between" style={{ fontSize: "0.9rem" }}>
                  <strong>{w.word}</strong>
                  <span className="text-muted" style={{ textAlign: "right", marginLeft: "12px" }}>
                    {w.clue ?? <em>no clue — will use the category name</em>}
                  </span>
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
                    {c.words.map((w, wi) => (
                      <div key={wi} className="row-between" style={{ fontSize: "0.85rem" }}>
                        <span>{w.word}</span>
                        <span className="hint" style={{ textAlign: "right", marginLeft: "12px" }}>
                          {w.clue ?? "no clue"}
                        </span>
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

