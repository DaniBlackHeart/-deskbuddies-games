import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Buddy Boards, first version: the Overall board (Buddy XP earned in a calendar month,
// Philippine time). The buddy-boards Edge Function ranks it on the server and returns only
// member-visible fields. "Show me on Buddy Boards" is saved through the member-settings function.

export type BoardPeriod = "this" | "last";

export type BoardRow = {
  rank: number;
  name: string;
  avatar_url: string | null;
  value: number;
  is_you: boolean;
};

export type OverallBoard = {
  period: BoardPeriod;
  month_start: string; // YYYY-MM-DD, first day of the month shown
  hidden: boolean; // the signed-in member turned boards off for themselves
  rows: BoardRow[]; // up to ten places
  you: { rank: number; value: number } | null; // set only when you are ranked below the ten shown
};

export type TabBoardRow = { rank: number; name: string; avatar_url: string | null; value: number; value2: number | null; is_you: boolean };
export type TabBoard = {
  board: string;
  hidden: boolean;
  rows: TabBoardRow[];
  you: { rank: number; value: number; value2: number | null } | null;
  tag: string | null; // Number Nook: today's level
};
export type Overview = {
  hidden: boolean;
  places: { board: string; rank: number }[];
  stats: { focus_blocks: number; check_ins: number; quests: number; stickies: number; events: number };
};

// The boards of one non-Overall tab (brain / habits / community), ranked on the server.
export function useTabBoards(tab: "brain" | "habits" | "community" | null, period: BoardPeriod) {
  const [boards, setBoards] = useState<TabBoard[] | null>(null);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!tab) return;
    const mine = ++seq.current;
    setBoards(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("buddy-boards", { body: { action: "boards", tab, period } });
      if (err) throw err;
      if (mine !== seq.current) return;
      setBoards((data as { boards: TabBoard[] }).boards);
      setError(false);
    } catch (e) {
      console.error("Buddy Boards tab failed:", e);
      if (mine === seq.current) setError(true);
    }
  }, [tab, period]);
  useEffect(() => {
    void load();
  }, [load]);
  return { boards, error, reload: load };
}

// "Your places" (all boards but Overall) and "The month so far".
export function useOverview(period: BoardPeriod, refreshKey: unknown) {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    supabase.functions
      .invoke("buddy-boards", { body: { action: "overview", period } })
      .then(({ data: d, error: err }) => {
        if (live && !err) setData(d as Overview);
      })
      .catch((e) => console.error("Buddy Boards overview failed:", e));
    return () => {
      live = false;
    };
  }, [period, refreshKey]);
  return data;
}

export function useBuddyBoards() {
  const [period, setPeriod] = useState<BoardPeriod>("this");
  const [board, setBoard] = useState<OverallBoard | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (p: BoardPeriod) => {
    const mine = ++seq.current;
    try {
      const { data, error: err } = await supabase.functions.invoke("buddy-boards", { body: { action: "overall", period: p } });
      if (err) throw err;
      if (mine !== seq.current) return; // a newer request replaced this one
      setBoard(data as OverallBoard);
      setError(false);
    } catch (e) {
      console.error("Buddy Boards failed:", e);
      if (mine === seq.current) setError(true);
    }
  }, []);

  useEffect(() => {
    setBoard(null);
    void load(period);
  }, [period, load]);

  // value = true means "show me on the boards".
  const setVisible = useCallback(
    async (value: boolean): Promise<boolean> => {
      setSaving(true);
      try {
        const { error: err } = await supabase.functions.invoke("member-settings", { body: { action: "set", key: "show_on_boards", value } });
        if (err) throw err;
        await load(period);
        return true;
      } catch (e) {
        console.error("Board visibility failed:", e);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [load, period],
  );

  return { period, setPeriod, board, error, saving, setVisible, reload: () => load(period) };
}
