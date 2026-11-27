import { useCallback, useEffect, useRef, useState } from "react";
import { invokeFunction } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Daily Anagram ("Letter Shuffle") state. The server owns the word, the clock, the grading and the
// reward. This hook only asks and displays. The scramble arrives after Start; the answer only once the
// attempt is over. Between asks the page counts down locally from the server's "seconds left" and
// re-asks when the tab comes back, so a refresh costs nothing.

export type AnagramStatus = "no_word" | "not_started" | "in_progress" | "solved" | "unsolved";
export type AnagramReward = { xp: number; deskbits: number; statuses: string[] } | null;

export type AnagramState = {
  difficulty?: string;
  anagram_date: string;
  status: AnagramStatus;
  time_limit_seconds: number;
  letter_count?: number;
  scrambled?: string;
  seconds_left?: number;
  guess_count?: number;
  answer?: string | null;
  solve_ms?: number | null;
  reward?: AnagramReward;
};

export type GuessOutcome = "ok" | "wrong" | "wrong_letters" | "closed" | "finished" | "not_started" | "error";

type Reply = Partial<AnagramState> & { result?: string };

export function useDailyAnagram() {
  const [state, setState] = useState<AnagramState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [deadline, setDeadline] = useState<number | null>(null);

  const apply = useCallback((s: AnagramState) => {
    setState((prev) => ({ ...s, difficulty: s.difficulty ?? (prev?.anagram_date === s.anagram_date ? prev?.difficulty : undefined) }));
    setDeadline(s.status === "in_progress" && s.seconds_left != null ? Date.now() + s.seconds_left * 1000 : null);
    if (s.reward && s.reward.xp + s.reward.deskbits > 0) notifyProgressChanged();
  }, []);

  const load = useCallback(async () => {
    const { data, error: err } = await invokeFunction<AnagramState>("daily-anagram", { action: "status" });
    if (err || !data) {
      setError(err ?? "Could not load today's word.");
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
    async (body: Record<string, unknown>): Promise<GuessOutcome> => {
      if (!state || busyRef.current) return "error";
      busyRef.current = true;
      setBusy(true);
      try {
        const { data, error: err } = await invokeFunction<Reply>("daily-anagram", { anagram_date: state.anagram_date, ...body });
        if (err || !data) {
          setError(err ?? "Something went wrong. Try again.");
          return "error";
        }
        setError(null);
        if (data.result === "closed") {
          await load(); // the day rolled over
          return "closed";
        }
        if (data.status) apply(data as AnagramState);
        return (data.result ?? "ok") as GuessOutcome;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [state, load, apply]
  );

  const start = useCallback(() => call({ action: "start" }), [call]);
  const guess = useCallback((g: string) => call({ action: "guess", guess: g }), [call]);

  return { state, error, busy, deadline, start, guess, reload: load };
}
