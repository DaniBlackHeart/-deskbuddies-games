import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { notifyProgressChanged } from "./useMemberProgress";

// Desk Finds, the deskbits shop. The server (desk-finds Edge Function) owns the
// catalog, the prices, the balance and every purchase. This hook only asks and
// displays; it never sends a price.

export type Category = "accessories" | "comfort" | "furniture" | "showpieces" | "wardrobe";
export type Tier = "small" | "cozy" | "statement" | "showpiece";

export type FindItem = {
  key: string;
  category: Category;
  name: string;
  tier: Tier;
  price: number;
  is_style: boolean;
  note: string | null;
  owned: boolean;
};

export type FindsData = {
  shop_open: boolean;
  balance: number;
  items: FindItem[];
  purchase: { status: string; price?: number; balance?: number } | null;
};

async function call(body: Record<string, unknown>): Promise<FindsData> {
  const { data, error } = await supabase.functions.invoke("desk-finds", { body });
  if (error) throw error;
  return data as FindsData;
}

export function useDeskFinds() {
  const [data, setData] = useState<FindsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [buying, setBuying] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const d = await call({ action: "status" });
      if (!alive.current) return;
      setData(d);
      setError(null);
    } catch (err) {
      console.error("Desk Finds failed:", err);
      if (alive.current && !quiet) setError("Couldn't load Desk Finds. Check your connection and try again.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

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

  const buy = useCallback(
    async (item: FindItem) => {
      if (buying) return; // one click, one purchase
      setBuying(true);
      setNotice("");
      try {
        const d = await call({ action: "buy", item_key: item.key });
        if (!alive.current) return;
        setData(d);
        const p = d.purchase;
        if (p?.status === "purchased") {
          setNotice(`${item.name} is yours. It cost ${p.price} deskbits.`);
          notifyProgressChanged();
        } else if (p?.status === "already_owned") {
          setNotice(`You already have ${item.name}.`);
        } else if (p?.status === "insufficient") {
          setNotice(`${item.name} costs ${p.price} deskbits and you have ${p.balance}. Nothing was spent.`);
        } else if (p?.status === "shop_closed") {
          setNotice("The shop is paused right now. Nothing was spent.");
        } else {
          setNotice("That item isn't in the shop any more. Nothing was spent.");
        }
      } catch (err) {
        console.error("Purchase failed:", err);
        setNotice("That didn't go through, and nothing was spent. Showing the shop again.");
        void load(true);
      } finally {
        if (alive.current) setBuying(false);
      }
    },
    [buying, load],
  );

  return { data, loading, error, notice, setNotice, buying, buy, reload: () => load() };
}
