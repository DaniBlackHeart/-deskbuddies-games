// member-avatar
// Saves the signed-in member's avatar. { action: "save", parts: { skin, build, ... } }
// The avatar is stored as part ids, never images or text. The member comes from the verified
// session. The server checks that every slot is present, every id exists, and every part is
// either a starter part or one the member owns (a member_items row "avatar:<slot>:<id>"). If any
// part is not theirs, nothing is saved. The browser never says what a member owns.
// Reading is done by the browser through row-level security (any signed-in member may read an
// avatar; 0041). Trying on a part you do not own is a preview only and never reaches this function.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";
import { AVATAR_SLOTS, ALL_PARTS, OPEN_PARTS } from "../_shared/avatarCatalog.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "save") return jsonResponse({ error: "unknown action" }, 400);
    const parts = body.parts;
    if (!parts || typeof parts !== "object" || Array.isArray(parts)) return jsonResponse({ error: "bad avatar" }, 400);
    const keys = Object.keys(parts);
    if (keys.length !== AVATAR_SLOTS.length || keys.some((k) => !(AVATAR_SLOTS as readonly string[]).includes(k))) {
      return jsonResponse({ error: "bad avatar" }, 400);
    }

    const clean: Record<string, string> = {};
    for (const slot of AVATAR_SLOTS) {
      const id = parts[slot];
      if (typeof id !== "string" || !ALL_PARTS[slot].includes(id)) return jsonResponse({ error: "bad avatar" }, 400);
      clean[slot] = id;
    }

    const admin = getAdminClient();
    const closed = AVATAR_SLOTS.filter((s) => !OPEN_PARTS[s].includes(clean[s]));
    if (closed.length > 0) {
      const { data, error } = await admin
        .from("member_items")
        .select("item_key")
        .eq("user_id", user.id)
        .in("item_key", closed.map((s) => `avatar:${s}:${clean[s]}`));
      if (error) throw error;
      const have = new Set((data ?? []).map((r: { item_key: string }) => r.item_key));
      const missing = closed.filter((s) => !have.has(`avatar:${s}:${clean[s]}`));
      if (missing.length > 0) return jsonResponse({ error: "Some parts are not yours yet.", not_owned: missing }, 409);
    }

    const { error } = await admin
      .from("member_avatars")
      .upsert({ user_id: user.id, parts: clean, updated_at: new Date().toISOString() });
    if (error) throw error;
    return jsonResponse({ status: "ok", parts: clean });
  } catch {
    console.error("member-avatar failed");
    return jsonResponse({ error: "Something went wrong." }, 500);
  }
});
