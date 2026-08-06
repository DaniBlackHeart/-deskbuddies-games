import { useState } from "react";
import type { PublicQuestion } from "../types";

type AnswerInputProps = {
  question: PublicQuestion;
  disabled: boolean;
  onSubmit: (payload: { choiceIndex?: number; answerText?: string }) => void;
  submittedChoice?: number;
  submittedText?: string;
};

export default function AnswerInput({
  question,
  disabled,
  onSubmit,
  submittedChoice,
  submittedText,
}: AnswerInputProps) {
  const [typedValue, setTypedValue] = useState("");
  const hasSubmitted = submittedChoice !== undefined || submittedText !== undefined;

  if (question.type === "multiple_choice" && question.choices) {
    const letters = ["A", "B", "C", "D", "E", "F"];
    return (
      <div className="stack">
        {question.choices.map((choice, index) => {
          const isSelected = submittedChoice === index;
          return (
            <button
              key={index}
              className="btn btn-secondary btn-block"
              style={{
                justifyContent: "flex-start",
                textAlign: "left",
                borderColor: isSelected ? "var(--color-primary)" : undefined,
                background: isSelected ? "var(--color-primary-soft)" : undefined,
              }}
              disabled={disabled || hasSubmitted}
              onClick={() => onSubmit({ choiceIndex: index })}
            >
              <strong style={{ marginRight: "10px" }}>{letters[index]}</strong>
              {choice}
            </button>
          );
        })}
      </div>
    );
  }

  // typed answer
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!typedValue.trim() || hasSubmitted) return;
        onSubmit({ answerText: typedValue.trim() });
      }}
    >
      <input
        type="text"
        placeholder="Type your answer…"
        value={hasSubmitted ? submittedText ?? "" : typedValue}
        onChange={(e) => setTypedValue(e.target.value)}
        disabled={disabled || hasSubmitted}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: "var(--radius-sm)",
          border: "1.5px solid var(--color-border)",
          fontSize: "1rem",
        }}
      />
      <button type="submit" className="btn btn-primary" disabled={disabled || hasSubmitted}>
        Submit
      </button>
    </form>
  );
}
