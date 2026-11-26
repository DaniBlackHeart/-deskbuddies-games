import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// "What's live right now", from ONE database call (the live_games() function,
// migration 0043) instead of six table checks plus six realtime listeners per
// open page. It refreshes on a gentle timer and when the tab regains focus, so
// 100 members sitting on Reality Break cost ~5 small reads a second, not 100
// live subscriptions.

export type LiveGameRow = {
  game: string;
  session_id: string;
  status: string;
  host_username: string | null;
  player_count: number;
  created_at: string;
  my_role: "host" | "player" | null;
  i_am_spectating: boolean;
};

const REFRESH_MS = 20_000;

export function useLiveGames() {
  const [games, setGames] = useState<LiveGameRow[] | undefined>(undefined); // undefined = loading

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("live_games");
    if (error) {
      console.error("live_games failed", error);
      setGames((prev) => prev ?? []);
      return;
    }
    setGames((data as LiveGameRow[]) ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { games, refresh };
}
