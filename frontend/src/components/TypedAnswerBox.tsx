import { useState } from "react";

type TypedAnswerBoxProps = {
  onSubmit: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
};

export default function TypedAnswerBox({
  onSubmit,
  disabled,
  placeholder = "Type your answer…",
  submitLabel = "Submit",
  autoFocus = true,
}: TypedAnswerBoxProps) {
  const [value, setValue] = useState("");
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || locked || submitting) return;
    setLocked(true);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      // Runs whether onSubmit resolved, rejected, or the request just hung
      // — previously `locked` only ever reset from the onChange handler,
      // so a submit that errored (or a network call that never came back)
      // left the box stuck disabled with no feedback until the player
      // reloaded the page. Found via a live playtest, 2026-08-28 — the
      // reveal timer kept counting down while their answer never actually
      // went through. On a genuinely successful submit the parent usually
      // swaps this component out anyway (e.g. RebusPlayPage renders
      // "Answer locked in!" once existingAnswer is set), so unlocking here
      // too is harmless.
      setSubmitting(false);
      setLocked(false);
    }
  }

  return (
    <form className="row" onSubmit={handleSubmit}>
      <input
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setLocked(false); // let them keep trying (e.g. after a "that's taken" response)
        }}
        disabled={disabled || submitting}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: "var(--radius-sm)",
          border: "1.5px solid var(--color-border)",
          fontSize: "1rem",
        }}
      />
      <button type="submit" className="btn btn-primary" disabled={disabled || locked || submitting || !value.trim()}>
        {submitting ? <span className="spinner" /> : submitLabel}
      </button>
    </form>
  );
}
