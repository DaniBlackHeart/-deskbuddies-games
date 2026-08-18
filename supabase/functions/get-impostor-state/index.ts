// get-impostor-state
// Used when a member opens/refreshes the Impostor WHO? play page —
// hydrates them with everything they're allowed to see right now: the
// public session state, the full roster, the public clue board, whether
// they've already cast a vote this round, and (anti-cheat boundary)
// their OWN card and nobody else's. Realtime broadcasts (channel
// `impostor-session-{id}`) handle live updates after that.
//
// Same idea as get-uno-state withholding every hand but the caller's —
// here it's impostor_cards (own row only) plus impostor_votes (own row
// only, so this endpoint can safely tell the caller "you've voted"
// without ever exposing who anyone voted for).

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

    const { data: session } = await admin.from("impostor_sessions").select("*").eq("id", session_id).single();
    if (!session) return jsonResponse({ error: "Session not found" }, 404);

    const { data: roster } = await admin
      .from("impostor_participants")
      .select("user_id, seat_order, profiles(username, avatar_url)")
      .eq("session_id", session_id)
      .order("seat_order", { ascending: true });

    const { data: clues } = await admin
      .from("impostor_clues")
      .select("round_number, user_id, clue_text, timed_out")
      .eq("session_id", session_id)
      .order("round_number", { ascending: true })
      .order("created_at", { ascending: true });

    const isPlaying = (roster ?? []).some((p) => p.user_id === user.id);

    let myCard: { is_impostor: boolean; word: string | null; category_name: string; clue: string | null } | null = null;
    if (isPlaying) {
      const { data: cardRow } = await admin
        .from("impostor_cards")
        .select("is_impostor, word, category_name, clue")
        .eq("session_id", session_id)
        .eq("user_id", user.id)
        .maybeSingle();
      myCard = cardRow ?? null;
    }

    let hasVoted = false;
    if (isPlaying && session.status === "voting" && session.vote_round) {
      const { data: myVote } = await admin
        .from("impostor_votes")
        .select("id")
        .eq("session_id", session_id)
        .eq("vote_round", session.vote_round)
        .eq("voter_user_id", user.id)
        .maybeSingle();
      hasVoted = !!myVote;
    }

    return jsonResponse({
      session: {
        id: session.id,
        status: session.status,
        category_name: session.category_name,
        round_number: session.round_number,
        turn_index: session.turn_index,
        round_set_starter_user_id: session.round_set_starter_user_id,
        current_turn_user_id: session.current_turn_user_id,
        clue_deadline_ms: session.clue_deadline ? new Date(session.clue_deadline).getTime() : null,
        vote_round: session.vote_round,
        vote_deadline_ms: session.vote_deadline ? new Date(session.vote_deadline).getTime() : null,
        winner: session.winner,
        completed: session.completed,
        revealed_impostor_user_id: session.revealed_impostor_user_id,
        revealed_secret_word: session.revealed_secret_word,
        final_vote_tally: session.final_vote_tally,
        state_version: session.state_version,
      },
      roster: roster ?? [],
      clues: clues ?? [],
      my_card: myCard,
      has_voted: hasVoted,
      is_playing: isPlaying,
    });
  } catch (err) {
    console.error("get-impostor-state crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
