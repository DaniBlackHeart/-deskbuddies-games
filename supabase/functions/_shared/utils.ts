// Shared helpers used across all Edge Functions.
// Deno runtime (Supabase Edge Functions).

import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/** Admin client using the service role key — bypasses RLS. Server-side only. */
export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Resolves the calling user from the request's Authorization header.
 * Returns null if the token is missing/invalid.
 */
export async function getCallingUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/** Confirms the caller is a verified MOD (checked server-side, never trusted from the client). */
export async function requireMod(req: Request) {
  const user = await getCallingUser(req);
  if (!user) return { error: jsonResponse({ error: "Not authenticated" }, 401) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.is_mod) {
    return { error: jsonResponse({ error: "MOD access required" }, 403) };
  }
  return { user, profile };
}

/** Confirms the caller is a verified DeskBuddies member. */
export async function requireMember(req: Request) {
  const user = await getCallingUser(req);
  if (!user) return { error: jsonResponse({ error: "Not authenticated" }, 401) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.is_member) {
    return { error: jsonResponse({ error: "Membership required" }, 403) };
  }
  return { user, profile };
}

/** Normalizes text for typed-answer matching: lowercase, trim, collapse whitespace, strip punctuation. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, "") // strip punctuation
    .replace(/\s+/g, " ");
}

/** Deduction for a submitted-but-wrong answer. Defaults to half of points, rounded. */
export function resolveWrongPenalty(question: { points: number; penalty_points: number | null }): number {
  return question.penalty_points ?? Math.round(question.points / 2);
}

/** Flat deduction for not answering at all: 25% of points, rounded. */
export function resolveTimeoutPenalty(question: { points: number }): number {
  return Math.round(question.points * 0.25);
}

export function typedAnswerMatches(submitted: string, accepted: string[]): boolean {
  const normalizedSubmitted = normalizeAnswer(submitted);
  return accepted.some((a) => normalizeAnswer(a) === normalizedSubmitted);
}

// --- Cross-game session exclusivity ---

/**
 * Atomically claims the single global "a session is running" lock, so at
 * most one session — of ANY game — can be live at a time. Call this before
 * creating a new session row; if it returns non-null, stop and return that
 * response instead of creating the session.
 */
export async function claimSessionLock(
  admin: ReturnType<typeof getAdminClient>,
  opts: { game: string; sessionId: string; hostId: string }
): Promise<Response | null> {
  const { error } = await admin
    .from("active_session_lock")
    .insert({ lock_key: true, game: opts.game, session_id: opts.sessionId, host_id: opts.hostId });

  if (!error) return null;

  const { data: existing } = await admin.from("active_session_lock").select("game").maybeSingle();
  return jsonResponse(
    { error: `A ${existing?.game ?? "different"} session is already running. End it before starting a new one.` },
    409
  );
}

/** Releases the global session lock. Safe to call even if it's already gone. */
export async function releaseSessionLock(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  await admin.from("active_session_lock").delete().eq("session_id", sessionId);
}

/**
 * Force-clears the global session lock regardless of who holds it or what
 * session it points to — the "it crashed / somebody forgot to end it"
 * escape hatch, same reasoning as trivia-host's release_spectator (any mod
 * can release it, not just whoever holds it, so it can't get permanently
 * stuck). Returns the cleared row, if any, so the caller can tell the mod
 * what just got released.
 */
export async function forceReleaseSessionLock(admin: ReturnType<typeof getAdminClient>) {
  const { data } = await admin
    .from("active_session_lock")
    .delete()
    .eq("lock_key", true)
    .select()
    .maybeSingle();
  return data as { game: string; session_id: string; host_id: string; started_at: string } | null;
}

// --- Spectator seat (single-claim "who's currently watching") ---

/**
 * Atomically claims a single-seat spectator slot on a session row. Only one
 * user can hold it at a time. The read-then-check below exists only to
 * return a friendlier "taken by X" message in the common case — the actual
 * atomicity comes from the conditional update's .is("spectator_id", null),
 * which loses a genuine race cleanly instead of letting both callers win.
 */
