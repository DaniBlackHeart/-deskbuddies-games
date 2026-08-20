// wheel-play
// Members call this for every player-side action: joining the lobby,
// buzzing in, spinning, calling consonants, buying vowels, attempting to
// solve, and (for whoever wins the main game) the Bonus Round. Grading
// and the wheel's RNG all happen here, server-side, using the
// service-role client — the real phrase text never reaches a browser
// before its letters are revealed.
//
// Turn-phase state machine, per round (see 0017_wheel_of_fortune.sql for
// the column shapes):
//   buzz_open            -> anyone eligible can buzz; winner becomes active_user_id
//   awaiting_action      -> active player chooses: spin / buy_vowel / start_solve_attempt
//   awaiting_consonant   -> a wedge was just landed on; active player must call_consonant
//   awaiting_mystery_choice -> landed on Mystery; active player picks take vs. risk
//   awaiting_solve_guess -> active player declared a solve attempt; 15s to submit_solve
//
// A wrong consonant guess, a wrong solve, Bankrupt, or Lose a Turn all end
// the active player's turn via resolveTurnEnd: they're added to
// locked_out_user_ids and the buzzer reopens for everyone else. ANY
// correct consonant guess clears locked_out_user_ids entirely (see the
// migration's header comment for why). If resolveTurnEnd finds that would
// lock out every remaining eligible player, the round auto-reveals
// instead of reopening a buzzer nobody can answer.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  spinWheel,
  maskWheelPhrase,
  countWheelLetterOccurrences,
  isWheelPhraseFullyRevealed,
  wheelPhraseMatches,
  WHEEL_VOWELS,
  WHEEL_CONSONANTS,
  WHEEL_VOWEL_COST,
  WHEEL_MYSTERY_FACE_VALUE,
  WHEEL_MYSTERY_BONUS_VALUE,
  WHEEL_MYSTERY_RISK_WIN_CHANCE,
  WHEEL_MAX_PLAYERS,
  WHEEL_BUZZ_WINDOW_MS,
  WHEEL_ACTION_WINDOW_MS,
  WHEEL_SOLVE_WINDOW_MS,
  WHEEL_BONUS_SOLVE_WINDOW_MS,
  WHEEL_BONUS_GIVEN_LETTERS,
  WHEEL_BONUS_PRIZE_POOL,
  type WheelWedge,
} from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

async function broadcast(admin: Admin, sessionId: string, event: string, payload: unknown) {
  const channel = admin.channel(`wheel-session-${sessionId}`);
  await channel.send({ type: "broadcast", event, payload });
}

async function getActiveRound(admin: Admin, sessionId: string) {
  const { data } = await admin
    .from("wheel_rounds")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "active")
    .order("round_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getRoundSecret(admin: Admin, roundId: string): Promise<string> {
  const { data } = await admin.from("wheel_round_secrets").select("phrase_text").eq("round_id", roundId).single();
  return data?.phrase_text ?? "";
}

async function eligibleUserIds(admin: Admin, sessionId: string, session: { status: string; tiebreak_eligible_user_ids: string[] }): Promise<string[]> {
  if (session.status === "tiebreaker") return session.tiebreak_eligible_user_ids;
  const { data } = await admin.from("wheel_participants").select("user_id").eq("session_id", sessionId);
  return (data ?? []).map((p) => p.user_id);
}

/**
 * Ends the active player's turn: adds them to the lockout list, and either
 * reopens the buzzer for everyone else or — if that would lock out every
 * remaining eligible player — reveals the phrase and closes the round out.
 * Returns the broadcast payload the caller should send after its own
 * scoring updates.
 */
