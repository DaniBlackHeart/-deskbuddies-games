// buddybook
// Debbie's Buddybook: the member's private, read-only record.
//   { action: "collection" } -> every buddy for the Buddy Collection page: found or not, found date.
//   { action: "status" } -> Firsts stamps, Side Quest marks, owned buddies (and broad hints for the rest),
//                           Keepsake steps earned.
//
// Only the caller's own book is ever returned. The browser never says what has been
// earned: Firsts are worked out from stored history, recorded once in member_stamps
// and never removed. A newly recorded stamp asks grant_reward() for its (provisional,
// inactive until approved) reward; grant_reward is idempotent per source key, so
// repeating it is safe. A payout failure never loses the stamp.
//
// Entries are generic ("Checked in for the first time"). Nothing the member wrote
// (goals, notes, layouts) is returned, so nothing private can leak through the book.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

async function payStamps(admin: Admin, userId: string, keys: string[]) {
  if (keys.length === 0) return;
  const settings = await must<{ earning_enabled: boolean }>(
    admin.from("earning_settings").select("earning_enabled").eq("id", true).single(),
  );
  if (!settings.earning_enabled) return;
  const rules = await must<{ event_type: string }[]>(
    admin.from("reward_rules").select("event_type").eq("is_active", true).in("event_type", keys),
  );
  const due = (rules ?? []).map((r) => r.event_type);
  if (due.length === 0) return;
  const paid = await must<{ source_key: string }[]>(
    admin.from("reward_ledger").select("source_key").eq("user_id", userId).in("source_key", due.map((k) => `milestone:${k}`)),
  );
  const have = new Set((paid ?? []).map((p) => p.source_key));
  for (const key of due) {
    if (have.has(`milestone:${key}`)) continue;
    const { error } = await admin.rpc("grant_reward", {
      p_user_id: userId,
      p_event_type: key,
      p_source_key: `milestone:${key}`,
      p_meta: {},
    });
    if (error) console.error("buddybook: grant_reward failed:", key, error);
  }
}

