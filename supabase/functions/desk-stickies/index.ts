// desk-stickies
// Short notes members leave on each other's pin boards. See migration 0066 and
// claude/Debbie_UI_Decisions_2026-11-24_v1.md (item 9). Rules and numbers are samples.
//   { action: "board",  owner_id }        -> this week's board for a desk + whether the caller may leave one
//   { action: "leave",  owner_id, body }  -> leave a sticky (server checks check-in, cap, settings, length)
//   { action: "mine" }                    -> the caller's own board, newest first (marks new ones seen)
//   { action: "keep",   id }              -> owner keeps a sticky (it moves to the Buddybook)
//   { action: "trash",  id }              -> owner trashes it (cannot be undone; the sender is not told)
//   { action: "report", id }              -> report a sticky on a board
//
// The member always comes from the verified session. The browser never says who is leaving a
// sticky, whether they checked in, or whose sticky it is. Only stickies on a board this week are
// ever returned. Trashed text is cleared in the database. Nothing here pays a reward.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAP = 20; // shown to the browser for the "x of 20" line; the database enforces it

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

type Row = { id: string; sender: string; body: string; status: string; created_at: string };

async function boardOf(admin: Admin, owner: string, week: string) {
  const rows = await must<Row[]>(
    admin
      .from("desk_stickies")
      .select("id,sender,body,status,created_at")
      .eq("desk_owner", owner)
      .eq("week_start", week)
      .in("status", ["new", "seen"])
      .order("created_at", { ascending: false }),
  );
  const ids = [...new Set((rows ?? []).map((r) => r.sender))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const ps = await must<{ id: string; username: string }[]>(admin.from("profiles").select("id,username").in("id", ids));
    for (const p of ps ?? []) names.set(p.id, p.username);
  }
  return (rows ?? []).map((r) => ({
    id: r.id,
    sender_id: r.sender,
    sender_name: names.get(r.sender) ?? "A member",
    body: r.body,
    created_at: r.created_at,
    is_new: r.status === "new",
  }));
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const me = auth.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const admin = getAdminClient();
    const week = await must<string>(admin.rpc("sticky_week"));

    if (action === "board") {
      const owner = typeof body.owner_id === "string" ? body.owner_id : "";
      if (!UUID.test(owner)) return jsonResponse({ error: "Member not found" }, 404);
      const prof = await must<{ is_member: boolean } | null>(admin.from("profiles").select("is_member").eq("id", owner).maybeSingle());
      if (!prof?.is_member) return jsonResponse({ error: "Member not found" }, 404);
      const reason = await must<string>(admin.rpc("sticky_can_leave", { p_sender: me, p_owner: owner }));
      const stickies = await boardOf(admin, owner, week);
      return jsonResponse({
        cap: CAP,
        count: stickies.length,
        can_leave: reason === "ok" ? "ok" : reason,
        // Sender ids are never needed by the board; only the viewer's own marker.
        stickies: stickies.map((s) => ({ id: s.id, sender_name: s.sender_name, body: s.body, created_at: s.created_at, mine: s.sender_id === me })),
      });
    }

    if (action === "leave") {
      const owner = typeof body.owner_id === "string" ? body.owner_id : "";
      if (!UUID.test(owner)) return jsonResponse({ error: "Member not found" }, 404);
      const text = typeof body.body === "string" ? body.body : "";
      const status = await must<string>(admin.rpc("sticky_leave", { p_sender: me, p_owner: owner, p_body: text }));
      return jsonResponse({ status });
    }

    if (action === "mine") {
      const stickies = await boardOf(admin, me, week);
      const out = stickies.map((s) => ({ id: s.id, sender_name: s.sender_name, body: s.body, created_at: s.created_at, is_new: s.is_new }));
      const { error } = await admin
        .from("desk_stickies")
        .update({ status: "seen" })
        .eq("desk_owner", me)
        .eq("week_start", week)
        .eq("status", "new");
      if (error) throw error;
      return jsonResponse({ cap: CAP, count: out.length, stickies: out });
    }

    if (action === "keep" || action === "trash" || action === "report") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!UUID.test(id)) return jsonResponse({ error: "bad id" }, 400);
      const fn = action === "keep" ? "sticky_keep" : action === "trash" ? "sticky_trash" : "sticky_report";
      const args = action === "report" ? { p_reporter: me, p_id: id } : { p_owner: me, p_id: id };
      const status = await must<string>(admin.rpc(fn, args));
      return jsonResponse({ status });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("desk-stickies failed:", err);
    return jsonResponse({ error: "Something went wrong with Desk Stickies." }, 500);
  }
});
