// uno-play
// Members call this for every player-side action: joining, playing a
// card (including jump-ins), drawing, passing, calling/catching UNO, and
// challenging a Wild Draw Four. Grading/legality happens entirely here
// using the service-role client — nobody's hand or the draw pile order
// ever reaches a browser that isn't supposed to see it (see uno_hands'
// RLS in 0011_uno.sql).
//
// Ruleset (per project decision): official rules + draw-stacking + jump-in
// + the 7-0 house rule + the Wild Draw Four challenge. Scoping note on
// the challenge: it only ever checks against the MOST RECENT card added
// to a stacked +4 chain (pending_draw_from_user_id / pending_draw_prev_color
// track just that one link), not the full history of a multi-player
// stack. That's a deliberate simplification — a fully general N-player
// stacked-challenge resolution is a lot of extra state for a rules
// interaction that's already an edge case of an edge case.
//
// Optimistic concurrency: every state-mutating action takes
// `expected_version` and the write is conditioned on `state_version`
// still matching (see 0011_uno.sql's comment on that column). This is
// what makes jump-in safe — two players racing to jump on the same
// discard can't both win — and it also protects against a stale
// draw/pass arriving after the round already moved on, same spirit as
// trivia-answer's double-submission guard.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  drawUnoCards,
  isUnoLegalPlayAgainst,
  isUnoJumpInMatch,
  isUnoWildCard,
  nextUnoSeat,
  releaseSessionLock,
  type UnoCard,
  type UnoColor,
} from "../_shared/utils.ts";

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`uno-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

type ParticipantRow = {
  id: string;
  user_id: string;
  seat_order: number;
  hand_count: number;
  has_called_uno: boolean;
  finished_at: string | null;
  profiles?: { username: string } | null;
};

/** Active (still-seated) roster in seat order. UNO doesn't remove players on finishing — the game ends the instant anyone empties their hand. */
async function getRoster(admin: ReturnType<typeof getAdminClient>, sessionId: string): Promise<ParticipantRow[]> {
  const { data } = await admin
    .from("uno_participants")
    .select("id, user_id, seat_order, hand_count, has_called_uno, finished_at, profiles(username)")
    .eq("session_id", sessionId)
    .order("seat_order", { ascending: true });
  return (data as unknown as ParticipantRow[]) ?? [];
}

function cardsEqual(a: UnoCard, b: UnoCard) {
  return a.color === b.color && a.value === b.value;
}

/** The draw pile + discard history live in their own table (uno_deck_state) — see 0011_uno.sql's comment on why. */
async function getDeckState(admin: ReturnType<typeof getAdminClient>, sessionId: string): Promise<{ draw_pile: UnoCard[]; discard_pile: UnoCard[] }> {
  const { data } = await admin.from("uno_deck_state").select("draw_pile, discard_pile").eq("session_id", sessionId).single();
  return { draw_pile: (data?.draw_pile as UnoCard[]) ?? [], discard_pile: (data?.discard_pile as UnoCard[]) ?? [] };
}

async function saveDeckState(admin: ReturnType<typeof getAdminClient>, sessionId: string, drawPile: UnoCard[], discardPile: UnoCard[]) {
  await admin.from("uno_deck_state").update({ draw_pile: drawPile, discard_pile: discardPile }).eq("session_id", sessionId);
}

/** Removes the first matching card from a hand. Returns null if it wasn't there — never trust the client's claim that they hold it. */
function removeFromHand(hand: UnoCard[], card: UnoCard): UnoCard[] | null {
  const idx = hand.findIndex((c) => cardsEqual(c, card));
  if (idx === -1) return null;
  const next = [...hand];
  next.splice(idx, 1);
  return next;
}

/** Ends the game: winner takes rank 1, everyone else ranked by remaining hand_count ascending (display only, doesn't affect anything gameplay-wise). */
async function finalizeWin(admin: ReturnType<typeof getAdminClient>, sessionId: string, winnerId: string, roster: ParticipantRow[], winnerHandCount: number) {
  const others = roster
    .filter((p) => p.user_id !== winnerId)
    .map((p) => ({ ...p, hand_count: p.user_id === winnerId ? winnerHandCount : p.hand_count }))
    .sort((a, b) => a.hand_count - b.hand_count);

  await admin.from("uno_participants").update({ finished_at: new Date().toISOString(), finish_rank: 1 }).eq("session_id", sessionId).eq("user_id", winnerId);
  await Promise.all(
    others.map((p, i) =>
      admin.from("uno_participants").update({ finish_rank: i + 2 }).eq("session_id", sessionId).eq("user_id", p.user_id)
    )
  );

  await releaseSessionLock(admin, sessionId);

  await admin
    .from("uno_sessions")
    .update({ status: "ended", winner_id: winnerId, ended_at: new Date().toISOString(), spectator_id: null })
    .eq("id", sessionId);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const admin = getAdminClient();

  try {
    const body = await req.json();
    const { action, session_id } = body;

    switch (action) {
      // ---------------------------------------------------------------
      // Lobby
      // ---------------------------------------------------------------
      case "join_game": {
        const { data: session } = await admin.from("uno_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "This game has already started" }, 409);

        const { count } = await admin.from("uno_participants").select("id", { count: "exact", head: true }).eq("session_id", session_id);
        if ((count ?? 0) >= 10) return jsonResponse({ error: "This game is full (10 players max)" }, 409);

        const { data: existing } = await admin.from("uno_participants").select("id").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
        if (existing) return jsonResponse({ ok: true }); // already joined (e.g. refresh) — treat as success

        const nextSeat = count ?? 0;
        const { error } = await admin.from("uno_participants").insert({ session_id, user_id: user.id, seat_order: nextSeat });
        if (error) return jsonResponse({ error: "Could not join" }, 500);
        return jsonResponse({ ok: true });
      }

      case "leave_lobby": {
        const { data: session } = await admin.from("uno_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't leave once the game has started" }, 409);
        await admin.from("uno_participants").delete().eq("session_id", session_id).eq("user_id", user.id);
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // Playing a card — covers both a normal turn AND a jump-in.
      // ---------------------------------------------------------------
      case "play_card": {
        const { card, chosen_color, swap_with_user_id, called_uno, expected_version } = body as {
          card: UnoCard;
          chosen_color?: UnoColor;
          swap_with_user_id?: string;
          called_uno?: boolean;
          expected_version: number;
        };

        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live") return jsonResponse({ error: "This game isn't live" }, 409);
        if (typeof expected_version === "number" && expected_version !== session.state_version) {
          return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);
        }

        const roster = await getRoster(admin, session_id);
        const actingIdx = roster.findIndex((p) => p.user_id === user.id);
        if (actingIdx === -1) return jsonResponse({ error: "You're not in this game" }, 403);
        const actingSeat = roster[actingIdx].seat_order;

        const isMyTurn = session.current_turn_user_id === user.id;
        const discardTop = session.discard_top as UnoCard | null;
        if (!discardTop) return jsonResponse({ error: "Game hasn't started" }, 409);

        let isJumpIn = false;
        if (isMyTurn) {
          if (!isUnoLegalPlayAgainst(card, discardTop, session.current_color, session.pending_draw_type)) {
            return jsonResponse({ error: "That card can't be played right now" }, 409);
          }
        } else {
          // Jump-in: legal any time, out of turn, only on an exact match, and
          // only while nobody's mid-obligation (keeps the stacking rules from
          // colliding with an out-of-turn interrupt).
          if (session.pending_draw_type) return jsonResponse({ error: "Can't jump in while a draw is pending" }, 409);
          if (!isUnoJumpInMatch(card, discardTop)) return jsonResponse({ error: "That's not an exact match — no jump-in" }, 409);
          isJumpIn = true;
        }

        if (isUnoWildCard(card) && !chosen_color) {
          return jsonResponse({ error: "Choose a color for that Wild" }, 400);
        }
        if (card.value === "7" && !swap_with_user_id) {
          return jsonResponse({ error: "Choose who to swap hands with" }, 400);
        }
        if (card.value === "7" && !roster.some((p) => p.user_id === swap_with_user_id && p.user_id !== user.id)) {
          return jsonResponse({ error: "Pick another player still in the game" }, 400);
        }

        const { data: handRow } = await admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", user.id).single();
        const hand = (handRow?.hand as UnoCard[]) ?? [];
        const newHand = removeFromHand(hand, card);
        if (!newHand) return jsonResponse({ error: "You don't have that card" }, 409);

        const newHandCount = newHand.length;
        const willHaveCalledUno = newHandCount === 1 && !!called_uno;
        const deckState = await getDeckState(admin, session_id);
        const newDiscardPile = [...deckState.discard_pile, discardTop];

        // Everything above this line is pure validation/computation — no
        // writes yet. The conditional update below (guarded on
        // state_version) is the actual commit point: if it fails, we
        // return 409 having touched nothing, so a jump-in that loses a
        // race can't leave the loser's hand mutated for a play that
        // never counted.

        if (newHandCount === 0) {
          const { data: updated } = await admin
            .from("uno_sessions")
            .update({ discard_top: card, state_version: session.state_version + 1 })
            .eq("id", session_id)
            .eq("state_version", session.state_version)
            .select()
            .maybeSingle();
          if (!updated) return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);

          await Promise.all([
            admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", user.id),
            admin.from("uno_participants").update({ hand_count: 0, has_called_uno: false }).eq("session_id", session_id).eq("user_id", user.id),
            saveDeckState(admin, session_id, deckState.draw_pile, newDiscardPile),
          ]);
          await finalizeWin(admin, session_id, user.id, roster, 0);
          await broadcast(admin, session_id, "game_ended", { winner_user_id: user.id, card });
          return jsonResponse({ ok: true, won: true });
        }

        const N = roster.length;
        const prevColor = session.current_color as UnoColor;
        const newColor: UnoColor = isUnoWildCard(card) ? (chosen_color as UnoColor) : (card.color as UnoColor);
        let newDirection: 1 | -1 = session.direction;
        let nextSeat: number;
        let newPendingDraw = 0;
        let newPendingType: "draw_two" | "draw_four" | null = null;
        let newPendingFrom: string | null = null;
        let newPendingPrevColor: UnoColor | null = null;

        switch (card.value) {
          case "skip":
            nextSeat = nextUnoSeat(actingSeat, newDirection, N, 2);
            break;
          case "reverse":
            if (N === 2) {
              nextSeat = nextUnoSeat(actingSeat, newDirection, N, 2); // acts as a skip 1-on-1
            } else {
              newDirection = (session.direction * -1) as 1 | -1;
              nextSeat = nextUnoSeat(actingSeat, newDirection, N, 1);
            }
            break;
          case "draw2":
            newPendingDraw = (session.pending_draw_type === "draw_two" ? session.pending_draw : 0) + 2;
            newPendingType = "draw_two";
            newPendingFrom = user.id;
            newPendingPrevColor = prevColor;
            nextSeat = nextUnoSeat(actingSeat, newDirection, N, 1);
            break;
          case "wild4":
            newPendingDraw = (session.pending_draw_type === "draw_four" ? session.pending_draw : 0) + 4;
            newPendingType = "draw_four";
            newPendingFrom = user.id;
            newPendingPrevColor = prevColor; // the color that was active before THIS wild4 — what a challenge checks against
            nextSeat = nextUnoSeat(actingSeat, newDirection, N, 1);
            break;
          default:
            nextSeat = nextUnoSeat(actingSeat, newDirection, N, 1);
        }

        const nextUser = roster[nextSeat]?.user_id ?? session.current_turn_user_id;

        // --- Commit point. ---
        const { data: updated } = await admin
          .from("uno_sessions")
          .update({
            discard_top: card,
            current_color: newColor,
            direction: newDirection,
            current_turn_user_id: nextUser,
            drawn_this_turn: false,
            pending_draw: newPendingDraw,
            pending_draw_type: newPendingType,
            pending_draw_from_user_id: newPendingFrom,
            pending_draw_prev_color: newPendingPrevColor,
            state_version: session.state_version + 1,
          })
          .eq("id", session_id)
          .eq("state_version", session.state_version)
          .select()
          .maybeSingle();

        if (!updated) return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);

        // From here on we've won the race — apply every side effect.
        await Promise.all([
          admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", user.id),
          admin
            .from("uno_participants")
            .update({ hand_count: newHandCount, has_called_uno: willHaveCalledUno })
            .eq("session_id", session_id)
            .eq("user_id", user.id),
          saveDeckState(admin, session_id, deckState.draw_pile, newDiscardPile),
        ]);

        // 7-0 house rule side effects (in addition to the normal turn advance above).
        if (card.value === "7" && swap_with_user_id) {
          const [{ data: theirHandRow }] = await Promise.all([
            admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", swap_with_user_id).single(),
          ]);
          const theirs = (theirHandRow?.hand as UnoCard[]) ?? [];
          await Promise.all([
            admin.from("uno_hands").update({ hand: theirs }).eq("session_id", session_id).eq("user_id", user.id),
            admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", swap_with_user_id),
            admin.from("uno_participants").update({ hand_count: theirs.length }).eq("session_id", session_id).eq("user_id", user.id),
            admin.from("uno_participants").update({ hand_count: newHand.length }).eq("session_id", session_id).eq("user_id", swap_with_user_id),
          ]);
        }

        if (card.value === "0") {
          const otherHands = await Promise.all(
            roster.filter((p) => p.user_id !== user.id).map((p) => admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", p.user_id).single())
          );
          const handsBySeat = new Map<number, UnoCard[]>();
          handsBySeat.set(actingSeat, newHand);
          roster
            .filter((p) => p.user_id !== user.id)
            .forEach((p, i) => handsBySeat.set(p.seat_order, (otherHands[i].data?.hand as UnoCard[]) ?? []));

          // Rotate in the direction of play: seat i receives the hand that was one step behind it.
          await Promise.all(
            roster.map((p) => {
              const sourceSeat = ((p.seat_order - newDirection) % N + N) % N;
              const incoming = handsBySeat.get(sourceSeat) ?? [];
              return Promise.all([
                admin.from("uno_hands").update({ hand: incoming }).eq("session_id", session_id).eq("user_id", p.user_id),
                admin.from("uno_participants").update({ hand_count: incoming.length }).eq("session_id", session_id).eq("user_id", p.user_id),
              ]);
            })
          );
        }

        await broadcast(admin, session_id, "card_played", {
          user_id: user.id,
          card,
          jump_in: isJumpIn,
          effect: card.value,
          next_turn_user_id: nextUser,
          current_color: newColor,
          pending_draw: newPendingDraw,
          pending_draw_type: newPendingType,
          hand_count: newHandCount,
          called_uno: willHaveCalledUno,
        });
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // Drawing — resolves a normal single draw, OR (if a +2/+4 is
      // pending) the whole forced draw at once, which always ends the
      // turn.
      // ---------------------------------------------------------------
      case "draw_card": {
        const { expected_version } = body as { expected_version: number };
        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live") return jsonResponse({ error: "This game isn't live" }, 409);
        if (session.current_turn_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (typeof expected_version === "number" && expected_version !== session.state_version) {
          return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);
        }

        const roster = await getRoster(admin, session_id);
        const actingSeat = roster.find((p) => p.user_id === user.id)?.seat_order ?? 0;
        const N = roster.length;

        const forcedCount = session.pending_draw_type ? session.pending_draw : session.drawn_this_turn ? 0 : 1;
        if (forcedCount === 0) return jsonResponse({ error: "You've already drawn this turn — play a card or pass" }, 409);

        const deckState = await getDeckState(admin, session_id);
        const { drawn, newDrawPile, newDiscardPile } = drawUnoCards(deckState.draw_pile, deckState.discard_pile, forcedCount);

        const wasForced = !!session.pending_draw_type;
        const sessionUpdate: Record<string, unknown> = { state_version: session.state_version + 1 };

        if (wasForced) {
          // Forced draw always ends the turn.
          const nextSeat = nextUnoSeat(actingSeat, session.direction, N, 1);
          Object.assign(sessionUpdate, {
            current_turn_user_id: roster[nextSeat]?.user_id ?? session.current_turn_user_id,
            drawn_this_turn: false,
            pending_draw: 0,
            pending_draw_type: null,
            pending_draw_from_user_id: null,
            pending_draw_prev_color: null,
          });
        } else {
          sessionUpdate.drawn_this_turn = true;
        }

        // Commit point.
        const { data: updated } = await admin
          .from("uno_sessions")
          .update(sessionUpdate)
          .eq("id", session_id)
          .eq("state_version", session.state_version)
          .select()
          .maybeSingle();
        if (!updated) return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);

        const { data: handRow } = await admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", user.id).single();
        const newHand = [...((handRow?.hand as UnoCard[]) ?? []), ...drawn];
        await Promise.all([
          admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", user.id),
          admin.from("uno_participants").update({ hand_count: newHand.length, has_called_uno: false }).eq("session_id", session_id).eq("user_id", user.id),
          saveDeckState(admin, session_id, newDrawPile, newDiscardPile),
        ]);

        const playable = drawn.length === 1 && !!session.discard_top
          ? isUnoLegalPlayAgainst(drawn[0], session.discard_top as UnoCard, updated.current_color, null)
          : false;

        await broadcast(admin, session_id, wasForced ? "forced_draw" : "card_drawn", {
          user_id: user.id,
          count: drawn.length,
          forced: wasForced,
          next_turn_user_id: updated.current_turn_user_id,
        });
        return jsonResponse({ ok: true, drawn_count: drawn.length, playable });
      }

      case "pass_turn": {
        const { expected_version } = body as { expected_version: number };
        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live") return jsonResponse({ error: "This game isn't live" }, 409);
        if (session.current_turn_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (session.pending_draw_type) return jsonResponse({ error: "Draw first — there's a pending penalty" }, 409);
        if (!session.drawn_this_turn) return jsonResponse({ error: "Draw a card before passing" }, 409);
        if (typeof expected_version === "number" && expected_version !== session.state_version) {
          return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);
        }

        const roster = await getRoster(admin, session_id);
        const actingSeat = roster.find((p) => p.user_id === user.id)?.seat_order ?? 0;
        const nextSeat = nextUnoSeat(actingSeat, session.direction, roster.length, 1);
        const nextUser = roster[nextSeat]?.user_id ?? session.current_turn_user_id;

        const { data: updated } = await admin
          .from("uno_sessions")
          .update({ current_turn_user_id: nextUser, drawn_this_turn: false, state_version: session.state_version + 1 })
          .eq("id", session_id)
          .eq("state_version", session.state_version)
          .select()
          .maybeSingle();
        if (!updated) return jsonResponse({ error: "The game state moved on — refresh and try again" }, 409);

        await broadcast(admin, session_id, "turn_passed", { user_id: user.id, next_turn_user_id: nextUser });
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // UNO! catching someone who forgot to call it.
      // ---------------------------------------------------------------
      case "catch_uno": {
        const { target_user_id } = body as { target_user_id: string };
        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live") return jsonResponse({ error: "This game isn't live" }, 409);

        const { data: target } = await admin
          .from("uno_participants")
          .select("*")
          .eq("session_id", session_id)
          .eq("user_id", target_user_id)
          .single();
        if (!target) return jsonResponse({ error: "Player not found" }, 404);
        if (target.hand_count !== 1 || target.has_called_uno || target.finished_at) {
          return jsonResponse({ error: "Nothing to catch — they're in the clear" }, 409);
        }

        const deckState = await getDeckState(admin, session_id);
        const { drawn, newDrawPile, newDiscardPile } = drawUnoCards(deckState.draw_pile, deckState.discard_pile, 2);
        const { data: handRow } = await admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", target_user_id).single();
        const newHand = [...((handRow?.hand as UnoCard[]) ?? []), ...drawn];
        await admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", target_user_id);
        await admin.from("uno_participants").update({ hand_count: newHand.length }).eq("session_id", session_id).eq("user_id", target_user_id);
        await admin.from("uno_sessions").update({ state_version: session.state_version + 1 }).eq("id", session_id);
        await saveDeckState(admin, session_id, newDrawPile, newDiscardPile);

        await broadcast(admin, session_id, "uno_caught", { caught_user_id: target_user_id, caught_by_user_id: user.id, penalty: drawn.length });
        return jsonResponse({ ok: true, penalty: drawn.length });
      }

      // ---------------------------------------------------------------
      // Wild Draw Four challenge.
      // ---------------------------------------------------------------
      case "challenge_wild_draw_four": {
        const { data: session } = await admin.from("uno_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live") return jsonResponse({ error: "This game isn't live" }, 409);
        if (session.current_turn_user_id !== user.id) return jsonResponse({ error: "Only the player facing the draw can challenge" }, 403);
        if (session.pending_draw_type !== "draw_four") return jsonResponse({ error: "Nothing to challenge right now" }, 409);

        const accused = session.pending_draw_from_user_id as string;
        const { data: accusedHandRow } = await admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", accused).single();
        const accusedHand = (accusedHandRow?.hand as UnoCard[]) ?? [];
        const hadAlternative = accusedHand.some((c) => c.color === session.pending_draw_prev_color);

        const roster = await getRoster(admin, session_id);
        const deckState = await getDeckState(admin, session_id);

        if (hadAlternative) {
          // Illegal play — the WD4 player eats the 4 instead.
          const { drawn, newDrawPile, newDiscardPile } = drawUnoCards(deckState.draw_pile, deckState.discard_pile, 4);
          const newHand = [...accusedHand, ...drawn];
          await admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", accused);
          await admin.from("uno_participants").update({ hand_count: newHand.length }).eq("session_id", session_id).eq("user_id", accused);
          await admin
            .from("uno_sessions")
            .update({
              pending_draw: 0,
              pending_draw_type: null,
              pending_draw_from_user_id: null,
              pending_draw_prev_color: null,
              drawn_this_turn: false,
              state_version: session.state_version + 1,
            })
            .eq("id", session_id);
          await saveDeckState(admin, session_id, newDrawPile, newDiscardPile);
          await broadcast(admin, session_id, "challenge_resolved", { success: true, accused_user_id: accused, penalty_to: accused, penalty: drawn.length });
          return jsonResponse({ ok: true, success: true });
        }

        // Legal play — the challenger eats the pending draw plus a 2-card penalty, and the turn moves on.
        const penaltyCount = session.pending_draw + 2;
        const { drawn, newDrawPile, newDiscardPile } = drawUnoCards(deckState.draw_pile, deckState.discard_pile, penaltyCount);
        const { data: handRow } = await admin.from("uno_hands").select("hand").eq("session_id", session_id).eq("user_id", user.id).single();
        const newHand = [...((handRow?.hand as UnoCard[]) ?? []), ...drawn];
        await admin.from("uno_hands").update({ hand: newHand }).eq("session_id", session_id).eq("user_id", user.id);
        await admin.from("uno_participants").update({ hand_count: newHand.length }).eq("session_id", session_id).eq("user_id", user.id);

        const actingSeat = roster.find((p) => p.user_id === user.id)?.seat_order ?? 0;
        const nextSeat = nextUnoSeat(actingSeat, session.direction, roster.length, 1);
        const nextUser = roster[nextSeat]?.user_id ?? session.current_turn_user_id;

        await admin
          .from("uno_sessions")
          .update({
            pending_draw: 0,
            pending_draw_type: null,
            pending_draw_from_user_id: null,
            pending_draw_prev_color: null,
            current_turn_user_id: nextUser,
            drawn_this_turn: false,
            state_version: session.state_version + 1,
          })
          .eq("id", session_id);
        await saveDeckState(admin, session_id, newDrawPile, newDiscardPile);

        await broadcast(admin, session_id, "challenge_resolved", { success: false, accused_user_id: accused, penalty_to: user.id, penalty: drawn.length });
        return jsonResponse({ ok: true, success: false, penalty: drawn.length });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("uno-play crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
