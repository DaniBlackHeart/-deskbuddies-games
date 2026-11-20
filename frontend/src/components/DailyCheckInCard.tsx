import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Home's daily check-in. The server decides what "today" is (Asia/Manila)
// and works out the streak; this card only displays it and asks to claim.
// Streak-only for now — no XP/currency until reward values are decided.

type CheckInStatus = {
  today: string;
  checked_in_today: boolean;
  current_streak: number;
  longest_streak: number;
  total_checkins: number;
};

async function callCheckIn(action: "status" | "claim"): Promise<CheckInStatus> {
  const { data, error } = await supabase.functions.invoke("daily-checkin", { body: { action } });
  if (error) throw error;
  return data as CheckInStatus;
}

export default function DailyCheckInCard() {
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    callCheckIn("status")
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        console.error("Check-in status failed:", err);
        if (!cancelled) setError("Couldn't load your check-in. Try refreshing.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await callCheckIn("claim"));
    } catch (err) {
      console.error("Check-in failed:", err);
      setError("Couldn't check you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const streak = status?.current_streak ?? 0;

  return (
    <div className="card" style={{ marginTop: "var(--space-4)" }}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Daily check-in</h2>
        {status?.checked_in_today && <span className="badge badge-neutral">Checked in</span>}
      </div>

      {!status && !error && <p className="text-muted">Loading…</p>}

      {status && (
        <>
          <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
            {status.checked_in_today
              ? "You're checked in for today. See you tomorrow!"
              : streak > 0
                ? "Check in today to keep your streak going."
                : "Check in to start a streak. Missing a day only resets the streak — nothing you've earned."}
          </p>
          <p style={{ margin: "0 0 var(--space-3)" }} aria-live="polite">
            <strong>{streak}</strong> day streak · best {status.longest_streak} · {status.total_checkins} total
          </p>
          {!status.checked_in_today && (
            <button className="btn btn-primary" onClick={claim} disabled={busy}>
              {busy ? "Checking in…" : "Check in"}
            </button>
          )}
        </>
      )}

      {error && (
        <p className="text-muted" role="alert" style={{ color: "var(--color-danger, inherit)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
