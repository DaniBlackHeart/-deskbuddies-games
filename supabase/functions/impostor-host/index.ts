// impostor-host
// All MOD-driven Impostor WHO? control lives here behind one endpoint,
// dispatched by `action` — same shape as trivia-host/feud-host/uno-host.
// Every action re-verifies the caller is a MOD server-side.
//
// Unlike UNO (no MOD content at all) but like Trivia/Feud (MOD-authored
// sets), a session needs a category picked before it can be created —
// see create_session. Unlike Trivia/Feud, the category itself stays
// fixed for the whole session; only the secret WORD is randomized, and
// only once, at start_game (see start_game below and impostor_secrets in
// 0012_impostor.sql for why that table exists at all).

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMod,
  shuffle,
  claimSessionLock,
  releaseSessionLock,
  forceReleaseSessionLock,
  claimSpectatorSeat,
  releaseSpectatorSeat,
} from "../_shared/utils.ts";

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`impostor-session-${sessionId}`);
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
        const { category_id, random_category } = body as { category_id?: string; random_category?: boolean };

        let category: { id: string; name: string } | null = null;

        if (category_id) {
          const { data } = await admin
            .from("impostor_categories")
            .select("id, name")
            .eq("id", category_id)
            .is("archived_at", null)
            .maybeSingle();
          category = data;
        } else if (random_category) {
          // Only categories with at least one active word are eligible —
          // an empty category would leave start_game with nothing to deal.
          // Checked with a per-category count rather than a single joined
          // query: an inner join here would return one row PER matching
          // word, silently skewing "random" toward whichever category
          // happens to have the most words instead of picking uniformly.
          const { data: categories } = await admin.from("impostor_categories").select("id, name").is("archived_at", null);
          const withCounts = await Promise.all(
            (categories ?? []).map(async (c) => {
              const { count } = await admin
                .from("impostor_words")
                .select("id", { count: "exact", head: true })
                .eq("category_id", c.id)
                .is("archived_at", null);
              return { id: c.id, name: c.name, count: count ?? 0 };
            })
          );
          const eligible = withCounts.filter((c) => c.count > 0);
          if (eligible.length === 0) {
            return jsonResponse({ error: "No categories with words yet — add some in Impostor Categories first." }, 400);
          }
          const pick = eligible[Math.floor(Math.random() * eligible.length)];
          category = { id: pick.id, name: pick.name };
        } else {
          return jsonResponse({ error: "category_id or random_category is required" }, 400);
        }

        if (!category) return jsonResponse({ error: "Category not found" }, 404);

        const { count: wordCount } = await admin
          .from("impostor_words")
          .select("id", { count: "exact", head: true })
          .eq("category_id", category.id)
          .is("archived_at", null);
        if (!wordCount || wordCount < 1) {
          return jsonResponse({ error: "That category has no words yet — add some before starting a session." }, 400);
        }

        const sessionId = crypto.randomUUID();
        const lockError = await claimSessionLock(admin, { game: "impostor", sessionId, hostId: user.id });
        if (lockError) return lockError;

        const { data: session, error } = await admin
          .from("impostor_sessions")
          .insert({ id: sessionId, host_id: user.id, status: "lobby", category_id: category.id, category_name: category.name })
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
        const { data: session } = await admin.from("impostor_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't remove players once the game has started" }, 409);
        await admin.from("impostor_participants").delete().eq("session_id", session_id).eq("user_id", user_id);
        // Close the seat gap so seat_order stays contiguous (start_game shuffles by seat).
        const { data: remaining } = await admin
          .from("impostor_participants")
          .select("user_id, seat_order")
          .eq("session_id", session_id)
          .order("seat_order");
        await Promise.all(
          (remaining ?? []).map((p, i) =>
            p.seat_order === i ? null : admin.from("impostor_participants").update({ seat_order: i }).eq("session_id", session_id).eq("user_id", p.user_id)
          )
        );
        return jsonResponse({ ok: true });
      }

      case "start_game": {
        const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Game already started" }, 409);

        const { data: roster } = await admin
          .from("impostor_participants")
          .select("user_id")
          .eq("session_id", session_id);
        if (!roster || roster.length < 3) return jsonResponse({ error: "Need at least 3 players to start" }, 400);

        const { data: words } = await admin
          .from("impostor_words")
          .select("word")
          .eq("category_id", session.category_id)
          .is("archived_at", null);
        if (!words || words.length === 0) {
          return jsonResponse({ error: "This category has no active words — add some before starting" }, 400);
        }
        const secretWord = words[Math.floor(Math.random() * words.length)].word;

        // Shuffle into seats (same idea as UNO's deal order) and pick the
        // impostor + this round-set's starter from the shuffled roster.
        const seated = shuffle(roster.map((p) => p.user_id));
        const impostorUserId = seated[Math.floor(Math.random() * seated.length)];
        const nonImpostorSeats = seated.filter((id) => id !== impostorUserId);
        const starterUserId = nonImpostorSeats[Math.floor(Math.random() * nonImpostorSeats.length)];

        await Promise.all(
          seated.map((userId, i) => admin.from("impostor_participants").update({ seat_order: i }).eq("session_id", session_id).eq("user_id", userId))
        );

        await admin.from("impostor_secrets").upsert({ session_id, impostor_user_id: impostorUserId, secret_word: secretWord }, { onConflict: "session_id" });

        await Promise.all(
          seated.map((userId) =>
            admin.from("impostor_cards").upsert(
              {
                session_id,
                user_id: userId,
                is_impostor: userId === impostorUserId,
                word: userId === impostorUserId ? null : secretWord,
                category_name: session.category_name,
              },
              { onConflict: "session_id,user_id" }
            )
          )
        );

        const CLUE_WINDOW_MS = 45_000;
        const clueDeadline = new Date(Date.now() + CLUE_WINDOW_MS).toISOString();

        await admin
          .from("impostor_sessions")
          .update({
            status: "clue_giving",
            started_at: new Date().toISOString(),
            round_number: 1,
            turn_index: 0,
            round_set_starter_user_id: starterUserId,
            current_turn_user_id: starterUserId,
            clue_deadline: clueDeadline,
            state_version: 0,
          })
          .eq("id", session_id);

        await broadcast(admin, session_id, "game_started", {
          round_number: 1,
          starter_user_id: starterUserId,
          category_name: session.category_name,
        });
        return jsonResponse({ ok: true });
      }

      case "end_session": {
        const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status === "ended") return jsonResponse({ error: "Session already ended" }, 409);

        await admin
          .from("impostor_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), completed: false, spectator_id: null })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);
        await broadcast(admin, session_id, "session_ended", {});
        return jsonResponse({ ok: true });
      }

      case "claim_spectator": {
        const claimError = await claimSpectatorSeat(admin, { table: "impostor_sessions", sessionId: session_id, userId: user.id });
        if (claimError) return claimError;
        return jsonResponse({ ok: true });
      }

      case "release_spectator": {
        await releaseSpectatorSeat(admin, "impostor_sessions", session_id);
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
    console.error("impostor-host crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
