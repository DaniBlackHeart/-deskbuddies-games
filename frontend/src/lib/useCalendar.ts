import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Buddy Calendar. The server (calendar Edge Function) fetches Discord's scheduled events
// once for everyone, decides what phase an event is in, checks the host's code and the
// check-in window, and pays official check-ins. This hook only asks and displays.
// Host codes arrive only for Mods and the event's own host.

export type Category = "coworking" | "reading" | "games" | "career";
export type Phase = "upcoming" | "live" | "after" | "closed" | "cancelled";
export type CalEvent = {
  id: string;
  series_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  category: Category | null;
  kind: "official" | "member";
  host: string | null;
  phase: Phase;
  window_ends_at: string;
  checked_in: boolean;
  locked: boolean;
  code_set: boolean;
  host_code: string | null;
  discord_url: string | null;
};
export type PendingSeries = { series_id: string; title: string; starts_at: string | null; host: string | null; recurring: boolean };
export type CalendarData = {
  now: string;
  month: string; // YYYY-MM
  earliest_month: string;
  latest_month: string;
  events: CalEvent[];
  has_any_events: boolean;
  birthdays: { configured: boolean; names: string[]; people: { name: string; id: string | null }[] };
  sync: { last_synced_at: string | null; failed: boolean };
  checkin_reward: { xp: number; deskbits: number } | null;
  is_mod: boolean;
  pending: PendingSeries[];
  discord_server_url: string | null;
  result: { action: string; status: string } | null;
};

type Action = "status" | "checkin" | "refresh" | "moderate" | "set_code";

export function useCalendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const inFlight = useRef(false);
  const month = useRef<string | undefined>(undefined);

  const call = useCallback(async (action: Action, extra: Record<string, unknown> = {}) => {
    const { data: d, error: e } = await supabase.functions.invoke("calendar", {
      body: { action, month: month.current, ...extra },
    });
    if (e) throw e;
    return d as CalendarData;
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const d = await call("status");
        if (!alive.current) return;
        setData(d);
        month.current = d.month;
        setError(null);
      } catch (err) {
        console.error("Calendar failed:", err);
        if (alive.current && !quiet) setError("Couldn't load the calendar. Check your connection and try again.");
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    [call],
  );

  useEffect(() => {
    alive.current = true;
    void load();
    const again = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [load]);

  /** Show another month (YYYY-MM). The server clamps it to what can be browsed. */
  const goMonth = useCallback(
    async (m: string) => {
      month.current = m;
      await load(true);
    },
    [load],
  );

  /** One request at a time. Returns the result status, or null if it did not go through. */
  const act = useCallback(
    async (action: Exclude<Action, "status">, extra: Record<string, unknown> = {}) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setBusy(true);
      try {
        const d = await call(action, extra);
        if (!alive.current) return null;
        setData(d);
        if (action === "checkin" && (d.result?.status === "ok" || d.result?.status === "already")) notifyProgressChanged();
        return d.result?.status ?? "ok";
      } catch (err) {
        console.error("Calendar action failed:", err);
        return null;
      } finally {
        inFlight.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [call],
  );

  return { data, loading, error, busy, act, goMonth, reload: () => load() };
}
