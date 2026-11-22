import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";
import type { CheckInStatus } from "./useDailyCheckIn";

// Everything the Pull Up a Chair page shows. The server decides what "today" is (Asia/Manila),
// works out the streak, the days checked in, today's reward and the milestones; the browser
// only displays them. A repeat tap or a second tab cannot pay twice (the server keys the reward
// by day).

export interface Milestone {
  tier: string;
  days: number;
  xp: number;
  deskbits: number;
  reached: boolean;
}

export type CheckInOverview = CheckInStatus & {
  /** Days checked in over roughly the last ten weeks, as YYYY-MM-DD, oldest first. */
  dates: string[];
  /** What today's check-in paid, or null when nothing was paid (including when earning is off). */
  today_reward: { xp: number; deskbits: number } | null;
  milestones: Milestone[];
};

async function call(action: "overview" | "claim"): Promise<CheckInOverview | null> {
  const { data, error } = await supabase.functions.invoke("daily-checkin", { body: { action } });
  if (error) throw error;
  return action === "overview" ? (data as CheckInOverview) : null;
}

export function usePullUpAChair() {
  const [overview, setOverview] = useState<CheckInOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setOverview(await call("overview"));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const claim = useCallback(async () => {
    setBusy(true);
    setClaimError(false);
    try {
      await call("claim");
      await load();
      notifyProgressChanged(); // the check-in may have paid out; refresh the header chips
    } catch {
      setClaimError(true);
    } finally {
      setBusy(false);
    }
  }, [load]);

  return { overview, failed, busy, claimError, claim, reload: load };
}
