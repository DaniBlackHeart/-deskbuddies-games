import { useEffect, useState } from "react";
import { sounds } from "../lib/sounds";

type TimerProps = {
  deadline: number; // epoch ms
  onExpire?: () => void;
};

export default function Timer({ deadline, onExpire }: TimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => deadline - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = deadline - Date.now();
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
    if (seconds > 0 && seconds <= 5) {
      sounds.tick();
    }
  }, [seconds]);

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
