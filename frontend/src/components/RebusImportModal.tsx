import { useState } from "react";
import {
  parseRebusPuzzleInput,
  REBUS_TEMPLATE_EXAMPLE,
  REBUS_JSON_MULTILINE_EXAMPLE,
  REBUS_PUZZLE_TYPE_LABELS,
  REBUS_DIFFICULTY_LABELS,
  REBUS_DIFFICULTY_ORDER,
  type ParsedRebusPuzzle,
} from "../utils/rebusPuzzleParser";
import type { RebusPuzzleType, RebusRound } from "../types";

const REBUS_TYPE_ORDER: RebusPuzzleType[] = [
  "phonetic",
  "split",
  "numbers_letters",
  "visual",
  "missing_letters",
  "repeated",
  "homophone",
];

type RebusImportModalProps = {
  onCancel: () => void;
  onConfirm: (puzzles: ParsedRebusPuzzle[]) => Promise<void>;
};

export default function RebusImportModal({ onCancel, onConfirm }: RebusImportModalProps) {
  // Sets no longer have per-round authoring tabs (2026-08-29), so this
  // batch's difficulty is picked right here instead of being inferred
  // from whichever tab the modal was opened from.
  const [round, setRound] = useState<RebusRound>("warmup");
  // "auto" = guess each puzzle's type from its own text (detectPuzzleType);
  // any real type forces every puzzle in this batch to that type unless it
  // says its own "Type:"/"puzzle_type" — the escape hatch for a batch
  // that's almost entirely one style, like a whole visual-arrangement set,
  // where tagging every line individually would be its own chore.
  const [batchType, setBatchType] = useState<RebusPuzzleType | "auto">("auto");
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedRebusPuzzle[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  function handlePreview() {
    const result = parseRebusPuzzleInput(raw, round, batchType === "auto" ? undefined : batchType);
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

        <div className="field">
          <label>Difficulty for this whole batch</label>
          <select
            value={round}
            onChange={(e) => {
              setRound(e.target.value as RebusRound);
              setParsed(null); // points/time defaults depend on the round — force a re-preview
            }}
          >
            {REBUS_DIFFICULTY_ORDER.map((r) => (
              <option key={r} value={r}>
                {REBUS_DIFFICULTY_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Type for this whole batch</label>
          <select
            value={batchType}
            onChange={(e) => {
              setBatchType(e.target.value as RebusPuzzleType | "auto");
              setParsed(null);
            }}
          >
            <option value="auto">Auto-detect per puzzle (default)</option>
            {REBUS_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {REBUS_PUZZLE_TYPE_LABELS[t]} — force every puzzle below to this
              </option>
            ))}
          </select>
          <p className="hint" style={{ marginTop: "4px" }}>
            Pasting a whole set of one style (all Visual arrangement, say)? Pick it here instead of tagging every
            puzzle — a puzzle with its own "Type:" line still overrides this.
          </p>
        </div>

        <p className="text-muted">
          Paste a JSON array, or use the simple text template. Every puzzle in this batch gets the difficulty picked
          above — no need to say it per puzzle. A new "Display:" line always starts a new puzzle, so it's fine to
          paste with or without blank lines between them. Want a Visual or Split puzzle with a line break in it? Just
          put the extra line(s) right under "Display:" — no JSON needed for that. Puzzle type isn't required either —
          it's guessed from each puzzle's own text (a line break → Visual arrangement, numbers → Numbers & letters,
          an underscore → Missing letters, a repeated word → Repeated words, and so on) — but you can say it
          explicitly with a "Type:" line if you want to be sure, especially for Split (which looks identical to
          Visual once pasted, so it's always guessed as Visual unless you say otherwise). The preview below always
          shows the resolved type so you can catch a wrong guess before importing — there's no way to change a
          puzzle's type after it's in (add it manually instead if you need to fix one).{" "}
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
              {REBUS_TEMPLATE_EXAMPLE}
            </pre>
            <p className="hint">
              JSON still works too, and is handy for a very large machine-generated batch — display_text just carries
              "\n" directly instead of a real line break, and "puzzle_type" is the same optional override as "Type:"
              above:
            </p>
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
              {REBUS_JSON_MULTILINE_EXAMPLE}
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
                  <div className="row-between">
                    <strong style={{ whiteSpace: "pre-line" }}>{p.display_text}</strong>
                    <span className="badge badge-neutral">{REBUS_PUZZLE_TYPE_LABELS[p.puzzle_type]}</span>
                  </div>
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
