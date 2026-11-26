// Lets a member see and clear their own "spectating" slot.
//
// Each member can watch one game at a time (member_game_slots, slot_kind =
// 'spectate'). Normally the spectator page frees the slot when they leave, but
// if they close the tab mid-game the slot would stay held until that game ends.
// "release_spectate" is the escape hatch so they can move to another game.
// Playing/hosting slots are NOT clearable here — they free themselves when a
// lobby is left or the session ends.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const admin = getAdminClient();

  try {
    const { action } = await req.json();

    switch (action) {
      case "get": {
        const { data } = await admin
          .from("member_game_slots")
          .select("slot_kind, game, session_id, role")
          .eq("user_id", user.id);
        return jsonResponse({ slots: data ?? [] });
      }

      case "release_spectate": {
        await admin.from("member_game_slots").delete().eq("user_id", user.id).eq("slot_kind", "spectate");
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("my-game-slots crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
