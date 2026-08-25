// wheel-play
// Members call this for every player-side action: joining the lobby (or,
// in Team mode, creating/joining a team), buzzing in, spinning, calling
// consonants, buying vowels, attempting to solve, and (for whoever wins
// the main game) the Bonus Round. Grading and the wheel's RNG all happen
// here, server-side, using the service-role client — the real phrase
// text never reaches a browser before its letters are revealed.
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
//
// Team mode (0019_wheel_team_mode.sql) layers a second level on top of
// all of that: control is held by a TEAM (active_team_id) exactly the way
// solo mode holds it by an individual, with the same buzz-to-open /
// rotate-on-miss shape, just scoped to teams (locked_out_team_ids,
// tiebreak_eligible_team_ids). WITHIN a team's held control, individual
// teammates act one at a time in strict line order — every fully-resolved
// action (not mid-sequence steps like Wild Card's second call) advances
// the acting team's current_rep_index, whether that action hit or missed.
// round_scores and the persisted total bank to the TEAM
// (wheel_teams.total_points), not any one member. `active_user_id`
// itself still means exactly what it always did in every action handler's
// authorization check — the one specific person allowed to act right
// now — so almost none of the per-action `if (round.active_user_id !==
// user.id)` checks below needed to change at all for team mode.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
  releaseSessionLock,
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
  WHEEL_MAX_TEAMS,
  WHEEL_MAX_TEAM_SIZE,
  WHEEL_BUZZ_WINDOW_MS,
  WHEEL_ACTION_WINDOW_MS,
  WHEEL_SOLVE_WINDOW_MS,
  WHEEL_BONUS_SOLVE_WINDOW_MS,
  WHEEL_BONUS_GIVEN_LETTERS,
  WHEEL_BONUS_PRIZE_POOL,
  type WheelWedge,
} from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
type SessionCtx = {
  status: string;
  game_mode: string;
  tiebreak_eligible_user_ids: string[];
  tiebreak_eligible_team_ids: string[];
};

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

// --- Solo-mode eligibility/rotation (unchanged from before team mode existed) ---

async function eligibleUserIds(admin: Admin, sessionId: string, session: SessionCtx): Promise<string[]> {
  if (session.status === "tiebreaker") return session.tiebreak_eligible_user_ids;
  const { data } = await admin.from("wheel_participants").select("user_id").eq("session_id", sessionId);
  return (data ?? []).map((p) => p.user_id);
}

/** The next eligible seat after `currentUserId`, in seat_order, wrapping around. Used for post-opening rotation — no buzzing involved. */
async function getNextEligibleUserId(admin: Admin, sessionId: string, currentUserId: string, session: SessionCtx): Promise<string | null> {
  const { data: participants } = await admin.from("wheel_participants").select("user_id").eq("session_id", sessionId).order("seat_order", { ascending: true });
  if (!participants || participants.length === 0) return null;
  const eligibleSet = new Set(await eligibleUserIds(admin, sessionId, session));
  const ordered = participants.map((p) => p.user_id).filter((id) => eligibleSet.has(id));
  if (ordered.length === 0) return null;
  const idx = ordered.indexOf(currentUserId);
  if (idx === -1) return ordered[0];
  return ordered[(idx + 1) % ordered.length];
}

// --- Team-mode eligibility/rotation ---

async function getAllTeamIds(admin: Admin, sessionId: string): Promise<string[]> {
  const { data } = await admin.from("wheel_teams").select("id").eq("session_id", sessionId).order("seat_order", { ascending: true });
  return (data ?? []).map((t) => t.id);
}

async function eligibleTeamIds(admin: Admin, sessionId: string, session: SessionCtx): Promise<string[]> {
  if (session.status === "tiebreaker") return session.tiebreak_eligible_team_ids;
  return getAllTeamIds(admin, sessionId);
}

/** The next eligible team after `currentTeamId`, in seat_order, wrapping around. Team-mode analog of getNextEligibleUserId. */
async function getNextEligibleTeamId(admin: Admin, sessionId: string, currentTeamId: string, session: SessionCtx): Promise<string | null> {
  const { data: teams } = await admin.from("wheel_teams").select("id").eq("session_id", sessionId).order("seat_order", { ascending: true });
  if (!teams || teams.length === 0) return null;
  const eligibleSet = new Set(await eligibleTeamIds(admin, sessionId, session));
  const ordered = teams.map((t) => t.id).filter((id) => eligibleSet.has(id));
  if (ordered.length === 0) return null;
  const idx = ordered.indexOf(currentTeamId);
  if (idx === -1) return ordered[0];
  return ordered[(idx + 1) % ordered.length];
}

