import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// The member's own notifications. Reading goes through row-level security (own rows only);
// marking read goes through the notifications Edge Function. The unread count always comes
// from the server, never from the list on screen.

export type NotifKind = "sticky" | "earned" | "reminder" | "social" | "news";
export interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
  read_at: string | null;
}

export function useUnreadCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
        if (error) throw error;
        if (live) setN(count ?? 0);
      } catch {
        if (live) setN(0); // unknown: show no badge
      }
    })();
    return () => { live = false; };
  }, []);
  return n;
}

export function useNotifications() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setItems(null);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,kind,title,body,href,created_at,read_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems((data ?? []) as Notif[]);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    setItems((cur) => cur && cur.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)));
    try {
      await supabase.functions.invoke("notifications", { body: { action: "mark_read", id } });
    } catch {
      /* the next load shows the real state */
    }
  }, []);

  const markAll = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("notifications", { body: { action: "mark_all_read" } });
      if (error || (data as { status?: string })?.status !== "ok") throw error ?? new Error("failed");
      const now = new Date().toISOString();
      setItems((cur) => cur && cur.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { items, failed, reload: load, markRead, markAll };
}
