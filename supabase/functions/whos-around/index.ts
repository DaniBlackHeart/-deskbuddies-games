// whos-around
// Home's "Who's around" panel (Debbie Home design, 24 Nov 2026).
//   { action: "around" }            -> members in a Focus Block right now
//   { action: "search", q }         -> members whose name matches q
// Members only (requireMember). Both answers carry ONLY member-visible fields: a name, a
// Discord avatar, and (for people in a Focus Block who allow it) "about N min left". Never a
// goal, an activity, a balance, a streak, a journal or any history. "Show me in Who's around"
// (member_settings.show_in_around) hides someone from the "around" list and from the Focus
// Block line in search; it does not hide their name from search (every member can be found).

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

const MAX_Q = 40;
const MIN_Q = 2;
const SEARCH_LIMIT = 10;
const AROUND_LIMIT = 6;

type Person = { id: string; name: string; avatar_url: string | null; focus_minutes_left: number | null };

/** LIKE wildcards and the escape character are plain text in a name search. */
function likePattern(q: string): string {
  return "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
}

/** Whole minutes left for each member who is in a running, unheld Focus Block and shows in "around". */
async function focusingNow(admin: ReturnType<typeof getAdminClient>, ids?: string[]) {
  let q = admin
    .from("focus_blocks")
    .select("user_id,minutes,started_at,held_at,held_ms")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(200);
  if (ids) q = q.in("user_id", ids);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return new Map<string, number>();

  const userIds = rows.map((r) => r.user_id as string);
  const { data: hidden } = await admin
    .from("member_settings")
    .select("user_id")
    .in("user_id", userIds)
    .eq("show_in_around", false);
  const hide = new Set((hidden ?? []).map((h) => h.user_id as string));

  const now = Date.now();
  const out = new Map<string, number>();
  for (const r of rows) {
    if (hide.has(r.user_id as string)) continue;
    const ref = r.held_at ? Date.parse(r.held_at as string) : now;
    const elapsed = Math.max(0, ref - Date.parse(r.started_at as string) - Number(r.held_ms));
    const left = Math.max(0, Number(r.minutes) * 60_000 - elapsed);
    if (left <= 0) continue; // time is up; the block settles on its owner's next call
    out.set(r.user_id as string, Math.max(1, Math.ceil(left / 60_000)));
  }
  return out;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const admin = getAdminClient();

    if (body?.action === "around") {
      const focusing = await focusingNow(admin);
      const ids = [...focusing.keys()].filter((id) => id !== user.id).slice(0, AROUND_LIMIT);
      if (ids.length === 0) return jsonResponse({ people: [] });
      const { data, error } = await admin
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids)
        .eq("is_member", true);
      if (error) throw error;
      const people: Person[] = (data ?? []).map((p) => ({
        id: p.id as string,
        name: p.username as string,
        avatar_url: (p.avatar_url as string | null) ?? null,
        focus_minutes_left: focusing.get(p.id as string) ?? null,
      }));
      return jsonResponse({ people });
    }

    if (body?.action === "search") {
      const q = typeof body.q === "string" ? body.q.trim().slice(0, MAX_Q) : "";
      if (q.length < MIN_Q) return jsonResponse({ people: [], too_short: true });
      const { data, error } = await admin
        .from("profiles")
        .select("id,username,avatar_url")
        .eq("is_member", true)
        .neq("id", user.id)
        .ilike("username", likePattern(q))
        .order("username", { ascending: true })
        .limit(SEARCH_LIMIT);
      if (error) throw error;
      const found = data ?? [];
      const focusing = found.length > 0 ? await focusingNow(admin, found.map((p) => p.id as string)) : new Map();
      const people: Person[] = found.map((p) => ({
        id: p.id as string,
        name: p.username as string,
        avatar_url: (p.avatar_url as string | null) ?? null,
        focus_minutes_left: focusing.get(p.id as string) ?? null,
      }));
      return jsonResponse({ people });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch {
    console.error("whos-around failed");
    return jsonResponse({ error: "Something went wrong." }, 500);
  }
});
