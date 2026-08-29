import { useEffect, useState } from "react";
import { sounds } from "../lib/sounds";
import { correctedNow } from "../lib/clockSync";

type TimerProps = {
  deadline: number; // epoch ms
  onExpire?: () => void;
  // For a deadline that exists purely as a hang-recovery safety net (e.g.
  // the untimed "spin / buy a vowel / solve" decision) rather than actual
  // tension-timer pressure — the countdown/onExpire logic below still runs
  // exactly the same either way, this just skips the visible ⏱ display
  // and the urgent-zone tick sound, so it doesn't read as a clock the
  // player needs to race.
  hidden?: boolean;
};

export default function Timer({ deadline, onExpire, hidden }: TimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => deadline - correctedNow());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = deadline - correctedNow();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const isUrgent = seconds <= 5;

  // Fires once per second as `seconds` ticks down through the urgent zone
  // (not once per 200ms poll — `seconds` only changes on whole-second
  // boundaries, so this naturally lands one tick per second).
  useEffect(() => {
    if (!hidden && seconds > 0 && seconds <= 5) {
      sounds.tick();
    }
  }, [seconds, hidden]);

  if (hidden) return null;

  return (
    <div
      className="row"
      style={{
        justifyContent: "center",
        gap: "8px",
        color: isUrgent ? "var(--color-danger)" : "var(--color-text)",
        fontWeight: 800,
        fontSize: "1.5rem",
      }}
    >
      ⏱ {seconds}s
    </div>
  );
}
