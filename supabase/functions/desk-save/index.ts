// desk-save
// Saves a member's My Desk layout: { layout: { surface, monitor, ..., companions: [] } }
//
// The browser only says what it WANTS on the desk. This function decides what
// is allowed: every id must exist, and every item must be one the member owns
// (open to everyone, or a row in member_items). If anything is not allowed the
// whole save is refused and nothing changes. Placing items never costs
// deskbits, Buddy XP or access.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";
import { SLOTS, ALL_ITEMS, OPEN_ITEMS, BUDDIES, MAX_COMPANIONS } from "../_shared/deskCatalog.ts";

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
