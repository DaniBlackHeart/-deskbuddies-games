import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Beyond the Desk: Daily Detours, Weekly Wins and Keepsakes. The server
// (beyond-the-desk Edge Function) picks today's detours, counts goal and
// Keepsake progress from stored rows and pays what has a rule. This hook only
// asks and displays. It never reports a count, a date or an amount.

export type Reward = { xp: number; deskbits: number } | null;

export type DetourItem = { key: string; slot: "move" | "make" | "play"; text: string; done: boolean };
export type WeekDay = { date: string; checked_in: boolean; detours_done: number };
export type Goal = { key: string; name: string; text: string; unit: string; target: number; progress: number; done: boolean };
export type KeepStep = { tier: "bronze" | "silver" | "gold"; threshold: number; earned: boolean; reward: Reward };
export type KeepCard = {
  key: string;
  name: string;
  counts: string;
  value: number;
  target: number;
  all_earned: boolean;
  steps: KeepStep[];
};

export type BeyondData = {
  today: string;
  earning_on: boolean;
  week: { start: string; end: string; days: WeekDay[] };
  detours: { reward: Reward; done_count: number; items: DetourItem[] };
  weekly: {
    visible: boolean;
    full_week_goals: number;
    done_count: number;
    reward: Reward;
    goals: Goal[];
    last_week: { start: string; end: string; goals: Goal[] } | null;
  };
  keepsakes: { category: string; cards: KeepCard[] }[];
  just_earned: { goals: string[]; steps: { card: string; tier: string }[] };
  result: { status: string; xp: number; deskbits: number } | null;
};

async function call(body: Record<string, unknown>): Promise<BeyondData> {
  const { data, error } = await supabase.functions.invoke("beyond-the-desk", { body });
  if (error) throw error;
  return data as BeyondData;
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // Manila has no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000;

function earnedLines(d: BeyondData): string[] {
  const lines: string[] = [];
  for (const g of d.just_earned.goals) lines.push(`Weekly Win done: ${g}.`);
  for (const s of d.just_earned.steps) lines.push(`New Keepsake step: ${s.card}, ${s.tier}.`);
  return lines;
}

function rewardText(r: { xp: number; deskbits: number }): string {
  const parts: string[] = [];
  if (r.xp > 0) parts.push(`${r.xp} Buddy XP`);
  if (r.deskbits > 0) parts.push(`${r.deskbits} ${r.deskbits === 1 ? "deskbit" : "deskbits"}`);
  return parts.join(" and ");
}

export function useBeyondTheDesk() {
  const [data, setData] = useState<BeyondData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const d = await call({ action: "status" });
      if (!alive.current) return;
      setData(d);
      setError(null);
      const lines = earnedLines(d);
      if (lines.length > 0) {
        setNotice(lines.join(" "));
        notifyProgressChanged();
      }
    } catch (err) {
      console.error("Beyond the Desk failed:", err);
      if (alive.current && !quiet) setError("Couldn't load Beyond the Desk. Check your connection and try again.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  // Coming back to the tab, or the Manila day rolling over while the page is
  // open, asks the server again. The server decides what "today" is.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    const untilMidnight = DAY_MS - ((Date.now() + MANILA_OFFSET_MS) % DAY_MS) + 1500;
    const timer = window.setTimeout(() => void load(true), Math.min(untilMidnight, 2 ** 31 - 1));
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
      window.clearTimeout(timer);
    };
  }, [load, data?.today]);

  const markDone = useCallback(
    async (key: string) => {
      if (busyKey) return;
      setBusyKey(key);
      setNotice("");
      try {
        const d = await call({ action: "detour_done", prompt_key: key });
        if (!alive.current) return;
        setData(d);
        setError(null);
        const lines: string[] = [];
        const r = d.result;
        if (r?.status === "granted") {
          const t = rewardText(r);
          lines.push(t ? `You earned ${t}.` : "Done.");
        } else if (r?.status === "capped") {
          lines.push("Done. You've reached today's earning limit, so this one doesn't add XP.");
        } else {
          lines.push("Done.");
        }
        lines.push(...earnedLines(d));
        setNotice(lines.join(" "));
        if (r?.status === "granted" || d.just_earned.steps.length > 0 || d.just_earned.goals.length > 0) notifyProgressChanged();
      } catch (err) {
        console.error("Detour failed:", err);
        setNotice("That didn't go through. Showing today's detours again.");
        void load(true);
      } finally {
        if (alive.current) setBusyKey(null);
      }
    },
    [busyKey, load],
  );

  return { data, loading, error, notice, busyKey, markDone, reload: () => load() };
}
