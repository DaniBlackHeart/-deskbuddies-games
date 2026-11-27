import { useCallback, useEffect, useRef, useState } from "react";
import { invokeFunction } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Daily Sudoku ("Number Nook") state. The server owns the grid, the checking, the clock and the reward.
// This hook only asks and displays. The grid arrives after Start; the solution only once the attempt is
// over. The page counts up locally from the server's "elapsed" figure and re-asks when the tab comes
// back, so a refresh costs nothing. Pencil notes live on the page only and are not saved.

export type SudokuStatus = "no_puzzle" | "not_started" | "in_progress" | "solved" | "unsolved";
export type SudokuReward = { xp: number; deskbits: number; statuses: string[] } | null;

export type SudokuState = {
  sudoku_date: string;
  status: SudokuStatus;
  max_mistakes: number;
  difficulty?: string;
  puzzle?: string;
  board?: string;
  mistakes?: number;
  elapsed_ms?: number;
  end_reason?: "mistakes" | "gave_up" | null;
  solution?: string;
  solve_ms?: number | null;
  reward?: SudokuReward;
};

export type PlaceOutcome = "ok" | "wrong" | "given" | "filled" | "invalid" | "closed" | "finished" | "not_started" | "error";

type Reply = Partial<SudokuState> & { result?: string };

export function useDailySudoku() {
  const [state, setState] = useState<SudokuState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const apply = useCallback((s: SudokuState) => {
    setState(s);
    setStartedAt(s.status === "in_progress" && s.elapsed_ms != null ? Date.now() - s.elapsed_ms : null);
    if (s.reward && s.reward.xp + s.reward.deskbits > 0) notifyProgressChanged();
  }, []);

  const load = useCallback(async () => {
    const { data, error: err } = await invokeFunction<SudokuState>("daily-sudoku", { action: "status" });
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
    async (body: Record<string, unknown>): Promise<PlaceOutcome> => {
      if (!state || busyRef.current) return "error";
      busyRef.current = true;
      setBusy(true);
      try {
        const { data, error: err } = await invokeFunction<Reply>("daily-sudoku", { sudoku_date: state.sudoku_date, ...body });
        if (err || !data) {
          setError(err ?? "Something went wrong. Try again.");
          return "error";
        }
        setError(null);
        if (data.result === "closed") {
          await load(); // the day rolled over
          return "closed";
        }
        if (data.status) apply(data as SudokuState);
        else if (data.result === "wrong" && typeof data.mistakes === "number") {
          const m = data.mistakes;
          setState((s) => (s ? { ...s, mistakes: m } : s));
        }
        return (data.result ?? "ok") as PlaceOutcome;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [state, load, apply]
  );

  const start = useCallback(() => call({ action: "start" }), [call]);
  const place = useCallback((cell: number, digit: number) => call({ action: "place", cell, digit }), [call]);
  const giveUp = useCallback(() => call({ action: "give_up" }), [call]);

  return { state, error, busy, startedAt, start, place, giveUp, reload: load };
}
