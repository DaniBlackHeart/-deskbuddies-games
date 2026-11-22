import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// The Desk Log. The server decides what each scope may contain (see the desk-log function and
// migration 0040); this hook only asks and keeps the answer. "around" never carries amounts;
// "mine" carries the member's own rewards.

export type DeskLogScope = "around" | "mine";
export type DeskLogKind = "check-in" | "focus" | "achievement" | "activity";

export interface DeskLogEntry {
  entry_key: string;
  kind: DeskLogKind;
  at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  line: string;
  xp: number | null;
  deskbits: number | null;
  visibility: "members" | "only_you" | null;
}

export function useDeskLog(scope: DeskLogScope) {
  const [entries, setEntries] = useState<DeskLogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setEntries(null);
    try {
      const { data, error } = await supabase.functions.invoke("desk-log", { body: { scope } });
      const res = data as { status?: string; entries?: DeskLogEntry[] } | null;
      if (error || res?.status !== "ok" || !Array.isArray(res.entries)) throw error ?? new Error("failed");
      setEntries(res.entries);
    } catch {
      setFailed(true);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  return { entries, failed, reload: load };
}