async function buildStatus(admin: Admin, userId: string) {
  // ---- Firsts --------------------------------------------------------------
  const defs = await must<{ key: string; name: string; earned_line: string; sort: number }[]>(
    admin.from("stamp_defs").select("key,name,earned_line,sort").eq("is_live", true).order("sort"),
  );
  const facts = await must<Record<string, string | null>>(admin.rpc("buddybook_stamp_facts", { p_user: userId }));
  const mine = await must<{ stamp_key: string; earned_on: string }[]>(
    admin.from("member_stamps").select("stamp_key,earned_on").eq("user_id", userId),
  );
  const earnedOn = new Map((mine ?? []).map((m) => [m.stamp_key, m.earned_on]));

  const fresh: { user_id: string; stamp_key: string; earned_on: string }[] = [];
  for (const d of defs ?? []) {
    const when = facts?.[d.key];
    if (when && !earnedOn.has(d.key)) {
      fresh.push({ user_id: userId, stamp_key: d.key, earned_on: when });
      earnedOn.set(d.key, when);
    }
  }
  if (fresh.length > 0) {
    const { error } = await admin
      .from("member_stamps")
      .upsert(fresh, { onConflict: "user_id,stamp_key", ignoreDuplicates: true });
    if (error) throw error;
  }
  // Pay anything recorded and not yet paid (also repairs an earlier failed payout).
  await payStamps(admin, userId, [...earnedOn.keys()]);

  const firsts = (defs ?? []).map((d) => ({
    key: d.key,
    name: d.name,
    earned: earnedOn.has(d.key),
    earned_on: earnedOn.get(d.key) ?? null,
    line: earnedOn.has(d.key) ? d.earned_line : null,
  }));

  // ---- Buddies -------------------------------------------------------------
  const buddyDefs = await must<{ key: string; name: string; hint: string | null; one_liner: string | null }[]>(
    admin.from("buddy_defs").select("key,name,hint,one_liner").order("sort"),
  );
  const items = await must<{ item_key: string; granted_at: string }[]>(
    admin.from("member_items").select("item_key,granted_at").eq("user_id", userId).like("item_key", "companion:%"),
  );
  const ownedAt = new Map((items ?? []).map((i) => [i.item_key.slice("companion:".length), i.granted_at]));
  // Every buddy is listed so the book can show the locked ones as their own shapes. Foundie has no
  // public hint, so a generic "limited" line stands in while it is locked. Nothing about how a
  // locked buddy is earned is returned beyond its broad hint.
  const buddies = (buddyDefs ?? []).map((b) => {
    const limited = b.key === "foundie";
    const at = ownedAt.get(b.key) ?? null;
    return at
      ? { key: b.key, owned: true, limited, name: b.name, line: b.one_liner, hint: null, found_at: at }
      : { key: b.key, owned: false, limited, name: null, line: null, hint: b.hint ?? (limited ? "A limited companion" : "A companion to find"), found_at: null };
  });

  // ---- Keepsakes recap: highest step earned per card ------------------------
  const cards = await must<{ key: string; category: string; name: string; sort: number }[]>(
    admin.from("keepsake_cards").select("key,category,name,sort").eq("is_live", true).order("sort"),
  );
  const steps = await must<{ step_key: string; card_key: string; tier: string; threshold: number }[]>(
    admin.from("keepsake_steps").select("step_key,card_key,tier,threshold").order("threshold"),
  );
  const got = await must<{ step_key: string; earned_at: string }[]>(
    admin.from("keepsake_earned").select("step_key,earned_at").eq("user_id", userId),
  );
  const gotSet = new Set((got ?? []).map((g) => g.step_key));
  const gotAt = new Map((got ?? []).map((g) => [g.step_key, g.earned_at]));
  const keepsakes: { key: string; name: string; category: string; tier: string; threshold: number; earned_at: string | null }[] = [];
  let stepCount = 0;
  for (const c of cards ?? []) {
    const reached = (steps ?? []).filter((s) => s.card_key === c.key && gotSet.has(s.step_key));
    stepCount += reached.length;
    if (reached.length > 0) {
      const top = reached[reached.length - 1];
      keepsakes.push({ key: c.key, name: c.name, category: c.category, tier: top.tier, threshold: top.threshold, earned_at: gotAt.get(top.step_key) ?? null });
    }
  }

  // ---- Side Quest marks: one per quest you have done (generic: the quest name only) ----
  const doneQ = await must<{ quest_key: string; done_on: string }[]>(
    admin.from("side_quest_done").select("quest_key,done_on").eq("user_id", userId).order("done_on", { ascending: false }),
  );
  const questDefs = await must<{ key: string; name: string; theme: string }[]>(
    admin.from("side_quests").select("key,name,theme"),
  );
  const questName = new Map((questDefs ?? []).map((q) => [q.key, q]));
  const quests = (doneQ ?? [])
    .map((d) => ({ key: d.quest_key, name: questName.get(d.quest_key)?.name ?? "", theme: questName.get(d.quest_key)?.theme ?? "", done_on: d.done_on }))
    .filter((q) => q.name);

  // ---- Kept Desk Stickies: notes other members left that the owner chose to keep ----
  // Member-visible by design (the sender's name and the date written show). Only the caller's own.
  const keptRows = await must<{ id: string; sender: string; body: string; created_at: string }[]>(
    admin.from("desk_stickies").select("id,sender,body,created_at").eq("desk_owner", userId).eq("status", "kept").order("kept_at", { ascending: false }).limit(60),
  );
  const senderIds = [...new Set((keptRows ?? []).map((r) => r.sender))];
  const senderNames = new Map<string, string>();
  if (senderIds.length > 0) {
    const ps = await must<{ id: string; username: string }[]>(admin.from("profiles").select("id,username").in("id", senderIds));
    for (const p of ps ?? []) senderNames.set(p.id, p.username);
  }
  const stickies = (keptRows ?? []).map((r) => ({ id: r.id, sender_name: senderNames.get(r.sender) ?? "A member", body: r.body, written_on: r.created_at }));

  return {
    counts: {
      quests: quests.length,
      stamps: firsts.filter((f) => f.earned).length,
      buddies: buddies.filter((b) => b.owned).length,
      keepsakes: stepCount,
    },
    firsts,
    quests,
    buddies,
    keepsakes,
    stickies,
  };
}

// The whole Buddy Collection page: every buddy, whether this member has it, and when it was found.
// Foundie has no public hint, so a generic "limited" line stands in while it is locked. Nothing about
// how any buddy is earned is returned for buddies the member does not have.
async function buildCollection(admin: Admin, userId: string) {
  const defs = await must<{ key: string; name: string; hint: string | null; one_liner: string | null }[]>(
    admin.from("buddy_defs").select("key,name,hint,one_liner").order("sort"),
  );
  const items = await must<{ item_key: string; granted_at: string }[]>(
    admin.from("member_items").select("item_key,granted_at").eq("user_id", userId).like("item_key", "companion:%"),
  );
  const got = new Map((items ?? []).map((i) => [i.item_key.slice("companion:".length), i.granted_at]));
  const buddies = (defs ?? []).map((b) => {
    const at = got.get(b.key) ?? null;
    const limited = b.key === "foundie";
    return at
      ? { key: b.key, found: true, limited, name: b.name, line: b.one_liner, hint: null, found_at: at }
      : { key: b.key, found: false, limited, name: null, line: null, hint: b.hint ?? (limited ? "A limited companion" : "A companion to find"), found_at: null };
  });
  return { buddies, found: buddies.filter((b) => b.found).length };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "status" && body?.action !== "collection") {
      return jsonResponse({ error: "action must be 'status' or 'collection'" }, 400);
    }
    const admin = getAdminClient();
    // Paper Pal's rule may have been met through a Focus Block; settle it before reading the book.
    const { error: palError } = await admin.rpc("grant_paper_pal", { p_user: auth.user.id });
    if (palError) console.error("buddybook: grant_paper_pal failed:", palError);
    if (body.action === "collection") return jsonResponse(await buildCollection(admin, auth.user.id));
    return jsonResponse(await buildStatus(admin, auth.user.id));
  } catch (err) {
    console.error("buddybook failed:", err);
    return jsonResponse({ error: "Couldn't load your Buddybook. Try again." }, 500);
  }
});