/** Which user currently represents a team — the participant at that team's current_rep_index. Does NOT advance anything. */
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

/** Advances a team's current_rep_index to the next teammate (wrapping), persists it, and returns the NEW rep's user_id. Called after every fully-resolved action a team takes, hit or miss alike — see the file header. */
async function advanceTeamRepAndGetNext(admin: Admin, teamId: string): Promise<string | null> {
  const { data: teammates } = await admin.from("wheel_participants").select("user_id, line_position").eq("team_id", teamId).order("line_position", { ascending: true });
  if (!teammates || teammates.length === 0) return null;
  const { data: team } = await admin.from("wheel_teams").select("current_rep_index").eq("id", teamId).single();
  const currentIndex = team?.current_rep_index ?? 0;
  const nextIndex = (currentIndex + 1) % teammates.length;
  await admin.from("wheel_teams").update({ current_rep_index: nextIndex }).eq("id", teamId);
  return teammates.find((t) => t.line_position === nextIndex)?.user_id ?? teammates[0].user_id;
}

/** The key round_scores/totals should be tracked under: the team in team mode, the individual otherwise. */
function scoreKeyFor(session: SessionCtx, round: any, userId: string): string {
  return session.game_mode === "team" && round.active_team_id ? round.active_team_id : userId;
}

/**
 * Ends the active player's/team's turn. Two different modes, depending on
 * whether this round's opening buzz-off has already been won:
 *   - Not yet opened: this WAS the opening guess and it missed — add the
 *     acting individual (solo) or their team (team mode) to the lockout
 *     list and reopen the buzzer for everyone/every-team still eligible,
 *     or reveal the phrase if that would lock out everyone.
 *   - Already opened: the buzzer is done for this round. Control passes
 *     straight to the next seat/team (wrapping), who can spin immediately
 *     — no buzzing, no lockouts, exactly like the real show's seat
 *     rotation. In team mode, the just-ended team's current_rep_index
 *     also advances here (their representative's action is complete),
 *     and the NEXT team's already-queued representative is who acts.
 */
