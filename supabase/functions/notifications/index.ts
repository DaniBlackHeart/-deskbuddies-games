// notifications
// Marks the signed-in member's notifications read.
//   { action: "mark_read", id }   one notification
//   { action: "mark_all_read" }   every unread one
// The member comes from the verified session. Listing and counting are done by the browser
// through row-level security (a member can read only their own rows). Nothing here can create
// or change notification text.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    let id: string | null = null;
    if (body?.action === "mark_read") {
      if (typeof body.id !== "string" || !UUID.test(body.id)) return jsonResponse({ error: "bad id" }, 400);
      id = body.id;
    } else if (body?.action !== "mark_all_read") {
      return jsonResponse({ error: "unknown action" }, 400);
    }
    const admin = getAdminClient();
    const { error } = await admin.rpc("notifications_mark_read", { p_user_id: user.id, p_id: id });
    if (error) throw error;
    return jsonResponse({ status: "ok" });
  } catch {
    console.error("notifications failed");
    return jsonResponse({ error: "Something went wrong." }, 500);
  }
});