export async function claimSpectatorSeat(
  admin: ReturnType<typeof getAdminClient>,
  opts: { table: string; sessionId: string; userId: string }
): Promise<Response | null> {
  const { data: session } = await admin
    .from(opts.table)
    .select("id, spectator_id")
    .eq("id", opts.sessionId)
    .single();
  if (!session) return jsonResponse({ error: "Session not found" }, 404);

  if (session.spectator_id === opts.userId) {
    return null; // already theirs (e.g. page refresh) — treat as success
  }

  if (session.spectator_id) {
    const { data: holder } = await admin
      .from("profiles")
      .select("username")
      .eq("id", session.spectator_id)
      .maybeSingle();
    return jsonResponse({ error: `Already being watched by ${holder?.username ?? "another mod"}.` }, 409);
  }

  const { data: claimed } = await admin
    .from(opts.table)
    .update({ spectator_id: opts.userId })
    .eq("id", opts.sessionId)
    .is("spectator_id", null)
    .select()
    .maybeSingle();

  if (!claimed) {
    return jsonResponse({ error: "Someone just claimed this seat — try again." }, 409);
  }
  return null;
}

/** Releases a session's spectator seat. Any mod can call this, not just whoever holds it — avoids it getting permanently stuck. */
export async function releaseSpectatorSeat(admin: ReturnType<typeof getAdminClient>, table: string, sessionId: string) {
  await admin.from(table).update({ spectator_id: null }).eq("id", sessionId);
}

// --- Family Feud helpers ---

export type FeudAnswer = { text: string; points: number; alt_answers?: string[] };

/**
 * Checks a submitted guess against a board's ranked answer list and returns
 * the matched index, or null if it's not on the board. Skips indices already
 * in `excludeIndices` (already-revealed or already-guessed slots) — repeating
 * a used answer isn't a valid guess, same as the real show.
 * Matches against both the answer's main text and any `alt_answers` a MOD
 * pre-registered, using the same normalization as trivia's typed matching.
 */
export function matchFeudAnswer(
  submitted: string,
  answers: FeudAnswer[],
  excludeIndices: number[] = []
): number | null {
  const normalizedSubmitted = normalizeAnswer(submitted);
  if (!normalizedSubmitted) return null;
  const excluded = new Set(excludeIndices);

  for (let i = 0; i < answers.length; i++) {
    if (excluded.has(i)) continue;
    const candidates = [answers[i].text, ...(answers[i].alt_answers ?? [])];
    if (candidates.some((c) => normalizeAnswer(c) === normalizedSubmitted)) {
      return i;
    }
  }
  return null;
}

/** Ranks answer indices ascending by points (least valuable first) — used for the facilitator's "lost the face-off" reveal. */
export function feudReveaLeastToMostIndices(answers: FeudAnswer[]): number[] {
  return answers
    .map((_, i) => i)
    .sort((a, b) => answers[a].points - answers[b].points);
}

/** Public-safe board shape: text/points hidden until the index is revealed. */
export function toPublicFeudAnswers(answers: FeudAnswer[], revealedIndices: number[]) {
  const revealed = new Set(revealedIndices);
  return answers.map((a, i) =>
    revealed.has(i) ? { text: a.text, points: a.points, revealed: true } : { revealed: false }
  );
}

/** Builds a Discord CDN avatar URL, falling back to Discord's default embed avatar. */
export function discordAvatarUrl(discordId: string, avatarHash: string | null, discriminator = "0") {
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=128`;
  }
  const fallbackIndex = discriminator === "0"
    ? Number((BigInt(discordId) >> 22n) % 6n)
    : Number(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

/** Computes a session's leaderboard by summing points_awarded per participant. */
export async function computeLeaderboard(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const { data: participants } = await admin
    .from("session_participants")
    .select("user_id, profiles(username, avatar_url)")
    .eq("session_id", sessionId);

  const { data: answers } = await admin
    .from("answers")
    .select("user_id, points_awarded")
    .eq("session_id", sessionId);

  const totals = new Map<string, number>();
  for (const p of participants ?? []) totals.set(p.user_id, 0);
  for (const a of answers ?? []) {
    totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + (a.points_awarded ?? 0));
  }

  const profileMap = new Map(
    (participants ?? []).map((p: any) => [p.user_id, p.profiles])
  );

  const leaderboard = Array.from(totals.entries())
    .map(([user_id, total_points]) => ({
      user_id,
      username: profileMap.get(user_id)?.username ?? "Unknown",
      avatar_url: profileMap.get(user_id)?.avatar_url ?? null,
      total_points,
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return leaderboard;
}
