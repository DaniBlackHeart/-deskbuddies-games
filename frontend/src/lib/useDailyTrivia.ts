import { useCallback, useEffect, useRef, useState } from "react";
import { invokeFunction } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Daily Trivia state. The server owns the question, the clock, the grading and the reward.
// This hook only asks and displays. The question arrives after Start; the right answer only
// once the attempt is over. Between asks the page counts down locally from the server's
// "seconds left" and re-asks when the tab comes back, so a refresh costs nothing.

export type TriviaStatus = "no_question" | "not_started" | "in_progress" | "correct" | "incorrect" | "timed_out";
export type TriviaReward = { xp: number; deskbits: number; statuses: string[] } | null;

export type TriviaState = {
  trivia_date: string;
  status: TriviaStatus;
  time_limit_seconds: number;
  type?: "multiple_choice" | "typed";
  category?: string | null;
  prompt?: string;
  choices?: string[] | null;
  seconds_left?: number;
  correct_answer?: string | null;
  your_choice?: number | null;
  your_answer?: string | null;
  reward?: TriviaReward;
};

type Reply = Partial<TriviaState> & { result?: string };

export function useDailyTrivia() {
  const [state, setState] = useState<TriviaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // When the server said the clock would run out, by this device's clock.
  const [deadline, setDeadline] = useState<number | null>(null);

  const apply = useCallback((s: TriviaState) => {
    setState(s);
    setDeadline(s.status === "in_progress" && s.seconds_left != null ? Date.now() + s.seconds_left * 1000 : null);
    if (s.reward && s.reward.xp + s.reward.deskbits > 0) notifyProgressChanged();
  }, []);

  const load = useCallback(async () => {
    const { data, error: err } = await invokeFunction<TriviaState>("daily-trivia", { action: "status" });
    if (err || !data) {
      setError(err ?? "Could not load today's question.");
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
    async (body: Record<string, unknown>): Promise<string> => {
      if (!state || busyRef.current) return "error";
      busyRef.current = true;
      setBusy(true);
      try {
        const { data, error: err } = await invokeFunction<Reply>("daily-trivia", { trivia_date: state.trivia_date, ...body });
        if (err || !data) {
          setError(err ?? "Something went wrong. Try again.");
          return "error";
        }
        setError(null);
        if (data.result === "closed") {
          await load(); // the day rolled over: show today's question
          return "closed";
        }
        if (data.status) apply(data as TriviaState);
        return data.result ?? "ok";
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [state, load, apply]
  );

  const start = useCallback(() => call({ action: "start" }), [call]);
  const answerChoice = useCallback((i: number) => call({ action: "answer", choice_index: i }), [call]);
  const answerText = useCallback((t: string) => call({ action: "answer", answer_text: t }), [call]);

  return { state, error, busy, deadline, start, answerChoice, answerText, reload: load };
}