async function resolveTurnEnd(
  admin: Admin,
  sessionId: string,
  round: any,
  endingUserId: string,
  session: SessionCtx
): Promise<{ revealed: boolean; phrase_text?: string }> {
  const isTeamMode = session.game_mode === "team" && round.active_team_id;

  if (isTeamMode) {
    const endingTeamId = round.active_team_id as string;
    await advanceTeamRepAndGetNext(admin, endingTeamId); // this team's line advances regardless of the outcome

    if (round.is_opened) {
      const nextTeamId = await getNextEligibleTeamId(admin, sessionId, endingTeamId, session);
      if (!nextTeamId) {
        const phraseText = await getRoundSecret(admin, round.id);
        await admin
          .from("wheel_rounds")
          .update({ status: "revealed", ended_at: new Date().toISOString(), active_user_id: null, active_team_id: null, turn_phase: "buzz_open" })
          .eq("id", round.id);
        await broadcast(admin, sessionId, "round_ended", { round_index: round.round_index, solved: false, revealed_phrase: phraseText });
        return { revealed: true, phrase_text: phraseText };
      }
      const nextUserId = await getTeamRepUserId(admin, nextTeamId);
      await admin
        .from("wheel_rounds")
        .update({
          active_team_id: nextTeamId,
          active_user_id: nextUserId,
          turn_phase: "awaiting_action",
          turn_deadline: null,
          pending_wedge: null,
          free_play_active: false,
          locked_out_team_ids: [],
        })
        .eq("id", round.id);
      await broadcast(admin, sessionId, "turn_passed", { from_user_id: endingUserId, to_user_id: nextUserId });
      return { revealed: false };
    }

    const eligible = await eligibleTeamIds(admin, sessionId, session);
    const newLockedOut = Array.from(new Set([...round.locked_out_team_ids, endingTeamId]));

    if (newLockedOut.length >= eligible.length) {
      const phraseText = await getRoundSecret(admin, round.id);
      await admin
        .from("wheel_rounds")
        .update({ status: "revealed", ended_at: new Date().toISOString(), active_user_id: null, active_team_id: null, turn_phase: "buzz_open", locked_out_team_ids: newLockedOut })
        .eq("id", round.id);
      await broadcast(admin, sessionId, "round_ended", { round_index: round.round_index, solved: false, revealed_phrase: phraseText });
      return { revealed: true, phrase_text: phraseText };
    }

    const deadline = new Date(Date.now() + WHEEL_BUZZ_WINDOW_MS).toISOString();
    await admin
      .from("wheel_rounds")
      .update({
        active_user_id: null,
        active_team_id: null,
        turn_phase: "buzz_open",
        turn_deadline: deadline,
        locked_out_team_ids: newLockedOut,
        pending_wedge: null,
        free_play_active: false,
      })
      .eq("id", round.id);
    await broadcast(admin, sessionId, "turn_ended", { ending_user_id: endingUserId, locked_out_team_ids: newLockedOut, buzz_deadline_ms: new Date(deadline).getTime() });
    return { revealed: false };
  }

  // --- Solo mode (unchanged) ---
  if (round.is_opened) {
    const nextUserId = await getNextEligibleUserId(admin, sessionId, endingUserId, session);
    if (!nextUserId) {
      const phraseText = await getRoundSecret(admin, round.id);
      await admin
        .from("wheel_rounds")
        .update({ status: "revealed", ended_at: new Date().toISOString(), active_user_id: null, turn_phase: "buzz_open" })
        .eq("id", round.id);
      await broadcast(admin, sessionId, "round_ended", { round_index: round.round_index, solved: false, revealed_phrase: phraseText });
      return { revealed: true, phrase_text: phraseText };
    }

    await admin
      .from("wheel_rounds")
      .update({
        active_user_id: nextUserId,
        turn_phase: "awaiting_action",
        turn_deadline: null,
        pending_wedge: null,
        free_play_active: false,
        locked_out_user_ids: [],
      })
      .eq("id", round.id);
    await broadcast(admin, sessionId, "turn_passed", { from_user_id: endingUserId, to_user_id: nextUserId });
    return { revealed: false };
  }

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
  return { revealed: false };
}

/**
 * Resolves a hit (or a Free-Play-protected miss) that keeps control with
 * the same team/player, transitioning back to awaiting_action. In solo
 * mode the same individual continues; in team mode control stays with the
 * same TEAM but advances to that team's next representative — see the
 * file header for why.
 */
async function continueControl(admin: Admin, round: any, session: SessionCtx): Promise<string> {
  if (session.game_mode === "team" && round.active_team_id) {
    const next = await advanceTeamRepAndGetNext(admin, round.active_team_id);
    return next ?? round.active_user_id;
  }
  return round.active_user_id;
}

