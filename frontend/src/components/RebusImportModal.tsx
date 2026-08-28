import { useState } from "react";
import { parseRebusPuzzleInput, REBUS_TEMPLATE_EXAMPLE, type ParsedRebusPuzzle } from "../utils/rebusPuzzleParser";
import type { RebusRound } from "../types";

const ROUND_LABELS: Record<string, string> = {
  warmup: "Round 1 · Warm-Up",
  round2: "Round 2",
  round3: "Round 3",
  final: "Final Round",
};

type RebusImportModalProps = {
  round: RebusRound;
  onCancel: () => void;
  onConfirm: (puzzles: ParsedRebusPuzzle[]) => Promise<void>;
};

export default function RebusImportModal({ round, onCancel, onConfirm }: RebusImportModalProps) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedRebusPuzzle[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  function handlePreview() {
    const result = parseRebusPuzzleInput(raw, round);
    setParsed(result.puzzles);
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
        <h2>Import puzzles</h2>
        <p className="text-muted">
          Importing into <strong>{ROUND_LABELS[round] ?? round}</strong> — paste a JSON array, or use the simple text
          template. No need to say the round or puzzle type per puzzle: every puzzle in this batch goes into this
          round, tagged as Phonetic (add it manually instead if you need a different type).{" "}
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
            {REBUS_TEMPLATE_EXAMPLE}
          </pre>
        )}

        <div className="field">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setParsed(null);
            }}
            placeholder="Paste your puzzles here…"
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
              Ready to import {parsed.length} puzzle{parsed.length > 1 ? "s" : ""}:
            </p>
            <div className="stack">
              {parsed.map((p, i) => (
                <div key={i} className="card card--tight">
                  <strong>{p.display_text}</strong>
                  <p className="hint" style={{ marginTop: "4px" }}>
                    {p.points} pts · {p.time_limit_seconds}s · answer: {p.answer_text}
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
            {importing ? <span className="spinner" /> : `Import ${parsed?.length ?? ""} puzzle(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
