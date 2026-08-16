// uno-host
// All MOD-driven UNO control lives here behind one endpoint, dispatched
// by `action` — same shape as trivia-host/feud-host. Every action
// re-verifies the caller is a MOD server-side.
//
// Unlike Trivia/Feud there's no set to pick — UNO has no MOD-authored
// content — so `create_session` needs nothing beyond who's hosting.
// That also means, unlike the other two games, a new session isn't
// created from a set-editor "Start session" button; it's started
// directly from the MOD Dashboard (see frontend/src/pages/mod/ModDashboardPage.tsx).

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMod,
  buildUnoDeck,
  shuffle,
  nextUnoSeat,
  claimSessionLock,
  releaseSessionLock,
  forceReleaseSessionLock,
  claimSpectatorSeat,
  releaseSpectatorSeat,
  type UnoCard,
  type UnoColor,
} from "../_shared/utils.ts";

const UNO_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const HAND_SIZE = 7;

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`uno-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMod(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const admin = getAdminClient();

  try {
    const body = await req.json();
    const { action, session_id } = body;

    switch (action) {
      case "create_session": {
        const sessionId = crypto.randomUUID();
        const lockError = await claimSessionLock(admin, { game: "uno", sessionId, hostId: user.id });
        if (lockError) return lockError;

        const { data: session, error } = await admin
          .from("uno_sessions")
          .insert({ id: sessionId, host_id: user.id, status: "lobby" })
          .select()
          .single();

        if (error) {
          await releaseSessionLock(admin, sessionId);
          return jsonResponse({ error: "Could not create session" }, 500);
        }
        return jsonResponse({ session });
      }

      case "remove_player": {
        const { user_id } = body;
        const { data: session } = await admin.from("uno_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't remove players once the game has started" }, 409);
        await admin.from("uno_participants").delete().eq("session_id", session_id).eq("user_id", user_id);
        // Close the seat gap so seat_order stays contiguous (start_game deals in seat order).
        const { data: remaining } = await admin.from("uno_participants").select("user_id, seat_order").eq("session_id", session_id).order("seat_order");
        await Promise.all((remaining ?? []).map((p, i) => (p.seat_order === i ? null : admin.from("uno_participants").update({ seat_order: i }).eq("session_id", session_id).eq("user_id", p.user_id))));
        return jsonResponse({ ok: true });
      }

      case "set_seat_order": {
        const { ordered_user_ids } = body as { ordered_user_ids: string[] };
        const { data: session } = await admin.from("uno_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Seat order is locked once the game starts" }, 409);
        await Promise.all(
          ordered_user_ids.map((uid, i) => admin.from("uno_participants").update({ seat_order: i }).eq("session_id", session_id).eq("user_id", uid))
        );
        return jsonResponse({ ok: true });
      }

      case "start_game": {
        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Game already started" }, 409);

        const { data: roster } = await admin.from("uno_participants").select("user_id, seat_order").eq("session_id", session_id).order("seat_order");
        if (!roster || roster.length < 2) return jsonResponse({ error: "Need at least 2 players to start" }, 400);
        if (roster.length > 10) return jsonResponse({ error: "UNO tops out at 10 players" }, 400);

        let deck = shuffle(buildUnoDeck());

        // Deal 7 to each player, seat order first (matches a real deal —
        // round-by-round rather than handing out 7 in a row, though the
        // end result is the same since it's already shuffled).
        const hands = new Map<string, UnoCard[]>(roster.map((p) => [p.user_id, []]));
        for (let round = 0; round < HAND_SIZE; round++) {
          for (const p of roster) {
            const card = deck.pop();
            if (card) hands.get(p.user_id)!.push(card);
          }
        }

        await Promise.all(
          roster.map((p) =>
            Promise.all([
              admin.from("uno_hands").upsert({ session_id, user_id: p.user_id, hand: hands.get(p.user_id) }, { onConflict: "session_id,user_id" }),
              admin.from("uno_participants").update({ hand_count: HAND_SIZE, has_called_uno: false, finished_at: null, finish_rank: null }).eq("session_id", session_id).eq("user_id", p.user_id),
            ])
          )
        );

        // Flip the starting card. Wild Draw Four can't legally start a
        // game (official rule) — shuffle it back in and draw again.
        let starter: UnoCard | undefined;
        const N = roster.length;
        for (let attempts = 0; attempts < 20 && deck.length > 0; attempts++) {
          const candidate = deck.pop()!;
          if (candidate.value === "wild4") {
            deck = shuffle([...deck, candidate]);
            continue;
          }
          starter = candidate;
          break;
        }
        if (!starter) return jsonResponse({ error: "Could not draw a valid starting card — try again" }, 500);

        // Resolve the starting card's effect as if seat 0 had "played" it,
        // same effect rules as a normal turn (see uno-play's play_card).
        let direction: 1 | -1 = 1;
        let color: UnoColor;
        let currentTurnSeat: number;
        let pendingDraw = 0;
        let pendingType: "draw_two" | null = null;
        let pendingFrom: string | null = null;

        if (starter.value === "wild") {
          color = UNO_COLORS[Math.floor(Math.random() * UNO_COLORS.length)];
          currentTurnSeat = 0;
        } else {
          color = starter.color as UnoColor;
          if (starter.value === "skip") {
            currentTurnSeat = nextUnoSeat(0, direction, N, 2);
          } else if (starter.value === "reverse") {
            direction = N === 2 ? 1 : -1;
            currentTurnSeat = nextUnoSeat(0, direction, N, N === 2 ? 2 : 1);
          } else if (starter.value === "draw2") {
            pendingDraw = 2;
            pendingType = "draw_two";
            pendingFrom = roster[0].user_id;
            currentTurnSeat = nextUnoSeat(0, direction, N, 1);
          } else {
            currentTurnSeat = 0;
          }
        }

        await Promise.all([
          admin
            .from("uno_sessions")
            .update({
              status: "live",
              started_at: new Date().toISOString(),
              direction,
              current_color: color,
              current_turn_user_id: roster[currentTurnSeat].user_id,
              drawn_this_turn: false,
              discard_top: starter,
              pending_draw: pendingDraw,
              pending_draw_type: pendingType,
              pending_draw_from_user_id: pendingFrom,
              pending_draw_prev_color: pendingType ? color : null,
              state_version: 0,
            })
            .eq("id", session_id),
          admin
            .from("uno_deck_state")
            .upsert({ session_id, draw_pile: deck, discard_pile: [] }, { onConflict: "session_id" }),
        ]);

        await broadcast(admin, session_id, "game_started", { starter, current_turn_user_id: roster[currentTurnSeat].user_id });
        return jsonResponse({ ok: true });
      }

      case "end_session": {
        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status === "ended") return jsonResponse({ error: "Session already ended" }, 409);

        await admin
          .from("uno_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), spectator_id: null })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);
        await broadcast(admin, session_id, "session_ended", {});
        return jsonResponse({ ok: true });
      }

      case "claim_spectator": {
        const claimError = await claimSpectatorSeat(admin, { table: "uno_sessions", sessionId: session_id, userId: user.id });
        if (claimError) return claimError;
        return jsonResponse({ ok: true });
      }

      case "release_spectator": {
        await releaseSpectatorSeat(admin, "uno_sessions", session_id);
        return jsonResponse({ ok: true });
      }

      case "force_release_lock": {
        const released = await forceReleaseSessionLock(admin);
        return jsonResponse({ ok: true, released });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("uno-host crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
