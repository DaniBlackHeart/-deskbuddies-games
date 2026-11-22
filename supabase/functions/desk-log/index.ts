// desk-log
// Returns the Desk Log for the signed-in member.
//   { scope: "around" }   what fellow members did (member-visible kinds only, no amounts)
//   { scope: "mine" }     the member's own entries, with the reward each one paid
// The member comes from the verified session, never from the request. All filtering happens in
// the desk_log() database function (0040): the browser cannot ask for another member's rewards
// or for entries that are private. Read-only; nothing here writes.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const scope = body?.scope;
    if (scope !== "around" && scope !== "mine") return jsonResponse({ error: "scope must be 'around' or 'mine'" }, 400);

    const admin = getAdminClient();
    const { data, error } = await admin.rpc("desk_log", { p_user_id: user.id, p_scope: scope });
    if (error) throw error;
    return jsonResponse({ status: "ok", scope, entries: data ?? [] });
  } catch {
    console.error("desk-log failed");
    return jsonResponse({ error: "Something went wrong." }, 500);
  }
});
