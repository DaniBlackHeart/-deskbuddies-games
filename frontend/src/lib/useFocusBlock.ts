import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";
import type { ActivityId } from "./focusBlock";

// Desk Time's Focus Block. The server owns the clock (focus-block Edge
// Function): it stores when the block started and how long it was on hold, and
// decides when it is finished. This hook only asks and displays. Between asks it
// counts down locally from the server's "time left", and it re-asks when the tab
// comes back, so a refresh, a sleeping laptop or a second tab cost nothing.

export type ActiveBlock = {
  id: string;
  activity: string;
  minutes: number;
  goal: string | null;
  held: boolean;
  remaining_ms: number;
};

export type BlockResult = {
  outcome: "completed" | "stopped_early";
  minutes: number;
  activity: string;
  reward: { status: string; xp: number; deskbits: number } | null;
};

type Reply = {
  block: ActiveBlock | null;
  finished_today: number;
  result: BlockResult | null;
  not_finished: boolean;
};

export type HistoryRow = {
  id: string;
  activity: string;
  minutes: number;
  goal: string | null;
  ended_at: string | null;
};

type Action = "status" | "start" | "hold" | "resume" | "finish" | "stop";

async function call(action: Action, extra: Record<string, unknown> = {}): Promise<Reply> {
  const { data, error } = await supabase.functions.invoke("focus-block", { body: { action, ...extra } });
  if (error) throw error;
  return data as Reply;
}

export function useFocusBlock() {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [loading, setLoading] = useState(true);
  const [block, setBlock] = useState<ActiveBlock | null>(null);
  const [finishedToday, setFinishedToday] = useState(0);
  const [result, setResult] = useState<BlockResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // The server's "time left" at the moment it answered, and when that was here.
  const sync = useRef<{ at: number; remaining: number } | null>(null);
  const finishing = useRef(false);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    // Own rows only (RLS). The goal is private to its owner.
    const { data, error: err } = await supabase
      .from("focus_blocks")
      .select("id, activity, minutes, goal, ended_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(8);
    if (err) {
      console.error("Couldn't load focus history:", err);
      return;
    }
    setHistory((data ?? []) as HistoryRow[]);
  }, [userId]);

  const apply = useCallback(
    (r: Reply) => {
      setBlock(r.block);
      setFinishedToday(r.finished_today);
      if (r.block) {
        sync.current = { at: performance.now(), remaining: r.block.remaining_ms };
        setRemainingMs(r.block.remaining_ms);
      } else {
        sync.current = null;
        setRemainingMs(0);
      }
      if (r.result) {
        setResult(r.result);
        void loadHistory();
        if (r.result.outcome === "completed") notifyProgressChanged(); // may have paid out
      }
    },
    [loadHistory],
  );

  const run = useCallback(
    async (action: Action, extra?: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const r = await call(action, extra);
        apply(r);
        return r;
      } catch (err) {
        console.error("Focus Block failed:", err);
        setError("Something went wrong with your Focus Block. Please try again.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  // First load.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    call("status")
      .then((r) => {
        if (!cancelled) apply(r);
      })
      .catch((err) => {
        console.error("Focus Block status failed:", err);
        if (!cancelled) setError("Couldn't load your Focus Block. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [userId, apply, loadHistory]);

  // Count down locally between server answers; ask the server to finish at zero.
  const running = !!block && !block.held;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const s = sync.current;
      if (!s) return;
      const left = Math.max(0, s.remaining - (performance.now() - s.at));
      setRemainingMs(left);
      if (left <= 0 && !finishing.current) {
        finishing.current = true;
        // The server decides. If its clock says there is a moment left, wait and ask again.
        call("finish")
          .then((r) => {
            apply(r);
            if (r.not_finished && r.block) window.setTimeout(() => (finishing.current = false), 1500);
            else finishing.current = false;
          })
          .catch((err) => {
            console.error("Focus Block finish failed:", err);
            window.setTimeout(() => (finishing.current = false), 3000);
          });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, apply]);

  // Coming back to the tab: take the server's word for how much time is left.
  useEffect(() => {
    if (!userId) return;
    function resync() {
      if (document.visibilityState === "visible") {
        call("status").then(apply).catch((err) => console.error("Focus Block resync failed:", err));
      }
    }
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [userId, apply]);

  return {
    loading,
    block,
    remainingMs,
    finishedToday,
    result,
    history,
    busy,
    error,
    start: (minutes: number, activity: ActivityId, goal: string) => {
      setResult(null);
      return run("start", { minutes, activity, goal });
    },
    hold: () => run("hold"),
    resume: () => run("resume"),
    stop: () => run("stop"),
    dismissResult: () => setResult(null),
  };
}
