// impostor-play
// Members call this for every player-side action: joining the lobby,
// submitting a clue on their turn, and casting an accusation vote.
// Turn advancement, round-set transitions, and vote resolution all
// happen here, server-side — nobody's client ever computes "whose turn
// is it" or "who's accused" itself, same spirit as Feud's face-off/board
// timeout handling.
//
// Clue-giving reuses UNO's generic seat-rotation helper (nextUnoSeat) —
// it's plain modular arithmetic with no UNO-specific behavior baked in,
// so there's no reason to duplicate it here under a different name.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  nextUnoSeat,
  releaseSessionLock,
} from "../_shared/utils.ts";

const CLUE_WINDOW_MS = 45_000;
const VOTE_WINDOW_MS = 40_000;
const CLUE_MAX_LENGTH = 140;

async function broadcast(admin: ReturnType<typeof getAdminClient>, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`impostor-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

async function getRoster(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const { data } = await admin
    .from("impostor_participants")
    .select("user_id, seat_order")
    .eq("session_id", sessionId)
    .order("seat_order", { ascending: true });
  return data ?? [];
}

/**
 * Records a clue (real or timed-out) and advances state: next player's
 * turn, next round of the same set (same starter repeats), or voting
 * opens if round 2 of the set just finished. Shared by submit_clue and
 * clue_timeout so both paths move the round forward identically.
 */
async function advanceAfterClue(
  admin: ReturnType<typeof getAdminClient>,
  session: any,
  userId: string,
  clueText: string,
  timedOut: boolean
) {
  const sessionId = session.id;

  const { error: insertError } = await admin.from("impostor_clues").insert({
    session_id: sessionId,
    round_number: session.round_number,
    user_id: userId,
    clue_text: clueText,
    timed_out: timedOut,
  });
  if (insertError) {
    // A real submission and a stray timeout raced for the same turn — the
    // unique (session_id, round_number, user_id) constraint means whichever
    // lost just treats this as already-handled rather than erroring.
    if (insertError.code === "23505") return jsonResponse({ ok: true });
    console.error("impostor_clues insert failed", insertError);
    return jsonResponse({ error: "Could not save that clue" }, 500);
  }

  const roster = await getRoster(admin, sessionId);
  const N = roster.length;
  const newTurnIndex = session.turn_index + 1;

  if (newTurnIndex < N) {
    const starterSeat = roster.find((p) => p.user_id === session.round_set_starter_user_id)?.seat_order ?? 0;
    const nextSeat = nextUnoSeat(starterSeat, 1, N, newTurnIndex);
    const nextUser = roster[nextSeat]?.user_id ?? null;
    const clueDeadline = new Date(Date.now() + CLUE_WINDOW_MS).toISOString();

    await admin
      .from("impostor_sessions")
      .update({
        turn_index: newTurnIndex,
        current_turn_user_id: nextUser,
        clue_deadline: clueDeadline,
        state_version: session.state_version + 1,
      })
      .eq("id", sessionId);

    await broadcast(admin, sessionId, "clue_submitted", {
      round_number: session.round_number,
      user_id: userId,
      clue_text: clueText,
      timed_out: timedOut,
      next_turn_user_id: nextUser,
      clue_deadline_ms: new Date(clueDeadline).getTime(),
    });
    return jsonResponse({ ok: true });
  }

  // Everyone's gone this round.
  if (session.round_number % 2 === 1) {
    // Round 1 of this set just finished — round 2 repeats the SAME
    // starter (see 0012_impostor.sql's comment on round_set_starter_user_id).
    const nextRound = session.round_number + 1;
    const clueDeadline = new Date(Date.now() + CLUE_WINDOW_MS).toISOString();

    await admin
      .from("impostor_sessions")
      .update({
        round_number: nextRound,
        turn_index: 0,
        current_turn_user_id: session.round_set_starter_user_id,
        clue_deadline: clueDeadline,
        state_version: session.state_version + 1,
      })
      .eq("id", sessionId);

    await broadcast(admin, sessionId, "clue_submitted", {
      round_number: session.round_number,
      user_id: userId,
      clue_text: clueText,
      timed_out: timedOut,
      next_turn_user_id: session.round_set_starter_user_id,
      clue_deadline_ms: new Date(clueDeadline).getTime(),
    });
    return jsonResponse({ ok: true });
  }

  // Round 2 of this set just finished — voting opens.
  const voteRound = session.round_number <= 2 ? 1 : 2;
  const voteDeadline = new Date(Date.now() + VOTE_WINDOW_MS).toISOString();

  await admin
    .from("impostor_sessions")
    .update({
      status: "voting",
      current_turn_user_id: null,
      clue_deadline: null,
      vote_round: voteRound,
      vote_deadline: voteDeadline,
      state_version: session.state_version + 1,
    })
    .eq("id", sessionId);

  await broadcast(admin, sessionId, "clue_submitted", {
    round_number: session.round_number,
    user_id: userId,
    clue_text: clueText,
    timed_out: timedOut,
    next_turn_user_id: null,
    clue_deadline_ms: null,
  });
  await broadcast(admin, sessionId, "voting_started", { vote_round: voteRound, deadline_ms: new Date(voteDeadline).getTime() });
  return jsonResponse({ ok: true });
}

/**
 * Tallies impostor_votes for the current vote_round and resolves the
 * outcome:
 *   - a lone top vote-getter who IS the impostor -> crew wins
 *   - anything else (a tie, nobody voted, or a lone top vote-getter who
 *     ISN'T the impostor) on vote_round 1 -> not yet determined, a fresh
 *     round-set (3-4) starts with a new random non-impostor starter
 *   - the same "anything else" outcome on vote_round 2 (the last chance)
 *     -> the impostor wins, per the spec
 * Only ever called once voting should close (every participant voted, or
 * the deadline passed) — see submit_vote/vote_timeout below.
 */
async function resolveVote(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  // Re-read fresh rather than trusting the caller's copy — guards a race
  // between the vote that crossed the "everyone's in" threshold and a
  // stray vote_timeout call landing right after.
  const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", sessionId).single();
  if (!session || session.status !== "voting") return;

  const { data: votes } = await admin
    .from("impostor_votes")
    .select("suspect_user_id")
    .eq("session_id", sessionId)
    .eq("vote_round", session.vote_round);

  const counts = new Map<string, number>();
  for (const v of votes ?? []) counts.set(v.suspect_user_id, (counts.get(v.suspect_user_id) ?? 0) + 1);
  const tally = Array.from(counts.entries())
    .map(([user_id, count]) => ({ user_id, count }))
    .sort((a, b) => b.count - a.count);
  const totalVotes = votes?.length ?? 0;

  // A lone top vote-getter wins the plurality; a tie at the top means no
  // accusation was actually reached.
  const accusedUserId = tally.length > 0 && (tally.length === 1 || tally[0].count > tally[1].count) ? tally[0].user_id : null;

  const { data: secret } = await admin.from("impostor_secrets").select("*").eq("session_id", sessionId).single();
  const impostorUserId: string | null = secret?.impostor_user_id ?? null;
  const secretWord: string = secret?.secret_word ?? "";

  const isFinalVote = session.vote_round === 2;
  const correctAccusation = accusedUserId !== null && accusedUserId === impostorUserId;

  // Persisted so the breakdown is still visible if a player refreshes or
  // reconnects after the game already ended, not just for whoever was
  // live and connected at the moment of the broadcast — see
  // 0014_impostor_vote_tally.sql.
  const finalVoteTally = { vote_round: session.vote_round, tally, total_votes: totalVotes, accused_user_id: accusedUserId };

  if (correctAccusation) {
    await admin
      .from("impostor_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        completed: true,
        winner: "crew",
        revealed_impostor_user_id: impostorUserId,
        revealed_secret_word: secretWord,
        final_vote_tally: finalVoteTally,
        current_turn_user_id: null,
        clue_deadline: null,
        vote_deadline: null,
        spectator_id: null,
        state_version: session.state_version + 1,
      })
      .eq("id", sessionId);
    await releaseSessionLock(admin, sessionId);
    await broadcast(admin, sessionId, "vote_resolved", {
      vote_round: session.vote_round,
      tally,
      total_votes: totalVotes,
      accused_user_id: accusedUserId,
      outcome: "crew_win",
    });
    await broadcast(admin, sessionId, "game_ended", { winner: "crew", impostor_user_id: impostorUserId, secret_word: secretWord });
    return;
  }

  if (isFinalVote) {
    await admin
      .from("impostor_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        completed: true,
        winner: "impostor",
        revealed_impostor_user_id: impostorUserId,
        revealed_secret_word: secretWord,
        final_vote_tally: finalVoteTally,
        current_turn_user_id: null,
        clue_deadline: null,
        vote_deadline: null,
        spectator_id: null,
        state_version: session.state_version + 1,
      })
      .eq("id", sessionId);
    await releaseSessionLock(admin, sessionId);
    await broadcast(admin, sessionId, "vote_resolved", {
      vote_round: session.vote_round,
      tally,
      total_votes: totalVotes,
      accused_user_id: accusedUserId,
      outcome: "impostor_win",
    });
    await broadcast(admin, sessionId, "game_ended", { winner: "impostor", impostor_user_id: impostorUserId, secret_word: secretWord });
    return;
  }

  // Not determined after round-set 1 — a fresh random (non-impostor)
  // starter opens round-set 2, per the spec ("again with a random member
  // starting instead of continuing from the previous one").
  const { data: roster } = await admin.from("impostor_participants").select("user_id").eq("session_id", sessionId);
  const eligibleStarters = (roster ?? []).map((p) => p.user_id).filter((id) => id !== impostorUserId);
  const nextStarter = eligibleStarters[Math.floor(Math.random() * eligibleStarters.length)] ?? (roster ?? [])[0]?.user_id ?? null;
  const clueDeadline = new Date(Date.now() + CLUE_WINDOW_MS).toISOString();

  await admin
    .from("impostor_sessions")
    .update({
      status: "clue_giving",
      round_number: 3,
      turn_index: 0,
      round_set_starter_user_id: nextStarter,
      current_turn_user_id: nextStarter,
      clue_deadline: clueDeadline,
      vote_round: null,
      vote_deadline: null,
      state_version: session.state_version + 1,
    })
    .eq("id", sessionId);

  await broadcast(admin, sessionId, "vote_resolved", {
    vote_round: session.vote_round,
    tally,
    total_votes: totalVotes,
    accused_user_id: accusedUserId,
    outcome: "continue",
  });
  await broadcast(admin, sessionId, "next_round_set_started", { round_number: 3, starter_user_id: nextStarter });
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
      case "join_game": {
        const { data: session } = await admin.from("impostor_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "This game has already started" }, 409);

        const { data: existing } = await admin
          .from("impostor_participants")
          .select("id")
          .eq("session_id", session_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) return jsonResponse({ ok: true }); // already joined (e.g. page refresh)

        const { count } = await admin.from("impostor_participants").select("id", { count: "exact", head: true }).eq("session_id", session_id);
        const { error } = await admin.from("impostor_participants").insert({ session_id, user_id: user.id, seat_order: count ?? 0 });
        if (error) {
          console.error("impostor join failed", error);
          return jsonResponse({ error: "Could not join" }, 500);
        }
        return jsonResponse({ ok: true });
      }

      case "submit_clue": {
        const { clue_text, expected_version } = body;
        const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "clue_giving") return jsonResponse({ error: "Clue-giving isn't active right now" }, 409);
        if (session.current_turn_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 409);
        if (typeof expected_version === "number" && expected_version !== session.state_version) {
          return jsonResponse({ error: "The round already moved on — refreshing" }, 409);
        }

        const trimmed = String(clue_text ?? "").trim().slice(0, CLUE_MAX_LENGTH);
        if (!trimmed) return jsonResponse({ error: "Type a clue first" }, 400);

        return await advanceAfterClue(admin, session, user.id, trimmed, false);
      }

      case "clue_timeout": {
        const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "clue_giving") return jsonResponse({ ok: true }); // already moved on
        if (!session.clue_deadline || Date.now() < new Date(session.clue_deadline).getTime() - 1000) {
          return jsonResponse({ error: "Not expired yet" }, 409);
        }
        if (!session.current_turn_user_id) return jsonResponse({ ok: true });
        return await advanceAfterClue(admin, session, session.current_turn_user_id, "", true);
      }

      case "submit_vote": {
        const { suspect_user_id } = body;
        const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "voting") return jsonResponse({ error: "Voting isn't open right now" }, 409);
        if (!suspect_user_id) return jsonResponse({ error: "Pick who you suspect" }, 400);
        if (suspect_user_id === user.id) return jsonResponse({ error: "You can't vote for yourself" }, 400);

        const { data: roster } = await admin.from("impostor_participants").select("user_id").eq("session_id", session_id);
        if (!(roster ?? []).some((p) => p.user_id === suspect_user_id)) {
          return jsonResponse({ error: "That's not a player in this game" }, 400);
        }

        const { error: insertError } = await admin
          .from("impostor_votes")
          .insert({ session_id, vote_round: session.vote_round, voter_user_id: user.id, suspect_user_id });
        if (insertError) {
          if (insertError.code === "23505") return jsonResponse({ error: "You already voted this round" }, 409);
          console.error("impostor vote insert failed", insertError);
          return jsonResponse({ error: "Could not save your vote" }, 500);
        }

        const { count: votedCount } = await admin
          .from("impostor_votes")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session_id)
          .eq("vote_round", session.vote_round);
        const totalCount = (roster ?? []).length;

        await broadcast(admin, session_id, "vote_cast", { voted_count: votedCount ?? 0, total_count: totalCount });

        if ((votedCount ?? 0) >= totalCount) {
          await resolveVote(admin, session_id);
        }
        return jsonResponse({ ok: true });
      }

      case "vote_timeout": {
        const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "voting") return jsonResponse({ ok: true }); // already resolved
        if (!session.vote_deadline || Date.now() < new Date(session.vote_deadline).getTime() - 1000) {
          return jsonResponse({ error: "Not expired yet" }, 409);
        }
        await resolveVote(admin, session_id);
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("impostor-play crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
