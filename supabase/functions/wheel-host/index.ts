// wheel-host
// All MOD-driven Wheel of Fortune control lives here behind one endpoint,
// dispatched by `action` — same shape as trivia-host/feud-host/uno-host/
// impostor-host. Every action re-verifies the caller is a MOD server-side.
//
// Round-to-round pacing is MOD-driven, same as Trivia's "Next Question"
// and Feud's per-phase controls: after a round resolves (solved or
// auto-revealed), the host clicks "advance_round" to move things along —
// to the next main round, into a Do-or-Die tiebreaker if the main game
// ends tied, or into the Bonus Round once there's a clear winner. All the
// actual gameplay (buzzing, spinning, calling letters, solving) is
// player-driven from wheel-play, same split as every other game here.
//
// Team mode: sessions can now run as "solo" (the original free-for-all,
// unchanged) or "team" (3-12 teams of 2-3, self-picked at join time via
// wheel-play's create_team/join_team). advance_round's end-of-main-game
// standings and tiebreak logic both branch on session.game_mode — team
// mode compares wheel_teams.total_points instead of individual
// wheel_participants.total_points, and the Bonus Round is played by
// whichever individual is the winning team's current representative.
// See PROJECT_CONTEXT.md §6c-iii for the full design writeup.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMod,
  claimSessionLock,
  releaseSessionLock,
  forceReleaseSessionLock,
  claimSpectatorSeat,
  releaseSpectatorSeat,
  pickWheelCategoryAndPhrase,
  pickRandomWheelCategories,
  maskWheelPhrase,
  WHEEL_MIN_PLAYERS,
  WHEEL_MIN_TEAMS,
  WHEEL_MIN_TEAM_SIZE,
  WHEEL_MAIN_ROUNDS,
  WHEEL_BUZZ_WINDOW_MS,
  WHEEL_MAX_TIEBREAKER_ATTEMPTS,
} from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

