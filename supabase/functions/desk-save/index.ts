// desk-save
// Saves a member's My Desk layout: { layout: { surface, monitor, ..., companions: [] } }
//
// The browser only says what it WANTS on the desk. This function decides what
// is allowed: every id must exist, and every item must be one the member owns
// (open to everyone, or a row in member_items). If anything is not allowed the
// whole save is refused and nothing changes. Placing items never costs
// deskbits, Buddy XP or access.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";
import { SLOTS, ALL_ITEMS, OPEN_ITEMS, BUDDIES, MAX_COMPANIONS, DECOR_SLOTS, DECOR_ITEMS, WARDROBE_BUDDIES, WARDROBE_ITEMS } from "../_shared/deskCatalog.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const input = body?.layout;
    if (!input || typeof input !== "object") {
      return jsonResponse({ error: "layout is required" }, 400);
    }

    const admin = getAdminClient();
    const { data: rows, error: itemsErr } = await admin
      .from("member_items")
      .select("item_key")
      .eq("user_id", user.id);
    if (itemsErr) throw itemsErr;
    const owned = new Set((rows ?? []).map((r: { item_key: string }) => r.item_key));

    const clean: Record<string, unknown> = {};
    for (const slot of SLOTS) {
      const id = input[slot];
      if (typeof id !== "string" || !ALL_ITEMS[slot].includes(id)) {
        return jsonResponse({ error: `Unknown item for ${slot}` }, 400);
      }
      if (!OPEN_ITEMS[slot].includes(id) && !owned.has(`${slot}:${id}`)) {
        return jsonResponse({ error: `You don't have that ${slot} item yet`, slot }, 403);
      }
      clean[slot] = id;
    }

    const comps = input.companions;
    if (!Array.isArray(comps) || comps.some((c: unknown) => typeof c !== "string")) {
      return jsonResponse({ error: "companions must be a list" }, 400);
    }
    const uniqueComps = [...new Set(comps as string[])];
    if (uniqueComps.length > MAX_COMPANIONS) {
      return jsonResponse({ error: `At most ${MAX_COMPANIONS} buddies fit on your desk for now` }, 400);
    }
    for (const c of uniqueComps) {
      if (!BUDDIES.includes(c)) return jsonResponse({ error: "Unknown buddy" }, 400);
      if (!owned.has(`companion:${c}`)) {
        return jsonResponse({ error: "That buddy hasn't been found yet", slot: "companion" }, 403);
      }
    }
    clean.companions = uniqueComps;

    // Desk Finds items on the desk. A save that does not mention "decor" (an older page) keeps
    // what is already placed. Otherwise every item must exist, be owned ("find:<key>") and be
    // placed at most once. An item the member owns stays placeable even if the shop retires it.
    const decor: Record<string, string> = {};
    if (input.decor === undefined) {
      const { data: cur, error: curErr } = await admin.from("desk_layouts").select("layout").eq("user_id", user.id).maybeSingle();
      if (curErr) throw curErr;
      const old = (cur?.layout as { decor?: Record<string, unknown> } | null)?.decor ?? {};
      for (const d of DECOR_SLOTS) {
        const v = old[d];
        decor[d] = typeof v === "string" && DECOR_ITEMS.includes(v) ? v : "";
      }
    } else {
      if (!input.decor || typeof input.decor !== "object" || Array.isArray(input.decor)) {
        return jsonResponse({ error: "decor must be an object" }, 400);
      }
      const used = new Set<string>();
      for (const key of Object.keys(input.decor)) {
        if (!(DECOR_SLOTS as readonly string[]).includes(key)) return jsonResponse({ error: "Unknown desk spot" }, 400);
      }
      for (const d of DECOR_SLOTS) {
        const v = input.decor[d];
        if (v === undefined || v === "") { decor[d] = ""; continue; }
        if (typeof v !== "string" || !DECOR_ITEMS.includes(v)) return jsonResponse({ error: "Unknown desk item" }, 400);
        if (!owned.has(`find:${v}`)) return jsonResponse({ error: "You don't have that item yet", slot: "decor" }, 403);
        if (used.has(v)) return jsonResponse({ error: "That item is already on your desk" }, 400);
        used.add(v);
        decor[d] = v;
      }
    }
    clean.decor = decor;

    // Wardrobe: { <buddy>: { <body slot>: <item key> } }. The buddy must be one that can wear things
    // and must be found; the item must be wearable in that slot, owned ("find:<key>"), and worn by one
    // buddy at a time. A save that does not mention "wardrobe" keeps what is already worn.
    const wardrobe: Record<string, Record<string, string>> = {};
    if (input.wardrobe === undefined) {
      const { data: cur2, error: curErr2 } = await admin.from("desk_layouts").select("layout").eq("user_id", user.id).maybeSingle();
      if (curErr2) throw curErr2;
      const old = ((cur2?.layout as { wardrobe?: Record<string, Record<string, unknown>> } | null)?.wardrobe ?? {});
      for (const b of WARDROBE_BUDDIES) {
        for (const [item, slotName] of Object.entries(WARDROBE_ITEMS)) {
          if (old[b]?.[slotName] === item) (wardrobe[b] ??= {})[slotName] = item;
        }
      }
    } else {
      if (!input.wardrobe || typeof input.wardrobe !== "object" || Array.isArray(input.wardrobe)) {
        return jsonResponse({ error: "wardrobe must be an object" }, 400);
      }
      const worn = new Set<string>();
      for (const [buddy, slots] of Object.entries(input.wardrobe as Record<string, unknown>)) {
        if (!WARDROBE_BUDDIES.includes(buddy)) return jsonResponse({ error: "That buddy can't wear things yet" }, 400);
        if (!slots || typeof slots !== "object" || Array.isArray(slots)) return jsonResponse({ error: "wardrobe must be an object" }, 400);
        for (const [slotName, item] of Object.entries(slots as Record<string, unknown>)) {
          if (item === "" || item === undefined) continue;
          if (typeof item !== "string" || WARDROBE_ITEMS[item] !== slotName) return jsonResponse({ error: "Unknown wardrobe item" }, 400);
          if (!owned.has(`find:${item}`)) return jsonResponse({ error: "You don't have that item yet", slot: "wardrobe" }, 403);
          if (!owned.has(`companion:${buddy}`)) return jsonResponse({ error: "That buddy hasn't been found yet", slot: "wardrobe" }, 403);
          if (worn.has(item)) return jsonResponse({ error: "That item is already being worn" }, 400);
          worn.add(item);
          (wardrobe[buddy] ??= {})[slotName] = item;
        }
      }
    }
    clean.wardrobe = wardrobe;

    const { error } = await admin
      .from("desk_layouts")
      .upsert({ user_id: user.id, layout: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;

    return jsonResponse({ layout: clean });
  } catch (err) {
    console.error("desk-save failed:", err);
    return jsonResponse({ error: "Could not save your desk" }, 500);
  }
});