/** Bank round_scores[scoreKey] into the team's or player's persisted total, mark the round solved, and broadcast the reveal. */
async function resolveSolve(admin: Admin, sessionId: string, round: any, solverId: string, session: SessionCtx) {
  const phraseText = await getRoundSecret(admin, round.id);
  const roundScores = (round.round_scores ?? {}) as Record<string, number>;
  const scoreKey = scoreKeyFor(session, round, solverId);
  const wonPoints = roundScores[scoreKey] ?? 0;

  await admin
    .from("wheel_rounds")
    .update({ status: "solved", solved_by_user_id: solverId, ended_at: new Date().toISOString(), active_user_id: null, active_team_id: null })
    .eq("id", round.id);

  if (session.game_mode === "team" && round.active_team_id) {
    const { data: team } = await admin.from("wheel_teams").select("total_points").eq("id", round.active_team_id).single();
    await admin.from("wheel_teams").update({ total_points: (team?.total_points ?? 0) + wonPoints }).eq("id", round.active_team_id);
  } else {
    const { data: participant } = await admin.from("wheel_participants").select("total_points").eq("session_id", sessionId).eq("user_id", solverId).single();
    await admin.from("wheel_participants").update({ total_points: (participant?.total_points ?? 0) + wonPoints }).eq("session_id", sessionId).eq("user_id", solverId);
  }

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
      // Lobby — solo mode
      // ---------------------------------------------------------------
      case "join_game": {
        const { data: session } = await admin.from("wheel_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't join — the game has already started" }, 409);
        if (session.game_mode === "team") return jsonResponse({ error: "This is a Team mode game — create or join a team instead" }, 409);

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
        const { data: session } = await admin.from("wheel_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't leave once the game has started" }, 409);

        const { data: mine } = await admin.from("wheel_participants").select("team_id").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
        await admin.from("wheel_participants").delete().eq("session_id", session_id).eq("user_id", user.id);

        if (session.game_mode === "team" && mine?.team_id) {
          const { data: teammates } = await admin
            .from("wheel_participants")
            .select("user_id, line_position")
            .eq("team_id", mine.team_id)
            .order("line_position", { ascending: true });
          if (!teammates || teammates.length === 0) {
            await admin.from("wheel_teams").delete().eq("id", mine.team_id);
          } else {
            await Promise.all(
              teammates.map((p, i) =>
                p.line_position === i ? null : admin.from("wheel_participants").update({ line_position: i }).eq("team_id", mine.team_id).eq("user_id", p.user_id)
              )
            );
          }
        }
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // Lobby — team mode. Teams are self-picked at join time, not
      // MOD-assigned: create a new one, or join an existing one with room.
      // ---------------------------------------------------------------
      case "create_team": {
        const { name } = body as { name: string };
        const { data: session } = await admin.from("wheel_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't create a team once the game has started" }, 409);
        if (session.game_mode !== "team") return jsonResponse({ error: "This isn't a Team mode game" }, 409);

        const trimmedName = (name ?? "").trim();
        if (!trimmedName) return jsonResponse({ error: "Give your team a name" }, 400);

        const { data: already } = await admin.from("wheel_participants").select("id").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
        if (already) return jsonResponse({ error: "You're already on a team in this game" }, 409);

        const { count } = await admin.from("wheel_teams").select("id", { count: "exact", head: true }).eq("session_id", session_id);
        if ((count ?? 0) >= WHEEL_MAX_TEAMS) {
          return jsonResponse({ error: `This game already has the maximum of ${WHEEL_MAX_TEAMS} teams` }, 409);
        }

        const { data: team, error: teamError } = await admin
          .from("wheel_teams")
          .insert({ session_id, name: trimmedName, seat_order: count ?? 0 })
          .select()
          .single();
        if (teamError || !team) {
          return jsonResponse({ error: teamError?.code === "23505" ? "A team with that name already exists" : "Could not create that team" }, teamError?.code === "23505" ? 409 : 500);
        }

        const { count: totalParticipants } = await admin.from("wheel_participants").select("id", { count: "exact", head: true }).eq("session_id", session_id);
        await admin.from("wheel_participants").insert({ session_id, user_id: user.id, seat_order: totalParticipants ?? 0, team_id: team.id, line_position: 0 });
        return jsonResponse({ ok: true, team });
      }

      case "join_team": {
        const { team_id } = body as { team_id: string };
        const { data: session } = await admin.from("wheel_sessions").select("status, game_mode").eq("id", session_id).single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        if (session.status !== "lobby") return jsonResponse({ error: "Can't join a team once the game has started" }, 409);
        if (session.game_mode !== "team") return jsonResponse({ error: "This isn't a Team mode game" }, 409);

        const { data: already } = await admin.from("wheel_participants").select("id").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
        if (already) return jsonResponse({ error: "You're already on a team in this game" }, 409);

        const { data: team } = await admin.from("wheel_teams").select("id").eq("id", team_id).eq("session_id", session_id).maybeSingle();
        if (!team) return jsonResponse({ error: "That team doesn't exist" }, 404);

        const { count } = await admin.from("wheel_participants").select("id", { count: "exact", head: true }).eq("team_id", team_id);
        if ((count ?? 0) >= WHEEL_MAX_TEAM_SIZE) {
          return jsonResponse({ error: `That team is full (max ${WHEEL_MAX_TEAM_SIZE})` }, 409);
        }

        const { count: totalParticipants } = await admin.from("wheel_participants").select("id", { count: "exact", head: true }).eq("session_id", session_id);
        await admin.from("wheel_participants").insert({ session_id, user_id: user.id, seat_order: totalParticipants ?? 0, team_id, line_position: count ?? 0 });
        return jsonResponse({ ok: true });
      }

      // ---------------------------------------------------------------
      // Buzz-in — a plain floor claim, no letter attached. Winning it
      // hands you (or, in team mode, your team) the "guessing phase": you
      // must call a consonant next (handled by call_consonant below, with
      // pending_wedge left null so that first call scores no points —
      // nothing's been spun yet). Only once THAT call comes back correct
      // does "the guessing phase" end and spinning become available. A
      // wrong call there ends the turn and reopens the buzzer for
      // everyone/every-team else, same as any other miss.
      //
      // Team mode: only the CURRENT representative of a non-locked-out,
      // eligible team may buzz — teammates further back in line can't
      // jump the queue just because they're faster to click.
      // ---------------------------------------------------------------
      case "buzz": {
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.turn_phase !== "buzz_open") return jsonResponse({ error: "The buzzer isn't open right now" }, 409);

        if (session.game_mode === "team") {
          const { data: participant } = await admin.from("wheel_participants").select("team_id, line_position").eq("session_id", session_id).eq("user_id", user.id).maybeSingle();
          if (!participant?.team_id) return jsonResponse({ error: "You're not on a team in this game" }, 403);
          const { data: team } = await admin.from("wheel_teams").select("current_rep_index").eq("id", participant.team_id).single();
          if (!team || participant.line_position !== team.current_rep_index) {
            return jsonResponse({ error: "It's not your turn to represent your team right now" }, 403);
          }
          const eligible = await eligibleTeamIds(admin, session_id, session);
          if (!eligible.includes(participant.team_id)) return jsonResponse({ error: "Your team isn't eligible to buzz in this round" }, 403);
          if (round.locked_out_team_ids.includes(participant.team_id)) return jsonResponse({ error: "Your team is locked out until another team guesses correctly" }, 403);

          const { data: claimed } = await admin
            .from("wheel_rounds")
            .update({ active_user_id: user.id, active_team_id: participant.team_id, turn_phase: "awaiting_consonant", pending_wedge: null })
            .eq("id", round.id)
            .eq("turn_phase", "buzz_open")
            .is("active_user_id", null)
            .select()
            .maybeSingle();
          if (!claimed) return jsonResponse({ error: "Too slow — someone else buzzed first!" }, 409);
          return jsonResponse({ ok: true });
        }

        const eligible = await eligibleUserIds(admin, session_id, session);
        if (!eligible.includes(user.id)) return jsonResponse({ error: "You're not eligible to buzz in this round" }, 403);
        if (round.locked_out_user_ids.includes(user.id)) return jsonResponse({ error: "You're locked out until someone else guesses correctly" }, 403);

        const { data: claimed } = await admin
          .from("wheel_rounds")
          .update({ active_user_id: user.id, turn_phase: "awaiting_consonant", pending_wedge: null })
          .eq("id", round.id)
          .eq("turn_phase", "buzz_open")
          .is("active_user_id", null)
          .select()
          .maybeSingle();
        if (!claimed) return jsonResponse({ error: "Too slow — someone else buzzed first!" }, 409);
        return jsonResponse({ ok: true });
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
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
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
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_action") return jsonResponse({ error: "You can't spin right now" }, 409);

        const { wedge } = spinWheel();

        if (wedge.type === "bankrupt") {
          const scoreKey = scoreKeyFor(session, round, user.id);
          const roundScores = { ...(round.round_scores ?? {}), [scoreKey]: 0 };
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
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
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

        const scoreKey = scoreKeyFor(session, round, user.id);
        const roundScores = { ...(round.round_scores ?? {}), [scoreKey]: 0 };
        await admin.from("wheel_rounds").update({ round_scores: roundScores }).eq("id", round.id);
        await broadcast(admin, session_id, "mystery_resolved", { user_id: user.id, choice, outcome: "bankrupt" });
        const updatedRound = { ...round, round_scores: roundScores };
        const result = await resolveTurnEnd(admin, session_id, updatedRound, user.id, session);
        return jsonResponse({ ok: true, outcome: "bankrupt", revealed: result.revealed });
      }

      case "buy_vowel": {
        const { letter } = body as { letter: string };
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
        if (!session) return jsonResponse({ error: "Session not found" }, 404);
        const round = await getActiveRound(admin, session_id);
        if (!round) return jsonResponse({ error: "No round in progress" }, 404);
        if (round.active_user_id !== user.id) return jsonResponse({ error: "It's not your turn" }, 403);
        if (round.turn_phase !== "awaiting_action") return jsonResponse({ error: "You can't buy a vowel right now" }, 409);

        const upper = (letter ?? "").toUpperCase();
        if (!WHEEL_VOWELS.includes(upper)) return jsonResponse({ error: "That's not a vowel" }, 400);
        if (round.guessed_letters.includes(upper)) return jsonResponse({ error: "That letter's already been called" }, 409);

        const scoreKey = scoreKeyFor(session, round, user.id);
        const roundScores = round.round_scores ?? {};
        const stake = roundScores[scoreKey] ?? 0;
        if (stake < WHEEL_VOWEL_COST) {
          return jsonResponse({ error: `You need at least ${WHEEL_VOWEL_COST} points this round to buy a vowel` }, 400);
        }

        const phraseText = await getRoundSecret(admin, round.id);
        const occurrences = countWheelLetterOccurrences(phraseText, upper);
        const newGuessed = [...round.guessed_letters, upper];
        const newScores = { ...roundScores, [scoreKey]: stake - WHEEL_VOWEL_COST };
        const masked = maskWheelPhrase(phraseText, newGuessed);

        if (isWheelPhraseFullyRevealed(phraseText, newGuessed)) {
          await admin.from("wheel_rounds").update({ guessed_letters: newGuessed, round_scores: newScores }).eq("id", round.id);
          await broadcast(admin, session_id, "vowel_bought", { user_id: user.id, letter: upper, occurrences, masked_phrase: masked, cost: WHEEL_VOWEL_COST });
          const updatedRound = { ...round, round_scores: newScores };
          await resolveSolve(admin, session_id, updatedRound, user.id, session);
          return jsonResponse({ occurrences, solved: true });
        }

        const nextUserId = await continueControl(admin, round, session);
        await admin
          .from("wheel_rounds")
          .update({ guessed_letters: newGuessed, round_scores: newScores, turn_deadline: null, active_user_id: nextUserId })
          .eq("id", round.id);
        await broadcast(admin, session_id, "vowel_bought", { user_id: user.id, letter: upper, occurrences, masked_phrase: masked, cost: WHEEL_VOWEL_COST });
        return jsonResponse({ occurrences, solved: false });
      }

      case "call_consonant": {
        const { letter } = body as { letter: string };
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
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
        if (wedge && (wedge.type === "bankrupt" || wedge.type === "lose_turn")) {
          return jsonResponse({ error: "No consonant call pending" }, 409);
        }
        // wedge === null means this is the post-buzz "guessing phase" call
        // — no spin has happened yet, so a hit earns no points. It only
        // reveals the letter and, on success, ends the guessing phase and
        // opens up the normal action menu (which includes spinning, to
        // actually start scoring subsequent letters).

        const phraseText = await getRoundSecret(admin, round.id);
        const occurrences = countWheelLetterOccurrences(phraseText, upper);
        const isHit = occurrences > 0;
        const newGuessed = [...round.guessed_letters, upper];
        const value = wedge && "value" in wedge ? wedge.value : 0;
        const scoreKey = scoreKeyFor(session, round, user.id);
        const roundScores = { ...(round.round_scores ?? {}) };
        if (isHit) roundScores[scoreKey] = (roundScores[scoreKey] ?? 0) + value * occurrences;
        const masked = maskWheelPhrase(phraseText, newGuessed);
        const fullyRevealed = isWheelPhraseFullyRevealed(phraseText, newGuessed);
        const isTeamMode = session.game_mode === "team" && round.active_team_id;
        const lockoutClearField = isTeamMode ? { locked_out_team_ids: [] } : { locked_out_user_ids: [] };

        if (isHit) {
          // Any correct guess clears the whole lockout list, regardless of whose turn it is.
          // is_opened flips permanently true here (harmless to re-set on later hits) — once
          // any guess lands, the buzzer is done for this round; see resolveTurnEnd.
          await admin.from("wheel_rounds").update({ guessed_letters: newGuessed, round_scores: roundScores, ...lockoutClearField, is_opened: true }).eq("id", round.id);
        } else {
          await admin.from("wheel_rounds").update({ guessed_letters: newGuessed }).eq("id", round.id);
        }

        await broadcast(admin, session_id, "consonant_called", { user_id: user.id, letter: upper, hit: isHit, occurrences, value, masked_phrase: masked });

        const updatedRound = {
          ...round,
          guessed_letters: newGuessed,
          round_scores: roundScores,
          locked_out_user_ids: isHit && !isTeamMode ? [] : round.locked_out_user_ids,
          locked_out_team_ids: isHit && isTeamMode ? [] : round.locked_out_team_ids,
          is_opened: isHit ? true : round.is_opened,
        };

        if (fullyRevealed) {
          await resolveSolve(admin, session_id, updatedRound, user.id, session);
          return jsonResponse({ hit: isHit, occurrences, solved: true });
        }

        const callsRemaining = wedge ? (wedge.calls_remaining ?? 1) - 1 : 0;

        if (callsRemaining > 0) {
          // Wild Card's extra call — still the SAME person's turn (this is one combined action-sequence), must call again.
          const nextWedge = { ...wedge, calls_remaining: callsRemaining };
          const deadline = new Date(Date.now() + WHEEL_ACTION_WINDOW_MS).toISOString();
          await admin.from("wheel_rounds").update({ pending_wedge: nextWedge, turn_deadline: deadline }).eq("id", round.id);
          await broadcast(admin, session_id, "extra_call_available", { user_id: user.id, deadline_ms: new Date(deadline).getTime() });
          return jsonResponse({ hit: isHit, occurrences, solved: false, extra_call: true, deadline_ms: new Date(deadline).getTime() });
        }

        if (isHit) {
          const nextUserId = await continueControl(admin, updatedRound, session);
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_action", pending_wedge: null, turn_deadline: null, active_user_id: nextUserId }).eq("id", round.id);
          return jsonResponse({ hit: true, occurrences, solved: false });
        }

        // Miss. Free Play protects this one call from ending the turn.
        if (round.free_play_active) {
          const nextUserId = await continueControl(admin, updatedRound, session);
          await admin.from("wheel_rounds").update({ turn_phase: "awaiting_action", pending_wedge: null, turn_deadline: null, free_play_active: false, active_user_id: nextUserId }).eq("id", round.id);
          await broadcast(admin, session_id, "free_play_saved", { user_id: user.id });
          return jsonResponse({ hit: false, occurrences: 0, solved: false, free_play_saved: true });
        }

        const result = await resolveTurnEnd(admin, session_id, updatedRound, user.id, session);
        return jsonResponse({ hit: false, occurrences: 0, solved: false, revealed: result.revealed });
      }

      // ---------------------------------------------------------------
      // Solve the puzzle (any point during your turn's action phase)
      // ---------------------------------------------------------------
      case "start_solve_attempt": {
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
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
        const { data: session } = await admin
          .from("wheel_sessions")
          .select("status, game_mode, tiebreak_eligible_user_ids, tiebreak_eligible_team_ids")
          .eq("id", session_id)
          .single();
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
          await resolveSolve(admin, session_id, round, solverId, session);
          return jsonResponse({ correct: true });
        }

        await broadcast(admin, session_id, "solve_missed", { user_id: solverId, timed_out: isTimeout });
        const result = await resolveTurnEnd(admin, session_id, round, solverId, session);
        return jsonResponse({ correct: false, revealed: result.revealed });
      }

      // ---------------------------------------------------------------
      // Bonus Round (only the main game's winner may act — in team mode,
      // that's the winning team's current representative; the whole team
      // watches, one person plays, same shape as Family Feud's Fast Money
      // being played by individuals rather than the whole team at once)
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
          if (session.winner_team_id) {
            const { data: team } = await admin.from("wheel_teams").select("total_points").eq("id", session.winner_team_id).single();
            await admin.from("wheel_teams").update({ total_points: (team?.total_points ?? 0) + prize }).eq("id", session.winner_team_id);
          } else {
            const { data: participant } = await admin.from("wheel_participants").select("total_points").eq("session_id", session_id).eq("user_id", session.winner_user_id).single();
            await admin
              .from("wheel_participants")
              .update({ total_points: (participant?.total_points ?? 0) + prize })
              .eq("session_id", session_id)
              .eq("user_id", session.winner_user_id);
          }
        }

        await admin
          .from("wheel_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString(), bonus_won: won, bonus_points_awarded: prize, bonus_solved_phrase: phraseText, spectator_id: null })
          .eq("id", session_id);
        await releaseSessionLock(admin, session_id);

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
