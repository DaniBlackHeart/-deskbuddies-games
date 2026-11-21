import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "./supabaseClient";

// What the header's deskbits / Buddy Level / Buddy XP chips show.
//
// Buddy XP and deskbits are read from the member's own `member_progress` row.
// The server owns that row (only the reward functions write it) and RLS lets a
// member read only their own, so the browser just displays it.
//
// Level is not derived yet: there is no `level_thresholds` table, and the level
// curve is undecided. Until it exists the header shows Level 1 with an empty
// bar. When thresholds exist, compute level and levelProgress here and nothing
// in the header needs to change.

export type MemberProgress = {
  level: number;
  xp: number;
  deskbits: number;
  /** 0 to 1: how far through the current level. */
  levelProgress: number;
};

const EMPTY: MemberProgress = { level: 1, xp: 0, deskbits: 0, levelProgress: 0 };

/** Fired by anything that may have just earned rewards (e.g. a check-in), so the header refreshes. */
export const PROGRESS_CHANGED_EVENT = "debbie:progress-changed";

export function notifyProgressChanged() {
  window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT));
}

export function useMemberProgress(): MemberProgress {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [progress, setProgress] = useState<MemberProgress>(EMPTY);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("member_progress")
      .select("xp_total, deskbits_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Couldn't load progress:", error);
      return; // keep what's showing rather than flashing zeros
    }
    // No row yet just means nothing has been earned.
    setProgress({ ...EMPTY, xp: data?.xp_total ?? 0, deskbits: data?.deskbits_balance ?? 0 });
  }, [userId]);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener(PROGRESS_CHANGED_EVENT, load);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED_EVENT, load);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return progress;
}
