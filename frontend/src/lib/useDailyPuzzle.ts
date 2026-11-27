import { useCallback, useEffect, useRef, useState } from "react";
import { invokeFunction } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Daily Puzzle state. The server owns everything: the word, the day, the marks and
// the reward. This hook only asks and displays. The answer is only ever present once
// the attempt is over.

export type Mark = "c" | "p" | "a";
export type GuessRow = { guess: string; marks: string };
export type PuzzleReward = { xp: number; deskbits: number; statuses: string[] } | null;

export type PuzzleState = {
  puzzle_date: string;
  status: "not_started" | "in_progress" | "solved" | "unsolved";
  guess_count: number;
  max_guesses: number;
  guesses: GuessRow[];
  answer?: string | null;
  reward?: PuzzleReward;
};

export type GuessOutcome = "ok" | "not_a_word" | "invalid" | "closed" | "finished" | "error";

export function useDailyPuzzle() {
  const [state, setState] = useState<PuzzleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const { data, error: err } = await invokeFunction<PuzzleState>("daily-puzzle", { action: "status" });
    if (err || !data) {
      setError(err ?? "Could not load today's puzzle.");
      return;
    }
    setError(null);
    setState(data);
    if (data.reward && data.reward.xp + data.reward.deskbits > 0) notifyProgressChanged();
  }, []);

  useEffect(() => {
    void load();
    // A tab left open overnight, or a sleeping laptop: ask again when it comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const submit = useCallback(
    async (guess: string): Promise<GuessOutcome> => {
      if (!state || busyRef.current) return "error";
      busyRef.current = true;
      setBusy(true);
      try {
        const { data, error: err } = await invokeFunction<{
          result: string;
          marks?: string;
          status?: PuzzleState["status"];
          guess_count?: number;
          answer?: string | null;
          reward?: PuzzleReward;
        }>("daily-puzzle", { action: "guess", puzzle_date: state.puzzle_date, guess });
        if (err || !data) {
          setError(err ?? "Could not send that guess. Try again.");
          return "error";
        }
        setError(null);
        if (data.result === "ok" && data.marks && data.status) {
          const row = { guess: guess.toLowerCase(), marks: data.marks };
          setState((s) =>
            s && {
              ...s,
              status: data.status!,
              guess_count: data.guess_count ?? s.guess_count + 1,
              guesses: [...s.guesses, row],
              answer: data.answer ?? null,
              reward: data.reward ?? null,
            }
          );
          if (data.reward && data.reward.xp + data.reward.deskbits > 0) notifyProgressChanged();
          return "ok";
        }
        if (data.result === "closed" || data.result === "finished") {
          await load(); // the day rolled over, or the attempt is already over: show the truth
        }
        return data.result as GuessOutcome;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [state, load]
  );

  return { state, error, busy, submit, reload: load };
}
