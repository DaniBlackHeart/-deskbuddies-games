// get-uno-state
// Used when a member opens/refreshes the UNO play page — hydrates them
// with everything they're allowed to see right now: the public table
// state (discard top, everyone's hand COUNT, whose turn) plus their own
// hand and nobody else's. Realtime broadcasts (channel
// `uno-session-{id}`) handle live updates after that.
//
// Anti-cheat boundary enforced here: `hand` is only ever looked up for
// the calling user. Even though this runs with the service-role client
// (which can see every row), the response body only ever includes the
// caller's own cards — same idea as get-feud-state withholding the other
// Fast Money player's answers before the reveal.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json();
    const { session_id } = body;
    if (!session_id) return jsonResponse({ error: "session_id is required" }, 400);

    const admin = getAdminClient();

    const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
    if (!session) return jsonResponse({ error: "Session not found" }, 404);

    const { data: deckState } = await admin.from("uno_deck_state").select("draw_pile").eq("session_id", session_id).maybeSingle();

    const { data: roster } = await admin
      .from("uno_participants")
      .select("user_id, seat_order, hand_count, has_called_uno, finished_at, finish_rank, profiles(username, avatar_url)")
      .eq("session_id", session_id)
      .order("seat_order", { ascending: true });

    let myHand: unknown[] = [];
    const isPlaying = (roster ?? []).some((p) => p.user_id === user.id);
    if (isPlaying) {
      const { data: handRow } = await admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
      myHand = (handRow?.hand as unknown[]) ?? [];
    }

    return jsonResponse({
      session: {
        id: session.id,
        status: session.status,
        direction: session.direction,
        current_turn_user_id: session.current_turn_user_id,
        current_color: session.current_color,
        drawn_this_turn: session.drawn_this_turn,
        discard_top: session.discard_top,
        draw_pile_count: ((deckState?.draw_pile as unknown[]) ?? []).length,
        pending_draw: session.pending_draw,
        pending_draw_type: session.pending_draw_type,
        pending_draw_from_user_id: session.pending_draw_from_user_id,
        state_version: session.state_version,
        winner_id: session.winner_id,
      },
      roster: roster ?? [],
      my_hand: myHand,
      is_playing: isPlaying,
    });
  } catch (err) {
    console.error("get-uno-state crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
