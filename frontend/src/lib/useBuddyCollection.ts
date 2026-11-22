import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// The Buddy Collection is private to its owner. The buddybook Edge Function says which buddies the
// member has and when they were found; this hook only asks and displays.

export type CollectionBuddy = {
  key: string;
  found: boolean;
  limited: boolean;
  name: string | null;
  line: string | null;
  hint: string | null;
  found_at: string | null;
};

export function useBuddyCollection() {
  const [buddies, setBuddies] = useState<CollectionBuddy[] | null>(null);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke("buddybook", { body: { action: "collection" } });
      if (error) throw error;
      if (alive.current) setBuddies((data as { buddies: CollectionBuddy[] }).buddies);
    } catch (err) {
      console.error("Buddy Collection failed:", err);
      if (alive.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  return { buddies, failed, reload: load };
}
