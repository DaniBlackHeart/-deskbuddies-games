import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// The Buddybook is private to its owner. The buddybook Edge Function works out
// what has been earned and returns only the caller's own book; this hook only asks
// and displays.

export type Stamp = { key: string; name: string; earned: boolean; earned_on: string | null; line: string | null };
export type BuddyEntry = { key: string; owned: boolean; name: string | null; line: string | null; hint: string | null };
export type QuestMark = { key: string; name: string; theme: string; done_on: string };
export type KeepsakeEntry = { key: string; name: string; category: string; tier: "bronze" | "silver" | "gold" };

export type BuddybookData = {
  counts: { stamps: number; quests: number; buddies: number; keepsakes: number };
  firsts: Stamp[];
  quests: QuestMark[];
  buddies: BuddyEntry[];
  keepsakes: KeepsakeEntry[];
};

export function useBuddybook() {
  const [data, setData] = useState<BuddybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data: d, error: e } = await supabase.functions.invoke("buddybook", { body: { action: "status" } });
      if (e) throw e;
      if (!alive.current) return;
      setData(d as BuddybookData);
      setError(null);
      notifyProgressChanged(); // a newly recorded stamp may have paid out
    } catch (err) {
      console.error("Buddybook failed:", err);
      if (alive.current && !quiet) setError("Couldn't open your Buddybook. Check your connection and try again.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const again = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", again);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", again);
    };
  }, [load]);

  return { data, loading, error, reload: () => load() };
}
