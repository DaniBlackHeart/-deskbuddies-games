import { useState } from "react";
import { sounds } from "../lib/sounds";

type BuzzerProps = {
  onBuzz: () => Promise<void> | void;
  disabled?: boolean;
  label?: string;
};

/**
 * Big tappable buzzer. Works identically on desktop (mouse click) and
 * mobile (touch) since it's a plain <button> — no pointer/hover-only
 * events, no keyboard-only shortcuts. Locks itself immediately on tap so
 * a slow network round-trip can't result in a double-press.
 */
export default function Buzzer({ onBuzz, disabled, label = "BUZZ IN" }: BuzzerProps) {
  const [pressed, setPressed] = useState(false);

  async function handlePress() {
    if (disabled || pressed) return;
    setPressed(true);
    sounds.buzzer(); // play immediately — don't wait on the network round-trip
    await onBuzz();
  }

  return (
    <button
      type="button"
      className="buzzer-btn"
      disabled={disabled || pressed}
      onClick={handlePress}
      aria-label="Buzz in"
    >
      {pressed ? "…" : label}
    </button>
  );
}
