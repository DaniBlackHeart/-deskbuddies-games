import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Side Quests: a weekly wheel and an archive. The server (side-quests Edge Function)
// draws the quest, stores it and checks every step. This hook only asks and displays.
// The browser never sends which quest to deal or whether one is done, only which one
// to mark done, and the server checks that it is allowed.

export type Reward = { xp: number; deskbits: number } | null;
export type Quest = { key: string; name: string; theme: string; what: string; easier: string; social: "solo" | "either" | "people" };
export type SideQuestData = {
  week_start: string;
  stage: "unspun" | "result" | "locked" | "done" | "none_left";
  quest: Quest | null;
  can_respin: boolean;
  spin_reward: Reward;
  done_reward: Reward;
  archive: Quest[];
  stamps: number;
  result: { action: string; status: string } | null;
};

type Action = "status" | "spin" | "respin" | "lock" | "done";

export function useSideQuests() {
  const [data, setData] = useState<SideQuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const inFlight = useRef(false);

  const call = useCallback(async (action: Action, extra: Record<string, unknown> = {}) => {
    const { data: d, error: e } = await supabase.functions.invoke("side-quests", { body: { action, ...extra } });
    if (e) throw e;
    return d as SideQuestData;
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const d = await call("status");
        if (!alive.current) return;
        setData(d);
        setError(null);
      } catch (err) {
        console.error("Side Quests failed:", err);
        if (alive.current && !quiet) setError("Couldn't load Side Quests. Check your connection and try again.");
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    [call],
  );

  useEffect(() => {
    alive.current = true;
    void load();
    const again = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [load]);

  /** One request at a time, so a double tap cannot send two. Returns the new data. */
  const act = useCallback(
    async (action: Exclude<Action, "status">, extra: Record<string, unknown> = {}) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setBusy(true);
      setNotice("");
      try {
        const d = await call(action, extra);
        if (!alive.current) return null;
        setData(d);
        if (action === "spin" || action === "done") notifyProgressChanged();
        if (action === "done") {
          const s = d.result?.status;
          if (s === "done_in_week") setNotice("Done. That's a stamp for your Buddybook.");
          else if (s === "done_archive") setNotice("Done. That's a stamp for your Buddybook.");
          else if (s === "already") setNotice("That one is already done.");
          else setNotice("That quest isn't available. Showing your quests again.");
        }
        if (action === "spin" && d.result?.status === "none_left") setNotice("You've done them all. New quests are coming.");
        return d;
      } catch (err) {
        console.error("Side Quests action failed:", err);
        setNotice("That didn't go through. Showing your quests again.");
        void load(true);
        return null;
      } finally {
        inFlight.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [call, load],
  );

  return { data, loading, error, busy, notice, setNotice, act, reload: () => load() };
}