async function resolveTurnEnd(
  admin: Admin,
  sessionId: string,
  round: any,
  endingUserId: string,
  session: { status: string; tiebreak_eligible_user_ids: string[] }
): Promise<{ revealed: boolean; phrase_text?: string; deadline_ms?: number }> {
  const eligible = await eligibleUserIds(admin, sessionId, session);
  const newLockedOut = Array.from(new Set([...round.locked_out_user_ids, endingUserId]));

  if (newLockedOut.length >= eligible.length) {
    const phraseText = await getRoundSecret(admin, round.id);
    await admin
      .from("wheel_rounds")
      .update({ status: "revealed", ended_at: new Date().toISOString(), active_user_id: null, turn_phase: "buzz_open", locked_out_user_ids: newLockedOut })
      .eq("id", round.id);
    await broadcast(admin, sessionId, "round_ended", { round_index: round.round_index, solved: false, revealed_phrase: phraseText });
    return { revealed: true, phrase_text: phraseText };
  }

  const deadline = new Date(Date.now() + WHEEL_BUZZ_WINDOW_MS).toISOString();
  await admin
    .from("wheel_rounds")
    .update({
      active_user_id: null,
      turn_phase: "buzz_open",
      turn_deadline: deadline,
      locked_out_user_ids: newLockedOut,
      pending_wedge: null,
      free_play_active: false,
    })
    .eq("id", round.id);
  await broadcast(admin, sessionId, "turn_ended", { ending_user_id: endingUserId, locked_out_user_ids: newLockedOut, buzz_deadline_ms: new Date(deadline).getTime() });
  return { revealed: false, deadline_ms: new Date(deadline).getTime() };
}