async function broadcast(admin: Admin, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`wheel-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

/** The user_id currently representing a team — the participant at that team's current_rep_index in line order. */
async function getTeamRepUserId(admin: Admin, teamId: string): Promise<string | null> {
  const { data: team } = await admin.from("wheel_teams").select("current_rep_index").eq("id", teamId).single();
  if (!team) return null;
  const { data: rep } = await admin
    .from("wheel_participants")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("line_position", team.current_rep_index)
    .maybeSingle();
  return rep?.user_id ?? null;
}

/** Creates the next round row + its secret phrase, and points the session at it. Shared by start_game and advance_round (main rounds). Mode-agnostic — team vs. solo eligibility/turn state is entirely wheel-play's concern at buzz time. */
async function startRound(
  admin: Admin,
  sessionId: string,
  roundIndex: number,
  isTiebreaker: boolean,
  usedCategoryIds: string[],
  usedPhraseIds: string[]
): Promise<{ error: Response } | { category_name: string; phrase_length: number; masked: string; deadline_ms: number }> {
  const picked = await pickWheelCategoryAndPhrase(admin, usedCategoryIds, usedPhraseIds);
  if (!picked) {
    return { error: jsonResponse({ error: "No phrases available yet — add some in Wheel Categories first." }, 400) };
  }

  const deadline = new Date(Date.now() + WHEEL_BUZZ_WINDOW_MS).toISOString();
  const { data: round, error: roundError } = await admin
    .from("wheel_rounds")
    .insert({
      session_id: sessionId,
      round_index: roundIndex,
      is_tiebreaker: isTiebreaker,
      category_id: picked.category.id,
      category_name: picked.category.name,
      phrase_length: picked.phrase.phrase.length,
      status: "active",
      turn_phase: "buzz_open",
      turn_deadline: deadline,
    })
    .select()
    .single();

  if (roundError || !round) {
    return { error: jsonResponse({ error: "Could not start the round" }, 500) };
  }

  await admin.from("wheel_round_secrets").insert({ round_id: round.id, phrase_text: picked.phrase.phrase });

  await admin
    .from("wheel_sessions")
    .update({
      current_round_index: roundIndex,
      used_category_ids: [...usedCategoryIds, picked.category.id],
      used_phrase_ids: [...usedPhraseIds, picked.phrase.id],
    })
    .eq("id", sessionId);

  const masked = maskWheelPhrase(picked.phrase.phrase, []);
  await broadcast(admin, sessionId, "round_started", {
    round_index: roundIndex,
    is_tiebreaker: isTiebreaker,
    category_name: picked.category.name,
    masked_phrase: masked,
    buzz_deadline_ms: new Date(deadline).getTime(),
  });

  return { category_name: picked.category.name, phrase_length: picked.phrase.phrase.length, masked, deadline_ms: new Date(deadline).getTime() };
}

async function startBonusRound(admin: Admin, sessionId: string, winnerUserId: string, winnerTeamId: string | null) {
  const choices = await pickRandomWheelCategories(admin, 3);
  if (choices.length === 0) {
    // Shouldn't normally happen (main rounds already proved content exists), but don't leave the game stuck.
    return jsonResponse({ error: "No categories available for the Bonus Round." }, 400);
  }

  await admin
    .from("wheel_sessions")
    .update({
      status: "bonus_category_choice",
      winner_user_id: winnerUserId,
      winner_team_id: winnerTeamId,
      bonus_category_choices: choices,
    })
    .eq("id", sessionId);

  await broadcast(admin, sessionId, "bonus_setup", { winner_user_id: winnerUserId, winner_team_id: winnerTeamId, choices });
  return null;
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
        const gameMode = body.game_mode === "team" ? "team" : "solo";
        const sessionId = crypto.randomUUID();
        const lockError = await claimSessionLock(admin, { game: "wheel", sessionId, hostId: user.id });
        if (lockError) return lockError;

        const { data: session, error } = await admin
          .from("wheel_sessions")
          .insert({ id: sessionId, host_id: user.id, status: "lobby", game_mode: gameMode })
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
        const { data: session } = await admin.from("wheel_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't remove players once the game has started" }, 409);

        const { data: removed } = await admin
          .from("wheel_participants")
          .select("team_id")
          .eq("session_id", session_id)
          .eq("user_id", user_id)
          .maybeSingle();

        await admin.from("wheel_participants").delete().eq("session_id", session_id).eq("user_id", user_id);

        if (session.game_mode === "team" && removed?.team_id) {
          const { data: teammates } = await admin
            .from("wheel_participants")
            .select("user_id, line_position")
            .eq("team_id", removed.team_id)
            .order("line_position", { ascending: true });

          if (!teammates || teammates.length === 0) {
            // Team's now empty — clean it up rather than leaving an orphaned team around.
            await admin.from("wheel_teams").delete().eq("id", removed.team_id);
          } else {
            await Promise.all(
              teammates.map((p, i) =>
                p.line_position === i ? null : admin.from("wheel_participants").update({ line_position: i }).eq("team_id", removed.team_id).eq("user_id", p.user_id)
              )
            );
          }
        } else {
          const { data: remaining } = await admin
            .from("wheel_participants")
            .select("user_id, seat_order")
            .eq("session_id", session_id)
            .order("seat_order");
          await Promise.all(
            (remaining ?? []).map((p, i) =>
              p.seat_order === i ? null : admin.from("wheel_participants").update({ seat_order: i }).eq("session_id", session_id).eq("user_id", p.user_id)
            )
          );
        }
        return jsonResponse({ ok: true });
      }

      case "start_game": {
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Game already started" }, 409);

        if (session.game_mode === "team") {
          const { data: teams } = await admin.from("wheel_teams").select("id, name").eq("session_id", session_id);
          if (!teams || teams.length < WHEEL_MIN_TEAMS) {
            return jsonResponse({ error: `Need at least ${WHEEL_MIN_TEAMS} teams to start` }, 400);
          }
          const { data: roster } = await admin.from("wheel_participants").select("team_id").eq("session_id", session_id);
          const counts = new Map<string, number>();
          for (const p of roster ?? []) {
            if (!p.team_id) continue;
            counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1);
          }
          const shortTeams = teams.filter((t) => (counts.get(t.id) ?? 0) < WHEEL_MIN_TEAM_SIZE);
          if (shortTeams.length > 0) {
            return jsonResponse({ error: `These teams need at least ${WHEEL_MIN_TEAM_SIZE} members: ${shortTeams.map((t) => t.name).join(", ")}` }, 400);
          }
        } else {
          const { data: roster } = await admin.from("wheel_participants").select("user_id").eq("session_id", session_id);
          if (!roster || roster.length < WHEEL_MIN_PLAYERS) {
            return jsonResponse({ error: `Need at least ${WHEEL_MIN_PLAYERS} players to start` }, 400);
          }
        }

        const started = await startRound(admin, session_id, 0, false, [], []);
        if ("error" in started) return started.error;

        await admin.from("wheel_sessions").update({ status: "live", started_at: new Date().toISOString() }).eq("id", session_id);
        await broadcast(admin, session_id, "game_started", { round_index: 0 });
        return jsonResponse({ ok: true });
      }

      case "advance_round": {
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live" && session.status !== "tiebreaker") {
          return jsonResponse({ error: "The game isn't in a round-based phase right now" }, 409);
        }

        const roundIndex = session.current_round_index;
        const { data: round } = await admin
          .from("wheel_rounds")
          .select("*")
          .eq("session_id", session_id)
          .eq("round_index", roundIndex)
          .single();
        if (!round) return jsonResponse({ error: "No round to advance from" }, 404);
        if (round.status === "active") return jsonResponse({ error: "This round hasn't finished yet" }, 409);

        const isTeamMode = session.game_mode === "team";

        // --- Coming out of a tiebreaker round ---
        if (session.status === "tiebreaker") {
          if (round.status === "solved" && round.solved_by_user_id) {
            const winnerTeamId = isTeamMode ? round.active_team_id : null;
            const err = await startBonusRound(admin, session_id, round.solved_by_user_id, winnerTeamId);
            if (err) return err;
            return jsonResponse({ ok: true, advanced_to: "bonus" });
          }
          // Auto-revealed with nobody solving — still tied. Try again, up to a cap.
          if (session.tiebreak_attempt >= WHEEL_MAX_TIEBREAKER_ATTEMPTS) {
            if (isTeamMode) {
              const eligible: string[] = session.tiebreak_eligible_team_ids;
              const fallbackTeamId = eligible[Math.floor(Math.random() * eligible.length)];
              const fallbackUserId = await getTeamRepUserId(admin, fallbackTeamId);
              if (!fallbackUserId) return jsonResponse({ error: "Could not determine a Bonus Round representative" }, 500);
              const err = await startBonusRound(admin, session_id, fallbackUserId, fallbackTeamId);
              if (err) return err;
              return jsonResponse({ ok: true, advanced_to: "bonus", fallback_random_winner: true });
            }
            const eligible: string[] = session.tiebreak_eligible_user_ids;
            const fallbackWinner = eligible[Math.floor(Math.random() * eligible.length)];
            const err = await startBonusRound(admin, session_id, fallbackWinner, null);
            if (err) return err;
            return jsonResponse({ ok: true, advanced_to: "bonus", fallback_random_winner: true });
          }
          const nextIndex = roundIndex + 1;
          const nextAttempt = session.tiebreak_attempt + 1;
          const startedNext = await startRound(admin, session_id, nextIndex, true, session.used_category_ids, session.used_phrase_ids);
          if ("error" in startedNext) return startedNext.error;
          await admin.from("wheel_sessions").update({ tiebreak_attempt: nextAttempt }).eq("id", session_id);
          return jsonResponse({ ok: true, advanced_to: "tiebreaker_retry" });
        }

        // --- Coming out of a normal main round ---
        if (session.current_round_index < WHEEL_MAIN_ROUNDS - 1) {
          const nextIndex = session.current_round_index + 1;
          const startedNext = await startRound(admin, session_id, nextIndex, false, session.used_category_ids, session.used_phrase_ids);
          if ("error" in startedNext) return startedNext.error;
          return jsonResponse({ ok: true, advanced_to: "next_round" });
        }

        // That was the 5th and final main round — compute standings.
        if (isTeamMode) {
          const { data: teams } = await admin.from("wheel_teams").select("id, total_points").eq("session_id", session_id);
          const sorted = [...(teams ?? [])].sort((a, b) => b.total_points - a.total_points);
          const topScore = sorted[0]?.total_points ?? 0;
          const tied = sorted.filter((t) => t.total_points === topScore);

          if (tied.length > 1) {
            const eligibleTeamIds = tied.map((t) => t.id);
            await admin
              .from("wheel_sessions")
              .update({ status: "tiebreaker", tiebreak_eligible_team_ids: eligibleTeamIds, tiebreak_attempt: 1 })
              .eq("id", session_id);
            const startedTiebreak = await startRound(admin, session_id, WHEEL_MAIN_ROUNDS, true, session.used_category_ids, session.used_phrase_ids);
            if ("error" in startedTiebreak) return startedTiebreak.error;
            await broadcast(admin, session_id, "tiebreaker_started", { eligible_team_ids: eligibleTeamIds });
            return jsonResponse({ ok: true, advanced_to: "tiebreaker" });
          }

          const winnerTeamId = tied[0].id;
          const winnerUserId = await getTeamRepUserId(admin, winnerTeamId);
          if (!winnerUserId) return jsonResponse({ error: "Could not determine a Bonus Round representative" }, 500);
          const err = await startBonusRound(admin, session_id, winnerUserId, winnerTeamId);
          if (err) return err;
          return jsonResponse({ ok: true, advanced_to: "bonus" });
        }

        const { data: participants } = await admin
          .from("wheel_participants")
          .select("user_id, total_points")
          .eq("session_id", session_id);
        const sorted = [...(participants ?? [])].sort((a, b) => b.total_points - a.total_points);
        const topScore = sorted[0]?.total_points ?? 0;
        const tied = sorted.filter((p) => p.total_points === topScore);

        if (tied.length > 1) {
          const eligibleIds = tied.map((p) => p.user_id);
          await admin
            .from("wheel_sessions")
            .update({ status: "tiebreaker", tiebreak_eligible_user_ids: eligibleIds, tiebreak_attempt: 1 })
            .eq("id", session_id);
          const startedTiebreak = await startRound(admin, session_id, WHEEL_MAIN_ROUNDS, true, session.used_category_ids, session.used_phrase_ids);
          if ("error" in startedTiebreak) return startedTiebreak.error;
          await broadcast(admin, session_id, "tiebreaker_started", { eligible_user_ids: eligibleIds });
          return jsonResponse({ ok: true, advanced_to: "tiebreaker" });
        }

        const err = await startBonusRound(admin, session_id, tied[0].user_id, null);
        if (err) return err;
        return jsonResponse({ ok: true, advanced_to: "bonus" });
      }

      case "force_end_round": {
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "live" && session.status !== "tiebreaker") {
          return jsonResponse({ error: "No round in progress" }, 409);
        }
        const { data: round } = await admin
          .from("wheel_rounds")
          .select("*, wheel_round_secrets(phrase_text)")
          .eq("session_id", session_id)
          .eq("round_index", session.current_round_index)
          .single();
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.status !== "active") return jsonResponse({ error: "This round has already ended" }, 409);

        const { data: secret } = await admin.from("wheel_round_secrets").select("phrase_text").eq("round_id", round.id).single();
        await admin.from("wheel_rounds").update({ status: "revealed", ended_at: new Date().toISOString() }).eq("id", round.id);
        await broadcast(admin, session_id, "round_ended", {
          round_index: round.round_index,
          solved: false,
          revealed_phrase: secret?.phrase_text ?? "",
        });
        return jsonResponse({ ok: true });
      }

      case "end_session": {
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status === "ended") return jsonResponse({ error: "Session already ended" }, 409);

        await admin
          .from("wheel_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), spectator_id: null })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);
        await broadcast(admin, session_id, "session_ended", {});
        return jsonResponse({ ok: true });
      }

      case "claim_spectator": {
        const claimError = await claimSpectatorSeat(admin, { table: "wheel_sessions", sessionId: session_id, userId: user.id });
        if (claimError) return claimError;
        return jsonResponse({ ok: true });
      }

      case "release_spectator": {
        await releaseSpectatorSeat(admin, "wheel_sessions", session_id);
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
    console.error("wheel-host crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
