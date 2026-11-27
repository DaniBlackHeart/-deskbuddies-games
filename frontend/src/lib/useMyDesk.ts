import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "./supabaseClient";
import { DEFAULT_LAYOUT, SLOTS, ITEMS, BUDDIES, cleanDecor, type Layout } from "./deskCatalog";

// Loads the member's saved desk layout and which items they own.
// Both tables are read-only from the browser (RLS: own rows only). Saving goes
// through the desk-save Edge Function, which re-checks ownership on the server.

function cleanLayout(raw: unknown): Layout {
  const out: Layout = { ...DEFAULT_LAYOUT, companions: [], decor: cleanDecor(null) };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const s of SLOTS) {
    const v = r[s];
    if (typeof v === "string" && ITEMS[s].some((i) => i.id === v)) out[s] = v;
  }
  if (Array.isArray(r.companions)) {
    out.companions = r.companions.filter((c): c is string => typeof c === "string" && BUDDIES.some((b) => b.id === c));
  }
  out.decor = cleanDecor(r.decor);
  return out;
}

export function useMyDesk() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [saved, setSaved] = useState<Layout>(DEFAULT_LAYOUT);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [lay, items] = await Promise.all([
        supabase.from("desk_layouts").select("layout").eq("user_id", userId).maybeSingle(),
        supabase.from("member_items").select("item_key").eq("user_id", userId),
      ]);
      if (cancelled) return;
      if (lay.error || items.error) {
        console.error("Couldn't load desk:", lay.error ?? items.error);
        setLoadError(true);
      } else {
        setSaved(cleanLayout(lay.data?.layout));
        setOwned(new Set((items.data ?? []).map((r: { item_key: string }) => r.item_key)));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Owned = open to everyone, or a row in member_items. The server re-checks on save. */
  const isOwned = useCallback(
    (slot: string, id: string) => {
      if (slot === "companions") return owned.has(`companion:${id}`);
      const item = ITEMS[slot as keyof typeof ITEMS]?.find((i) => i.id === id);
      return !!item && (item.open || owned.has(`${slot}:${id}`));
    },
    [owned],
  );

  /** A Desk Finds item the member bought (member_items "find:<key>"). The server re-checks on save. */
  const ownsFind = useCallback((key: string) => owned.has(`find:${key}`), [owned]);

  const save = useCallback(async (layout: Layout): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { data, error } = await supabase.functions.invoke("desk-save", { body: { layout } });
    if (error) {
      let message = "Couldn't save your desk. Please try again.";
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep the generic message */
      }
      return { ok: false, message };
    }
    setSaved(cleanLayout((data as { layout?: unknown })?.layout ?? layout));
    return { ok: true };
  }, []);

  return { saved, loading, loadError, isOwned, ownsFind, save };
}