/** Bank round_scores[solverId] into their session total, mark the round solved, and broadcast the reveal. */
async function resolveSolve(admin: Admin, sessionId: string, round: any, solverId: string) {
  const phraseText = await getRoundSecret(admin, round.id);
  const roundScores = (round.round_scores ?? {}) as Record<string, number>;
  const wonPoints = roundScores[solverId] ?? 0;

  await admin.from("wheel_rounds").update({ status: "solved", solved_by_user_id: solverId, ended_at: new Date().toISOString(), active_user_id: null }).eq("id", round.id);

  const { data: participant } = await admin.from("wheel_participants").select("total_points").eq("session_id", sessionId).eq("user_id", solverId).single();
  const newTotal = (participant?.total_points ?? 0) + wonPoints;
  await admin.from("wheel_participants").update({ total_points: newTotal }).eq("session_id", sessionId).eq("user_id", solverId);

  await broadcast(admin, sessionId, "round_ended", {
    round_index: round.round_index,
    solved: true,
    solved_by_user_id: solverId,
    points_won: wonPoints,
    revealed_phrase: phraseText,
  });
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
        const { data: session } = await admin.from("wheel_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't join — the game has already started" }, 409);

        const { count } = await admin.from("wheel_participants").select("id", { count: "exact", head: true }).eq("session_id", session_id);
        const { data: already } = await admin.from("wheel_participants").select("id").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
        if (!already && (count ?? 0) >= WHEEL_MAX_PLAYERS) {
          return jsonResponse({ error: `This game is full (max ${WHEEL_MAX_PLAYERS} players)` }, 409);
        }

        const { error } = await admin
          .from("wheel_participants")
          .upsert({ session_id, user_id: user.id, seat_order: count ?? 0 }, { onConflict: "session_id,user_id" });
        if (error) return jsonResponse({ error: "Could not join" }, 500);
        return jsonResponse({ ok: true });
      }

      case "leave_lobby": {
        const { data: session } = await admin.from("wheel_sessions").select("status").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't leave once the game has started" }, 409);
        await admin.from("wheel_participants").delete().eq("session_id", session_id).eq("user_id", user.id);
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // Buzz-in
      // ---------------------------------------------------------------
      case "buzz": {
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.turn_phase !== "buzz_open") return jsonResponse({ error: "The buzzer isn't open right now" }, 409);

        const eligible = await eligibleUserIds(admin, session_id, session);
        if (!eligible.includes(user.id)) return jsonResponse({ error: "You're not eligible to buzz in this round" }, 403);
        if (round.locked_out_user_ids.includes(user.id)) return jsonResponse({ error: "You're locked out until someone else guesses correctly" }, 403);

        const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
        // Atomic claim: only succeeds if nobody's won the buzz yet.
        const { data: claimed } = await admin
          .from("wheel_rounds")
          .update({ active_user_id: user.id, turn_phase: "awaiting_action", turn_deadline: deadline })
          .eq("id", round.id)
          .eq("turn_phase", "buzz_open")
          .is("active_user_id", null)
          .select()
          .maybeSingle();

        if (!claimed) return jsonResponse({ error: "Too slow — someone else buzzed first!" }, 409);

        await broadcast(admin, session_id, "buzz_won", { user_id: user.id, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ ok: true, deadline_ms: new Date(deadline).getTime() });
      }

      case "buzz_timeout": {
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.turn_phase !== "buzz_open") return jsonResponse({ error: "The buzzer has already been won" }, 409);
        if (!round.turn_deadline || Date.now() < new Date(round.turn_deadline).getTime()) {
          return jsonResponse({ error: "Not timed out yet" }, 409);
        }
        const phraseText = await getRoundSecret(admin, round.id);
        await admin.from("wheel_rounds").update({ status: "revealed", ended_at: new Date().toISOString() }).eq("id", round.id);
        await broadcast(admin, session_id, "round_ended", { round_index: round.round_index, solved: false, revealed_phrase: phraseText });
        return jsonResponse({ ok: true });
      }

      // A generic timeout for the turn-holder failing to act at all —
      // covers awaiting_action (didn't spin/buy/solve), awaiting_consonant
      // (spun but never called a letter), and awaiting_mystery_choice
      // (never picked take-vs-risk). buzz_open and awaiting_solve_guess
      // have their own dedicated timeout actions above/below since those
      // need slightly different handling (revealing the round outright,
      // or grading an empty guess as a miss).
      case "turn_timeout": {
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (!["awaiting_action", "awaiting_consonant", "awaiting_mystery_choice"].includes(round.turn_phase)) {
          return jsonResponse({ error: "Nothing to time out right now" }, 409);
        }
        if (!round.turn_deadline || Date.now() < new Date(round.turn_deadline).getTime()) {
          return jsonResponse({ error: "Not timed out yet" }, 409);
        }
        const endingUserId = round.active_user_id;
        if (!endingUserId) return jsonResponse({ error: "No active player to time out" }, 409);
        await broadcast(admin, session_id, "turn_timed_out", { user_id: endingUserId });
        const result = await resolveTurnEnd(admin, session_id, round, endingUserId, session);
        return jsonResponse({ ok: true, revealed: result.revealed });
      }

      // ---------------------------------------------------------------
      // Turn actions: spin / buy a vowel / call a consonant / Mystery / solve
      // ---------------------------------------------------------------
      case "spin": {
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_action") return jsonResponse({ error: "You can't spin right now" }, 409);
        if (round.turn_deadline && Date.now() > new Date(round.turn_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for that turn" }, 409);
        }

        const { wedge } = spinWheel();

        if (wedge.type === "bankrupt") {
          const roundScores = { ...(round.round_scores ?? {}), [user.id]: 0 };
          await admin.from("wheel_rounds").update({ round_scores: roundScores }).eq("id", round.id);
          await broadcast(admin, session_id, "spin_result", { user_id: user.id, wedge });
          const updatedRound = { ...round, round_scores: roundScores };
          const result = await resolveTurnEnd(admin, session_id, updatedRound, user.id, session);
          return jsonResponse({ wedge, bankrupt: true, revealed: result.revealed });
        }

        if (wedge.type === "lose_turn") {
          await broadcast(admin, session_id, "spin_result", { user_id: user.id, wedge });
          const result = await resolveTurnEnd(admin, session_id, round, user.id, session);
          return jsonResponse({ wedge, lost_turn: true, revealed: result.revealed });
        }

        if (wedge.type === "mystery") {
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_mystery_choice", pending_wedge: wedge, turn_deadline: deadline }).eq("id", round.id);
          await broadcast(admin, session_id, "spin_result", { user_id: user.id, wedge, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ wedge, deadline_ms: new Date(deadline).getTime() });
        }

        // points / free_play / wild_card — all lead into calling a consonant.
        const callsRemaining = wedge.type === "wild_card" ? 2 : 1;
        const pendingWedge = { ...wedge, calls_remaining: callsRemaining };
        const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
        await admin
          .from("wheel_rounds")
          .update({
            turn_phase: "awaiting_consonant",
            pending_wedge: pendingWedge,
            turn_deadline: deadline,
            free_play_active: wedge.type === "free_play",
          })
          .eq("id", round.id);
        await broadcast(admin, session_id, "spin_result", { user_id: user.id, wedge, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ wedge, deadline_ms: new Date(deadline).getTime() });
      }

      case "mystery_choice": {
        const { choice } = body as { choice: "take" | "risk" };
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_mystery_choice") return jsonResponse({ error: "No Mystery choice pending" }, 409);
        if (round.turn_deadline && Date.now() > new Date(round.turn_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for that choice" }, 409);
        }

        if (choice === "take") {
          const pendingWedge = { type: "points" as const, value: WHEEL_MYSTERY_FACE_VALUE, calls_remaining: 1 };
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_consonant", pending_wedge: pendingWedge, turn_deadline: deadline }).eq("id", round.id);
          await broadcast(admin, session_id, "mystery_resolved", { user_id: user.id, choice, outcome: "face_value", value: WHEEL_MYSTERY_FACE_VALUE, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ ok: true, outcome: "face_value", value: WHEEL_MYSTERY_FACE_VALUE, deadline_ms: new Date(deadline).getTime() });
        }

        // Risk it.
        const won = Math.random() < WHEEL_MYSTERY_RISK_WIN_CHANCE;
        if (won) {
          const pendingWedge = { type: "points" as const, value: WHEEL_MYSTERY_BONUS_VALUE, calls_remaining: 1 };
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_consonant", pending_wedge: pendingWedge, turn_deadline: deadline }).eq("id", round.id);
          await broadcast(admin, session_id, "mystery_resolved", { user_id: user.id, choice, outcome: "big_win", value: WHEEL_MYSTERY_BONUS_VALUE, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ ok: true, outcome: "big_win", value: WHEEL_MYSTERY_BONUS_VALUE, deadline_ms: new Date(deadline).getTime() });
        }

        const roundScores = { ...(round.round_scores ?? {}), [user.id]: 0 };
        await admin.from("wheel_rounds").update({ round_scores: roundScores }).eq("id", round.id);
        await broadcast(admin, session_id, "mystery_resolved", { user_id: user.id, choice, outcome: "bankrupt" });
        const updatedRound = { ...round, round_scores: roundScores };
        const result = await resolveTurnEnd(admin, session_id, updatedRound, user.id, session);
        return jsonResponse({ ok: true, outcome: "bankrupt", revealed: result.revealed });
      }

      case "buy_vowel": {
        const { letter } = body as { letter: string };
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_action") return jsonResponse({ error: "You can't buy a vowel right now" }, 409);
        if (round.turn_deadline && Date.now() > new Date(round.turn_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for that turn" }, 409);
        }

        const upper = (letter ?? "").toUpperCase();
        if (!WHEEL_VOWELS.includes(upper)) return jsonResponse({ error: "That's not a vowel" }, 400);
        if (round.guessed_letters.includes(upper)) return jsonResponse({ error: "That letter's already been called" }, 409);

        const roundScores = round.round_scores ?? {};
        const myPoints = roundScores[user.id] ?? 0;
        if (myPoints < WHEEL_VOWEL_COST) {
          return jsonResponse({ error: `You need at least ${WHEEL_VOWEL_COST} points this round to buy a vowel` }, 400);
        }

        const phraseText = await getRoundSecret(admin, round.id);
        const occurrences = countWheelLetterOccurrences(phraseText, upper);
        const newGuessed = [...round.guessed_letters, upper];
        const newScores = { ...roundScores, [user.id]: myPoints - WHEEL_VOWEL_COST };
        const masked = maskWheelPhrase(phraseText, newGuessed);

        if (isWheelPhraseFullyRevealed(phraseText, newGuessed)) {
          await admin.from("wheel_rounds").update({ guessed_letters: newGuessed, round_scores: newScores }).eq("id", round.id);
          await broadcast(admin, session_id, "vowel_bought", { user_id: user.id, letter: upper, occurrences, masked_phrase: masked, cost: WHEEL_VOWEL_COST });
          const updatedRound = { ...round, round_scores: newScores };
          await resolveSolve(admin, session_id, updatedRound, user.id);
          return jsonResponse({ occurrences, solved: true });
        }

        const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
        await admin
          .from("wheel_rounds")
          .update({ guessed_letters: newGuessed, round_scores: newScores, turn_deadline: deadline })
          .eq("id", round.id);
        await broadcast(admin, session_id, "vowel_bought", { user_id: user.id, letter: upper, occurrences, masked_phrase: masked, cost: WHEEL_VOWEL_COST, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ occurrences, solved: false, deadline_ms: new Date(deadline).getTime() });
      }

      case "call_consonant": {
        const { letter } = body as { letter: string };
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_consonant") return jsonResponse({ error: "No consonant call pending" }, 409);
        if (round.turn_deadline && Date.now() > new Date(round.turn_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for that call" }, 409);
        }

        const upper = (letter ?? "").toUpperCase();
        if (!WHEEL_CONSONANTS.includes(upper)) return jsonResponse({ error: "That's not a consonant" }, 400);
        if (round.guessed_letters.includes(upper)) return jsonResponse({ error: "That letter's already been called" }, 409);

        const wedge = round.pending_wedge as (WheelWedge & { calls_remaining: number }) | null;
        if (!wedge || wedge.type === "bankrupt" || wedge.type === "lose_turn") {
          return jsonResponse({ error: "No consonant call pending" }, 409);
        }

        const phraseText = await getRoundSecret(admin, round.id);
        const occurrences = countWheelLetterOccurrences(phraseText, upper);
        const isHit = occurrences > 0;
        const newGuessed = [...round.guessed_letters, upper];
        const value = "value" in wedge ? wedge.value : 0;
        const roundScores = { ...(round.round_scores ?? {}) };
        if (isHit) roundScores[user.id] = (roundScores[user.id] ?? 0) + value * occurrences;
        const masked = maskWheelPhrase(phraseText, newGuessed);
        const fullyRevealed = isWheelPhraseFullyRevealed(phraseText, newGuessed);

        if (isHit) {
          // Any correct guess clears the whole lockout list, regardless of whose turn it is.
          await admin.from("wheel_rounds").update({ guessed_letters: newGuessed, round_scores: roundScores, locked_out_user_ids: [] }).eq("id", round.id);
        } else {
          await admin.from("wheel_rounds").update({ guessed_letters: newGuessed }).eq("id", round.id);
        }

        await broadcast(admin, session_id, "consonant_called", { user_id: user.id, letter: upper, hit: isHit, occurrences, value, masked_phrase: masked });

        const updatedRound = { ...round, guessed_letters: newGuessed, round_scores: roundScores, locked_out_user_ids: isHit ? [] : round.locked_out_user_ids };

        if (fullyRevealed) {
          await resolveSolve(admin, session_id, updatedRound, user.id);
          return jsonResponse({ hit: isHit, occurrences, solved: true });
        }

        const callsRemaining = (wedge.calls_remaining ?? 1) - 1;

        if (callsRemaining > 0) {
          // Wild Card's extra call — still their turn, must call again.
          const nextWedge = { ...wedge, calls_remaining: callsRemaining };
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ pending_wedge: nextWedge, turn_deadline: deadline }).eq("id", round.id);
          await broadcast(admin, session_id, "extra_call_available", { user_id: user.id, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ hit: isHit, occurrences, solved: false, extra_call: true, deadline_ms: new Date(deadline).getTime() });
        }

        if (isHit) {
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_action", pending_wedge: null, turn_deadline: deadline }).eq("id", round.id);
          return jsonResponse({ hit: true, occurrences, solved: false, deadline_ms: new Date(deadline).getTime() });
        }

        // Miss. Free Play protects this one call from ending the turn.
        if (round.free_play_active) {
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_action", pending_wedge: null, turn_deadline: deadline, free_play_active: false }).eq("id", round.id);
          await broadcast(admin, session_id, "free_play_saved", { user_id: user.id });
          return jsonResponse({ hit: false, occurrences: 0, solved: false, free_play_saved: true, deadline_ms: new Date(deadline).getTime() });
        }

        const result = await resolveTurnEnd(admin, session_id, updatedRound, user.id, session);
        return jsonResponse({ hit: false, occurrences: 0, solved: false, revealed: result.revealed });
      }

      // ---------------------------------------------------------------
      // Solve the puzzle (any point during your turn's action phase)
      // ---------------------------------------------------------------
      case "start_solve_attempt": {
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_action") return jsonResponse({ error: "You can't attempt to solve right now" }, 409);

        const deadline = new Date(Date.now() + WHEEL_SOLVE_WINDOW_MS).toISOString();
        await admin.from("wheel_rounds").update({ turn_phase: "awaiting_solve_guess", turn_deadline: deadline }).eq("id", round.id);
        await broadcast(admin, session_id, "solve_attempt_started", { user_id: user.id, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ ok: true, deadline_ms: new Date(deadline).getTime() });
      }

      case "submit_solve":
      case "solve_timeout": {
        const isTimeout = action === "solve_timeout";
        const { data: session } = await admin.from("wheel_sessions").select("status, tiebreak_eligible_user_ids").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.turn_phase !== "awaiting_solve_guess") return jsonResponse({ error: "No solve attempt pending" }, 409);
        if (!isTimeout && round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (isTimeout && (!round.turn_deadline || Date.now() < new Date(round.turn_deadline).getTime())) {
          return jsonResponse({ error: "Not timed out yet" }, 409);
        }
        if (!isTimeout && round.turn_deadline && Date.now() > new Date(round.turn_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up for that attempt" }, 409);
        }

        const solverId = round.active_user_id;
        const phraseText = await getRoundSecret(admin, round.id);
        const guessText = isTimeout ? "" : ((body.guess as string) ?? "");
        const correct = !isTimeout && wheelPhraseMatches(guessText, phraseText);

        if (correct) {
          await resolveSolve(admin, session_id, round, solverId);
          return jsonResponse({ correct: true });
        }

        await broadcast(admin, session_id, "solve_missed", { user_id: solverId, timed_out: isTimeout });
        const result = await resolveTurnEnd(admin, session_id, round, solverId, session);
        return jsonResponse({ correct: false, revealed: result.revealed });
      }

      // ---------------------------------------------------------------
      // Bonus Round (only the main game's winner may act)
      // ---------------------------------------------------------------
      case "bonus_choose_category": {
        const { category_id } = body as { category_id: string };
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "bonus_category_choice") return jsonResponse({ error: "Not choosing a category right now" }, 409);
        if (session.winner_user_id !== user.id) return jsonResponse({ error: "Only the winner plays the Bonus Round" }, 403);

        const choices = (session.bonus_category_choices ?? []) as { id: string; name: string }[];
        const picked = choices.find((c) => c.id === category_id);
        if (!picked) return jsonResponse({ error: "That's not one of your category choices" }, 400);

        const { data: phrases } = await admin.from("wheel_phrases").select("id, phrase").eq("category_id", picked.id).is("archived_at", null);
        if (!phrases || phrases.length === 0) return jsonResponse({ error: "That category has no phrases available" }, 400);
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        const prize = WHEEL_BONUS_PRIZE_POOL[Math.floor(Math.random() * WHEEL_BONUS_PRIZE_POOL.length)];

        await admin.from("wheel_bonus_secrets").upsert({ session_id, phrase_text: phrase.phrase, prize_points: prize }, { onConflict: "session_id" });
        await admin
          .from("wheel_sessions")
          .update({ status: "bonus_letter_choice", bonus_category_id: picked.id, bonus_category_name: picked.name, bonus_given_letters: WHEEL_BONUS_GIVEN_LETTERS })
          .eq("id", session_id);

        await broadcast(admin, session_id, "bonus_category_chosen", { category_name: picked.name, given_letters: WHEEL_BONUS_GIVEN_LETTERS, phrase_length: phrase.phrase.length });
        return jsonResponse({ ok: true, category_name: picked.name, phrase_length: phrase.phrase.length });
      }

      case "bonus_choose_letters": {
        const { consonants, vowel } = body as { consonants: string[]; vowel: string };
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "bonus_letter_choice") return jsonResponse({ error: "Not choosing letters right now" }, 409);
        if (session.winner_user_id !== user.id) return jsonResponse({ error: "Only the winner plays the Bonus Round" }, 403);

        const upperConsonants = Array.from(new Set((consonants ?? []).map((c) => c.toUpperCase())));
        const upperVowel = (vowel ?? "").toUpperCase();
        const given = new Set(session.bonus_given_letters);

        if (upperConsonants.length !== 3 || upperConsonants.some((c) => !WHEEL_CONSONANTS.includes(c) || given.has(c))) {
          return jsonResponse({ error: "Pick exactly 3 consonants not already given" }, 400);
        }
        if (!WHEEL_VOWELS.includes(upperVowel) || given.has(upperVowel)) {
          return jsonResponse({ error: "Pick 1 vowel not already given" }, 400);
        }

        const { data: secret } = await admin.from("wheel_bonus_secrets").select("phrase_text").eq("session_id", session_id).single();
        const phraseText = secret?.phrase_text ?? "";
        const allLetters = [...session.bonus_given_letters, ...upperConsonants, upperVowel];
        const masked = maskWheelPhrase(phraseText, allLetters);
        const deadline = new Date(Date.now() + WHEEL_BONUS_SOLVE_WINDOW_MS).toISOString();

        await admin
          .from("wheel_sessions")
          .update({ status: "bonus_solving", bonus_chosen_consonants: upperConsonants, bonus_chosen_vowel: upperVowel, bonus_deadline: deadline })
          .eq("id", session_id);

        await broadcast(admin, session_id, "bonus_board_revealed", { masked_phrase: masked, deadline_ms: new Date(deadline).getTime() });
        return jsonResponse({ ok: true, masked_phrase: masked, deadline_ms: new Date(deadline).getTime() });
      }

      case "bonus_solve":
      case "bonus_solve_timeout": {
        const isTimeout = action === "bonus_solve_timeout";
        const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "bonus_solving") return jsonResponse({ error: "Not solving the Bonus Round right now" }, 409);
        if (!isTimeout && session.winner_user_id !== user.id) return jsonResponse({ error: "Only the winner plays the Bonus Round" }, 403);
        if (isTimeout && (!session.bonus_deadline || Date.now() < new Date(session.bonus_deadline).getTime())) {
          return jsonResponse({ error: "Not timed out yet" }, 409);
        }
        if (!isTimeout && session.bonus_deadline && Date.now() > new Date(session.bonus_deadline).getTime() + 1000) {
          return jsonResponse({ error: "Time's up!" }, 409);
        }

        const { data: secret } = await admin.from("wheel_bonus_secrets").select("phrase_text, prize_points").eq("session_id", session_id).single();
        const phraseText = secret?.phrase_text ?? "";
        const guessText = isTimeout ? "" : ((body.guess as string) ?? "");
        const won = !isTimeout && wheelPhraseMatches(guessText, phraseText);
        const prize = won ? secret?.prize_points ?? 0 : 0;

        if (won) {
          const { data: participant } = await admin.from("wheel_participants").select("total_points").eq("session_id", session_id).eq("user_id", session.winner_user_id).single();
          await admin
            .from("wheel_participants")
            .update({ total_points: (participant?.total_points ?? 0) + prize })
            .eq("session_id", session_id)
            .eq("user_id", session.winner_user_id);
        }

        await admin
          .from("wheel_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), bonus_won: won, bonus_points_awarded: prize, bonus_solved_phrase: phraseText, spectator_id: null })
          .eq("id", session_id);

        await broadcast(admin, session_id, "bonus_resolved", { won, prize_points: prize, phrase: phraseText, timed_out: isTimeout });
        return jsonResponse({ won, prize_points: prize });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("wheel-play crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
