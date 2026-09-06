import { useState } from "react";
import {
  parseRebusSprintInput,
  REBUS_SPRINT_TEMPLATE_EXAMPLE,
  REBUS_SPRINT_JSON_EXAMPLE,
  type ParsedRebusSprintPuzzle,
} from "../utils/rebusPuzzleParser";

// Same modal shape as RebusImportModal (the main Puzzles import), just
// without a difficulty or puzzle-type dropdown — the Sprint pool has no
// round/type/points/time fields, so there's nothing there to pick. Added
// 2026-09-06 at Dani's request to match the main import's settings
// (JSON or a "Display:" template, blank lines optional, multi-line
// Display support, a Preview step before confirming) instead of the old
// single-line "DISPLAY :: ANSWER" paste box.
//
// `mode: "replace"` (added the same day, alongside bulk delete) reuses
// this exact Preview/parse flow for the Sprint pool's "bulk edit"
// equivalent: since Sprint puzzles have no round/type/points/time to set
// the same value across many rows the way the main Puzzles tab's bulk
// edit does, "bulk edit" here means "delete everything currently in the
// pool and paste in a fresh list" instead — same component, just
// relabeled with a destructive-action warning so it's never mistaken for
// a normal append.
type RebusSprintImportModalProps = {
  onCancel: () => void;
  onConfirm: (puzzles: ParsedRebusSprintPuzzle[]) => Promise<void>;
  mode?: "append" | "replace";
  existingCount?: number;
};

export default function RebusSprintImportModal({ onCancel, onConfirm, mode = "append", existingCount = 0 }: RebusSprintImportModalProps) {
  const isReplace = mode === "replace";
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedRebusSprintPuzzle[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);

  function handlePreview() {
    const result = parseRebusSprintInput(raw);
    setParsed(result.puzzles);
    setErrors(result.errors);
    setImportError(null);
  }

  async function handleConfirm() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      await onConfirm(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Something went wrong importing those puzzles. Please try again.");
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
        <h2>{isReplace ? "Replace all Sprint puzzles" : "Import Sprint puzzles"}</h2>

        {isReplace && (
          <p className="error-text" style={{ fontWeight: 700 }}>
            This deletes all {existingCount} existing Sprint puzzle{existingCount === 1 ? "" : "s"} in this set and
            replaces them with whatever you paste below. This can't be undone — make sure you have a copy of the
            current list somewhere if you might want it back.
          </p>
        )}

        <p className="text-muted">
          Paste a JSON array, or use the simple text template — same format as the main puzzle import, just without
          difficulty, type, points, or time (the Sprint pool doesn't have those). A new "Display:" line always starts
          a new puzzle, so it's fine to paste with or without blank lines between them.{" "}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExample((s) => !s)} style={{ padding: 0 }}>
            {showExample ? "Hide example" : "Show example"}
          </button>
        </p>

        {showExample && (
          <>
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
              {REBUS_SPRINT_TEMPLATE_EXAMPLE}
            </pre>
            <p className="hint">JSON still works too, and is handy for a large machine-generated batch:</p>
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
              {REBUS_SPRINT_JSON_EXAMPLE}
            </pre>
          </>
        )}

        <div className="field">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setParsed(null);
            }}
            placeholder="Paste your Sprint puzzles here…"
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
              {isReplace
                ? `Ready to replace ${existingCount} existing puzzle${existingCount === 1 ? "" : "s"} with these ${parsed.length}:`
                : `Ready to import ${parsed.length} puzzle${parsed.length > 1 ? "s" : ""}:`}
            </p>
            <div className="stack">
              {parsed.map((p, i) => (
                <div key={i} className="card card--tight">
                  <strong style={{ whiteSpace: "pre-line" }}>{p.display_text}</strong>
                  <p className="hint" style={{ marginTop: "4px" }}>
                    answer: {p.answer_text}
                    {p.accepted_answers.length > 1 && ` (also: ${p.accepted_answers.filter((a) => a !== p.answer_text).join(", ")})`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {importError && (
          <p className="error-text" style={{ marginTop: "16px" }}>
            {importError}
          </p>
        )}

        <div className="row" style={{ marginTop: "20px", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={isReplace ? "btn btn-danger" : "btn btn-primary"}
            disabled={!parsed || parsed.length === 0 || importing}
            onClick={handleConfirm}
          >
            {importing ? (
              <span className="spinner" />
            ) : isReplace ? (
              `Delete ${existingCount} & replace with ${parsed?.length ?? ""}`
            ) : (
              `Import ${parsed?.length ?? ""} puzzle(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
