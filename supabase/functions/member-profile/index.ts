// member-profile
// What another member sees when they open someone's profile (from Who's around, Find a member
// or a birthday name on the Buddy Calendar).
//   { id: "<member id>" } -> { id, name, avatar_url, is_mod, since, companions }
// Members only (requireMember). Visibility is decided HERE, on the server: only a name, the Discord
// avatar, the MOD badge, the month they joined Debbie and the buddies keeping their desk seat are
// sent. Never deskbits, XP, level, streak, stamps, journals, goals, Focus history or Desk Log.
// Someone who is not a verified member is reported as "not found", the same as an unknown id.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";
import { DECOR_SLOTS, DECOR_ITEMS } from "../_shared/deskCatalog.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMPANIONS = 2;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const auth = await requireMember(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!UUID.test(id)) return jsonResponse({ error: "Member not found" }, 404);

    const admin = getAdminClient();
    const { data: p, error } = await admin
      .from("profiles")
      .select("id,username,avatar_url,is_mod,created_at,is_member")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!p || !p.is_member) return jsonResponse({ error: "Member not found" }, 404);

    const { data: lay, error: layErr } = await admin.from("desk_layouts").select("layout").eq("user_id", id).maybeSingle();
    if (layErr) throw layErr;
    const raw = (lay?.layout as { companions?: unknown } | null)?.companions;
    const companions = Array.isArray(raw)
      ? raw.filter((c): c is string => typeof c === "string" && /^[a-z0-9-]{1,30}$/.test(c)).slice(0, MAX_COMPANIONS)
      : [];

    // Desk Finds items on their desk. Only known slot and item ids go out, nothing about what else they own.
    const rawDecor = ((lay?.layout as { decor?: Record<string, unknown> } | null)?.decor ?? {}) as Record<string, unknown>;
    const decor: Record<string, string> = {};
    for (const d of DECOR_SLOTS) {
      const v = rawDecor[d];
      decor[d] = typeof v === "string" && DECOR_ITEMS.includes(v) ? v : "";
    }

    return jsonResponse({
      id: p.id,
      name: p.username,
      avatar_url: p.avatar_url ?? null,
      is_mod: !!p.is_mod,
      since: p.created_at,
      companions,
      decor,
    });
  } catch (err) {
    console.error("member-profile failed:", err);
    return jsonResponse({ error: "Could not open this profile" }, 500);
  }
});
