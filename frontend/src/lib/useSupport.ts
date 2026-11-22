import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Keep the Desk Lit reads two small tables (migration 0036). Row Level Security lets
// verified members read them; nobody can write them from the browser. Every figure here is
// set by the team in the database, and the page shows nothing that has not been set.

export type SupportState = "empty" | "early" | "funded" | "shortfall";
export type CostStatus = "not_yet" | "partly" | "covered";
export type SupportCost = {
  key: string;
  label: string;
  pays_for: string;
  status: CostStatus | null;
  covered_pct: number | null;
  covered_amount: number | null;
  total_amount: number | null;
};
export type SupportData = {
  status_state: SupportState | null;
  show_amounts: boolean;
  how_to_give: string | null;
  give_url: string | null;
  costs: SupportCost[];
};

export function useSupport() {
  const [data, setData] = useState<SupportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        supabase.from("support_settings").select("status_state,show_amounts,how_to_give,give_url").eq("id", true).maybeSingle(),
        supabase.from("support_costs").select("key,label,pays_for,status,covered_pct,covered_amount,total_amount").order("sort"),
      ]);
      if (s.error) throw s.error;
      if (c.error) throw c.error;
      if (!alive.current) return;
      setData({
        status_state: s.data?.status_state ?? null,
        show_amounts: !!s.data?.show_amounts,
        how_to_give: s.data?.how_to_give ?? null,
        give_url: s.data?.give_url ?? null,
        costs: (c.data ?? []) as SupportCost[],
      });
      setError(null);
    } catch (err) {
      console.error("Keep the Desk Lit failed:", err);
      if (alive.current) setError("Couldn't load this page. Check your connection and try again.");
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

  return { data, loading, error, reload: load };
}
