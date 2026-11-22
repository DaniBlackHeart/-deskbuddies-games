// desk-finds
// Debbie's deskbits shop. Actions:
//   { action: "status" }              -> the catalog, what the caller owns, their balance, shop on/off
//   { action: "buy", item_key }       -> buy one item
//
// The browser never sends a price. Prices live in shop_items and are charged by
// spend_deskbits(), which locks the member's balance, refuses a second purchase of
// the same item, and writes a negative-deskbits ledger row. Spending never
// changes XP, level or access. When the shop switch is off, buying is refused and
// everything else keeps working.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

async function buildStatus(admin: Admin, userId: string) {
  const settings = await must<{ shop_enabled: boolean }>(
    admin.from("earning_settings").select("shop_enabled").eq("id", true).single(),
  );
  const items = await must<
    { key: string; category: string; name: string; tier: string; price: number; is_style: boolean; note: string | null }[]
  >(admin.from("shop_items").select("key,category,name,tier,price,is_style,note").eq("is_active", true).order("sort"));
  const owned = await must<{ item_key: string }[]>(
    admin.from("member_items").select("item_key").eq("user_id", userId).like("item_key", "find:%"),
  );
  const progress = await must<{ deskbits_balance: number } | null>(
    admin.from("member_progress").select("deskbits_balance").eq("user_id", userId).maybeSingle(),
  );
  const have = new Set((owned ?? []).map((o) => o.item_key.slice("find:".length)));
  return {
    shop_open: settings.shop_enabled,
    balance: Number(progress?.deskbits_balance ?? 0),
    items: (items ?? []).map((i) => ({ ...i, owned: have.has(i.key) })),
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "status" && action !== "buy") {
      return jsonResponse({ error: "action must be 'status' or 'buy'" }, 400);
    }

    const admin = getAdminClient();
    let purchase: { status: string; price?: number; balance?: number } | null = null;

    if (action === "buy") {
      const key = typeof body?.item_key === "string" ? body.item_key : "";
      if (!key) return jsonResponse({ error: "item_key is required" }, 400);
      purchase = await must<{ status: string; price?: number; balance?: number }>(
        admin.rpc("spend_deskbits", { p_user_id: user.id, p_item_key: key }),
      );
    }

    const status = await buildStatus(admin, user.id);
    return jsonResponse({ ...status, purchase });
  } catch (err) {
    console.error("desk-finds failed:", err);
    return jsonResponse({ error: "Could not load Desk Finds" }, 500);
  }
});
