import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Home's "Who's around": the people in a Focus Block right now, and Find a
// member. The whos-around Edge Function does the lookups and returns only
// member-visible fields (a name, a Discord avatar, "about N min left").

export type AroundPerson = {
  id: string;
  name: string;
  avatar_url: string | null;
  focus_minutes_left: number | null;
  here_today?: boolean;
};

type Reply = { people: AroundPerson[]; too_short?: boolean };

async function call(body: Record<string, unknown>): Promise<Reply> {
  const { data, error } = await supabase.functions.invoke("whos-around", { body });
  if (error) throw error;
  return data as Reply;
}

const REFRESH_MS = 60_000;
const DEBOUNCE_MS = 300;
export const MIN_QUERY = 2;

export function useWhosAround() {
  // Who's around: null = still loading; "error" = couldn't load (not "nobody").
  const [around, setAround] = useState<AroundPerson[] | null>(null);
  const [aroundError, setAroundError] = useState(false);

  const loadAround = useCallback(async () => {
    try {
      const r = await call({ action: "around" });
      setAround(r.people);
      setAroundError(false);
    } catch (err) {
      console.error("Who's around failed:", err);
      setAroundError(true);
    }
  }, []);

  useEffect(() => {
    void loadAround();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAround();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadAround]);

  // Find a member.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AroundPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const mine = ++seq.current;
    if (q.length < MIN_QUERY) {
      setResults(null);
      setSearching(false);
      setSearchError(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await call({ action: "search", q });
        if (mine !== seq.current) return; // a newer search replaced this one
        setResults(r.people);
        setSearchError(false);
      } catch (err) {
        console.error("Member search failed:", err);
        if (mine !== seq.current) return;
        setSearchError(true);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  return { around, aroundError, query, setQuery, results, searching, searchError };
}
