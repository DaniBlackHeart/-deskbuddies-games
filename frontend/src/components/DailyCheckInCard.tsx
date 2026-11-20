import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PixelIcon from "./PixelIcon";

// Home's daily check-in ("Pull Up a Chair", button "i'm here!", per the
// Debbie Naming Guide). The server decides what "today" is (Asia/Manila) and
// works out the streak; this card only displays it and asks to claim.
// Streak-only for now — no Buddy XP/deskbits until reward values are decided.

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
  // Came back after a gap: the streak reset, but everything earned is kept.
  const returning = !!status && !status.checked_in_today && streak === 0 && status.total_checkins > 0;

  let message = "";
  if (status) {
    if (status.checked_in_today) message = "You're checked in for today. See you tomorrow!";
    else if (returning) message = "Your Seat's Still Here. A new streak starts when you check in.";
    else if (streak > 0) message = "Check in today to keep your streak going.";
    else message = "Pull up a chair and start a streak. Missing a day only resets the streak, never what you've earned.";
  }

  return (
    <div className="card" style={{ marginTop: "var(--space-4)" }}>
      <div className="row-between">
        <h2 className="t-h2" style={{ margin: 0 }}>
          Pull Up a Chair
        </h2>
        {status?.checked_in_today && <span className="badge badge-neutral">Checked in</span>}
      </div>

      {!status && !error && (
        <p className="text-muted t-body" style={{ marginTop: "var(--space-3)" }}>
          Loading…
        </p>
      )}

      {status && (
        <>
          <p className="text-muted t-body" style={{ margin: "var(--space-2) 0 var(--space-3)" }}>
            {message}
          </p>
          <div
            style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}
            aria-live="polite"
          >
            <PixelIcon name="buddy-streak" size={32} />
            <div>
              <div className="t-overline text-muted">Buddy Streak</div>
              <div>
                <span className="t-num-lg">{streak}</span>{" "}
                <span className="t-body-sm text-muted">
                  {streak === 1 ? "day" : "days"} · best {status.longest_streak} · {status.total_checkins} total
                </span>
              </div>
            </div>
          </div>
          {!status.checked_in_today && (
            <button className="btn btn-primary" onClick={claim} disabled={busy}>
              {busy ? "Checking in…" : "i'm here!"}
            </button>
          )}
        </>
      )}

      {error && (
        <p className="t-body-sm" role="alert" style={{ color: "var(--color-danger)", marginTop: "var(--space-3)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
