// get-wheel-state
// Used when a member opens/refreshes the Wheel of Fortune play page (or a
// MOD opens the host/spectator screen) — hydrates them with everything
// they're allowed to see right now: the public session state, the full
// roster, the current round's masked phrase and turn state, and — only
// while the Bonus Round is being solved — its masked phrase too. The real
// phrase text for either round is computed server-side from
// wheel_round_secrets/wheel_bonus_secrets and never sent as-is; realtime
// broadcasts (channel `wheel-session-{id}`) handle live updates after
// this initial load.

import { jsonResponse, handleOptions, getAdminClient, requireMember, maskWheelPhrase } from "../_shared/utils.ts";

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

    const { data: session } = await admin.from("wheel_sessions").select("*").eq("id", session_id).single();
    if (!session) return jsonResponse({ error: "Session not found" }, 404);

    const { data: roster } = await admin
      .from("wheel_participants")
      .select("user_id, seat_order, total_points, profiles(username, avatar_url)")
      .eq("session_id", session_id)
      .order("seat_order", { ascending: true });

    const isPlaying = (roster ?? []).some((p) => p.user_id === user.id);

    let round: Record<string, unknown> | null = null;
    if (session.status === "live" || session.status === "tiebreaker") {
      const { data: roundRow } = await admin
        .from("wheel_rounds")
        .select("*")
        .eq("session_id", session_id)
        .order("round_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roundRow) {
        let maskedPhrase = "";
        if (roundRow.status === "active") {
          const { data: secret } = await admin.from("wheel_round_secrets").select("phrase_text").eq("round_id", roundRow.id).single();
          maskedPhrase = maskWheelPhrase(secret?.phrase_text ?? "", roundRow.guessed_letters ?? []);
        } else {
          const { data: secret } = await admin.from("wheel_round_secrets").select("phrase_text").eq("round_id", roundRow.id).single();
          maskedPhrase = secret?.phrase_text ?? "";
        }

        round = {
          id: roundRow.id,
          round_index: roundRow.round_index,
          is_tiebreaker: roundRow.is_tiebreaker,
          category_name: roundRow.category_name,
          phrase_length: roundRow.phrase_length,
          status: roundRow.status,
          solved_by_user_id: roundRow.solved_by_user_id,
          guessed_letters: roundRow.guessed_letters,
          locked_out_user_ids: roundRow.locked_out_user_ids,
          active_user_id: roundRow.active_user_id,
          turn_phase: roundRow.turn_phase,
          turn_deadline_ms: roundRow.turn_deadline ? new Date(roundRow.turn_deadline).getTime() : null,
          pending_wedge: roundRow.pending_wedge,
          free_play_active: roundRow.free_play_active,
          round_scores: roundRow.round_scores,
          masked_phrase: maskedPhrase,
          eligible_user_ids: roundRow.is_tiebreaker ? session.tiebreak_eligible_user_ids : (roster ?? []).map((p) => p.user_id),
        };
      }
    }

    let bonusMaskedPhrase: string | null = null;
    if (session.status === "bonus_solving" || session.status === "ended") {
      const { data: bonusSecret } = await admin.from("wheel_bonus_secrets").select("phrase_text").eq("session_id", session_id).maybeSingle();
      if (bonusSecret) {
        if (session.status === "bonus_solving") {
          const allLetters = [...(session.bonus_given_letters ?? []), ...(session.bonus_chosen_consonants ?? []), session.bonus_chosen_vowel].filter(Boolean) as string[];
          bonusMaskedPhrase = maskWheelPhrase(bonusSecret.phrase_text, allLetters);
        } else if (session.bonus_solved_phrase) {
          bonusMaskedPhrase = session.bonus_solved_phrase;
        }
      }
    }

    return jsonResponse({
      session: {
        id: session.id,
        status: session.status,
        current_round_index: session.current_round_index,
        winner_user_id: session.winner_user_id,
        bonus_category_choices: session.bonus_category_choices,
        bonus_category_id: session.bonus_category_id,
        bonus_category_name: session.bonus_category_name,
        bonus_given_letters: session.bonus_given_letters,
        bonus_chosen_consonants: session.bonus_chosen_consonants,
        bonus_chosen_vowel: session.bonus_chosen_vowel,
        bonus_deadline_ms: session.bonus_deadline ? new Date(session.bonus_deadline).getTime() : null,
        bonus_won: session.bonus_won,
        bonus_points_awarded: session.bonus_points_awarded,
        bonus_solved_phrase: session.bonus_solved_phrase,
        bonus_masked_phrase: bonusMaskedPhrase,
        state_version: session.state_version,
      },
      roster: roster ?? [],
      round,
      is_playing: isPlaying,
      server_now_ms: Date.now(),
    });
  } catch (err) {
    console.error("get-wheel-state crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
