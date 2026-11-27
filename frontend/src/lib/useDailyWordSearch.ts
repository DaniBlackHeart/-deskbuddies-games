import { useCallback, useEffect, useRef, useState } from "react";
import { invokeFunction } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Daily Word Search ("Word Hunt") state. The server owns the grid, the word positions, the checking, the
// clock and the reward. This hook only asks and displays. The grid and word list arrive after Start; where
// the words are only once the attempt is over. Between asks the page counts down locally from the server's
// "seconds left" and re-asks when the tab comes back, so a refresh costs nothing.

export type SearchStatus = "no_puzzle" | "not_started" | "in_progress" | "solved" | "unsolved";
export type SearchReward = { xp: number; deskbits: number; statuses: string[] } | null;
export type FoundWord = { i: number; start: number; end: number };
export type Placement = { i: number; word: string; start: number; end: number; found: boolean };

export type SearchState = {
  difficulty?: string;
  search_date: string;
  status: SearchStatus;
  time_limit_seconds: number;
  grid?: string;
  words?: string[];
  found?: FoundWord[];
  seconds_left?: number;
  end_reason?: "time" | "gave_up" | null;
  found_count?: number;
  placements?: Placement[];
  solve_ms?: number | null;
  reward?: SearchReward;
};

export type FindOutcome = "found" | "miss" | "already" | "invalid" | "closed" | "finished" | "not_started" | "time_up" | "error";

type Reply = Partial<SearchState> & { result?: string };

export function useDailyWordSearch() {
  const [state, setState] = useState<SearchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [deadline, setDeadline] = useState<number | null>(null);

  const apply = useCallback((s: SearchState) => {
    setState((prev) => ({ ...s, difficulty: s.difficulty ?? (prev?.search_date === s.search_date ? prev?.difficulty : undefined) }));
    setDeadline(s.status === "in_progress" && s.seconds_left != null ? Date.now() + s.seconds_left * 1000 : null);
    if (s.reward && s.reward.xp + s.reward.deskbits > 0) notifyProgressChanged();
  }, []);

  const load = useCallback(async () => {
    const { data, error: err } = await invokeFunction<SearchState>("daily-word-search", { action: "status" });
    if (err || !data) {
      setError(err ?? "Could not load today's grid.");
      return;
    }
    setError(null);
    apply(data);
  }, [apply]);

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const call = useCallback(
    async (body: Record<string, unknown>): Promise<FindOutcome> => {
      if (!state || busyRef.current) return "error";
      busyRef.current = true;
      setBusy(true);
      try {
        const { data, error: err } = await invokeFunction<Reply>("daily-word-search", { search_date: state.search_date, ...body });
        if (err || !data) {
          setError(err ?? "Something went wrong. Try again.");
          return "error";
        }
        setError(null);
        if (data.result === "closed") {
          await load(); // the day rolled over
          return "closed";
        }
        if (data.status) apply(data as SearchState);
        return (data.result ?? "found") as FindOutcome;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [state, load, apply]
  );

  const start = useCallback(() => call({ action: "start" }), [call]);
  const find = useCallback((a: number, b: number) => call({ action: "find", start: a, end: b }), [call]);
  const giveUp = useCallback(() => call({ action: "give_up" }), [call]);

  return { state, error, busy, deadline, start, find, giveUp, reload: load };
}
