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
