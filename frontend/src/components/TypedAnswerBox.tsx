import { useState } from "react";

type TypedAnswerBoxProps = {
  onSubmit: (text: string) => void;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || locked) return;
    setLocked(true);
    onSubmit(trimmed);
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
        disabled={disabled}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: "var(--radius-sm)",
          border: "1.5px solid var(--color-border)",
          fontSize: "1rem",
        }}
      />
      <button type="submit" className="btn btn-primary" disabled={disabled || locked || !value.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
