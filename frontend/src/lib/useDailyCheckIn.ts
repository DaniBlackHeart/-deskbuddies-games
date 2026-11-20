import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Daily check-in state, shared by Home's greeting (streak chip, welcome-back
// line) and the Pull Up a Chair panel. The server decides what "today" is
// (Asia/Manila) and works out the streak; the browser only displays it.

export type CheckInStatus = {
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

export function useDailyCheckIn() {
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

  const claim = useCallback(async () => {
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
  }, []);

  return { status, busy, error, claim };
}
