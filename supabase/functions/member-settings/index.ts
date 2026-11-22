// member-settings
// Saves one Settings switch for the signed-in member. { action: "set", key, value }
// Keys: notify_stickies, notify_news, allow_stickies, show_in_around. The member is taken from
// the verified session, never from the request body. Reading is done by the browser through
// row-level security (a member can read only their own row).
// Whatever ships Desk Stickies and Who's around must check these values on the server.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

const KEYS = ["notify_stickies", "notify_news", "allow_stickies", "show_in_around"];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "set") return jsonResponse({ error: "unknown action" }, 400);
    const key = typeof body.key === "string" ? body.key : "";
    if (!KEYS.includes(key) || typeof body.value !== "boolean") return jsonResponse({ error: "bad setting" }, 400);

    const admin = getAdminClient();
    const { error } = await admin.rpc("member_setting_set", { p_user_id: user.id, p_key: key, p_value: body.value });
    if (error) throw error;
    return jsonResponse({ status: "ok" });
  } catch {
    console.error("member-settings failed");
    return jsonResponse({ error: "Something went wrong." }, 500);
  }
});
