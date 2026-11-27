import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Desk Stickies. The desk-stickies Edge Function decides everything: who may leave a note,
// the weekly cap, what is on a board. This file only asks and displays. The browser never
// says who is sending or whether they checked in.

export type LeaveReason = "ok" | "self" | "off" | "not_checked_in" | "full" | "missing" | "not_member";
export type BoardSticky = { id: string; sender_name: string; body: string; created_at: string; mine: boolean };
export type Board = { cap: number; count: number; can_leave: LeaveReason; stickies: BoardSticky[] };
export type MySticky = { id: string; sender_name: string; body: string; created_at: string; is_new: boolean };
export type MyBoard = { cap: number; count: number; stickies: MySticky[] };

export const STICKY_MAX = 150;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("desk-stickies", { body });
  if (error) throw error;
  return data as T;
}

export function useStickyBoard(ownerId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await call<Board>({ action: "board", owner_id: ownerId }));
      setError(false);
    } catch (err) {
      console.error("Desk Stickies board failed:", err);
      setError(true);
    }
  }, [ownerId]);

  useEffect(() => {
    setBoard(null);
    void load();
  }, [load]);

  /** Returns the server's answer: "ok", or why it was refused. */
  const leave = useCallback(
    async (body: string): Promise<string> => {
      const r = await call<{ status: string }>({ action: "leave", owner_id: ownerId, body });
      await load();
      return r.status;
    },
    [ownerId, load],
  );

  const report = useCallback(
    async (id: string): Promise<string> => {
      const r = await call<{ status: string }>({ action: "report", id });
      return r.status;
    },
    [],
  );

  return { board, error, reload: load, leave, report };
}

export function useMyStickies() {
  const [data, setData] = useState<MyBoard | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await call<MyBoard>({ action: "mine" }));
      setError(false);
    } catch (err) {
      console.error("My Desk Stickies failed:", err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (action: "keep" | "trash", id: string): Promise<string> => {
      const r = await call<{ status: string }>({ action, id });
      await load();
      return r.status;
    },
    [load],
  );

  return { data, error, reload: load, keep: (id: string) => act("keep", id), trash: (id: string) => act("trash", id) };
}

export function stickyDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
