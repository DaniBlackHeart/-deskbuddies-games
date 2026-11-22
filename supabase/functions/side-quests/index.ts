// side-quests
// Debbie's Side Quests: a weekly wheel and an archive. See migration 0034 and
// claude/Debbie_Side_Quest_Wheel_Draft_v1.md (a proposal; every number is config).
//   { action: "status" }
//   { action: "spin" }                 -> deal this week's quest (once; repeats change nothing)
//   { action: "respin" }               -> the one free re-spin, before locking
//   { action: "lock" }                 -> "I'll do this one"
//   { action: "done", quest_key }      -> this week's locked quest, or one in the archive
//
// The browser never says what day it is, which quest was dealt or whether one is done.
// The server draws, stores and checks everything. The spin animation is cosmetic.
// Completion is a self-report; nothing the member writes is stored.
//
// Source keys:  sqspin:<week_start>   sq:<quest_key>
// Rewards: first spin of a week and a quest done in its week. An archive completion
// is a stamp only. Reward amounts are returned only when earning is on and the rule
// is active.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
type Rule = { xp: number; deskbits: number };
type QuestRow = { key: string; name: string; what_to_do: string; theme: string; easier: string; social: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (ymd: string) => Math.round(Date.parse(ymd + "T00:00:00Z") / DAY_MS);
/** Monday of the week containing ymd (1 Jan 1970 was a Thursday). */
function weekStartOf(ymd: string): string {
  const n = dayNumber(ymd);
  return new Date((n - ((n + 3) % 7)) * DAY_MS).toISOString().slice(0, 10);
}

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

async function loadRules(admin: Admin) {
  const settings = await must<{ earning_enabled: boolean }>(
    admin.from("earning_settings").select("earning_enabled").eq("id", true).single(),
  );
  const rows = await must<{ event_type: string; xp: number; deskbits: number; is_active: boolean }[]>(
    admin.from("reward_rules").select("event_type,xp,deskbits,is_active").in("event_type", ["side_quest_spin", "side_quest_done"]),
  );
  const rules = new Map<string, Rule>();
  // Provisional amounts, shown to members only as a labelled sample while earning is off.
  const samples = new Map<string, Rule>();
  for (const r of rows ?? []) {
    samples.set(r.event_type, { xp: r.xp, deskbits: r.deskbits });
    if (r.is_active) rules.set(r.event_type, { xp: r.xp, deskbits: r.deskbits });
  }
  return { earningOn: settings.earning_enabled, rules, samples };
}

/** Ask grant_reward for every item that has an active rule and no ledger row yet. */
async function payMissing(
  admin: Admin,
  userId: string,
  items: { event_type: string; source_key: string }[],
  env: { earningOn: boolean; rules: Map<string, Rule>; samples?: Map<string, Rule> },
) {
  if (!env.earningOn) return;
  const due = items.filter((i) => env.rules.has(i.event_type));
  if (due.length === 0) return;
  const paid = await must<{ source_key: string }[]>(
    admin.from("reward_ledger").select("source_key").eq("user_id", userId).in("source_key", due.map((d) => d.source_key)),
  );
  const have = new Set((paid ?? []).map((p) => p.source_key));
  for (const item of due) {
    if (have.has(item.source_key)) continue;
    const { error } = await admin.rpc("grant_reward", {
      p_user_id: userId,
      p_event_type: item.event_type,
      p_source_key: item.source_key,
      p_meta: {},
    });
    if (error) console.error("side-quests: grant_reward failed:", item.source_key, error);
  }
}

const shape = (q: QuestRow) => ({
  key: q.key,
  name: q.name,
  theme: q.theme,
  what: q.what_to_do,
  easier: q.easier,
  social: q.social,
});

async function buildStatus(admin: Admin, userId: string, week: string) {
  const env = await loadRules(admin);
  const quests = await must<QuestRow[]>(
    admin.from("side_quests").select("key,name,what_to_do,theme,easier,social").order("sort"),
  );
  const byKey = new Map((quests ?? []).map((q) => [q.key, q]));

  const weeks = await must<{ week_start: string; quest_key: string; respun: boolean; locked: boolean }[]>(
    admin.from("side_quest_weeks").select("week_start,quest_key,respun,locked").eq("user_id", userId),
  );
  const done = await must<{ quest_key: string; in_week: boolean }[]>(
    admin.from("side_quest_done").select("quest_key,in_week").eq("user_id", userId),
  );
  const doneKeys = new Set((done ?? []).map((d) => d.quest_key));
  const current = (weeks ?? []).find((w) => w.week_start === week) ?? null;

  // Settle payouts: the first spin of this week, and quests done in their week.
  const items: { event_type: string; source_key: string }[] = [];
  if (current) items.push({ event_type: "side_quest_spin", source_key: `sqspin:${week}` });
  for (const d of done ?? []) if (d.in_week) items.push({ event_type: "side_quest_done", source_key: `sq:${d.quest_key}` });
  await payMissing(admin, userId, items, env);

  const rewardFor = (eventType: string) => {
    const r = env.earningOn ? env.rules.get(eventType) : undefined;
    return r ? { xp: r.xp, deskbits: r.deskbits } : null;
  };

  const dealt = current ? byKey.get(current.quest_key) ?? null : null;
  let stage: "unspun" | "result" | "locked" | "done" | "none_left" = "unspun";
  if (current && dealt) {
    stage = doneKeys.has(current.quest_key) ? "done" : current.locked ? "locked" : "result";
  } else {
    const left = (quests ?? []).some((q) => !doneKeys.has(q.key));
    if (!left) stage = "none_left";
  }

  // Archive: dealt in an earlier week and not done. Never a quest that was not dealt.
  const archiveKeys = new Set<string>();
  for (const w of weeks ?? []) {
    if (w.week_start < week && !doneKeys.has(w.quest_key) && w.quest_key !== current?.quest_key) archiveKeys.add(w.quest_key);
  }
  const archive = [...archiveKeys].map((k) => byKey.get(k)).filter((q): q is QuestRow => !!q).map(shape);

  return {
    week_start: week,
    stage,
    quest: dealt ? shape(dealt) : null,
    can_respin: !!current && !current.locked && !current.respun && stage === "result",
    spin_reward: rewardFor("side_quest_spin"),
    done_reward: rewardFor("side_quest_done"),
    // Only when the real reward is not live: the provisional amount, to be shown labelled as a sample.
    done_reward_sample: rewardFor("side_quest_done") ? null : env.samples.get("side_quest_done") ?? null,
    archive,
    stamps: doneKeys.size,
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["status", "spin", "respin", "lock", "done"].includes(action)) {
      return jsonResponse({ error: "unknown action" }, 400);
    }
    const admin = getAdminClient();
    const today = await must<string>(admin.rpc("community_today"));
    const week = weekStartOf(today);

    let result: { action: string; status: string } | null = null;
    if (action === "spin") {
      const { data, error } = await admin.rpc("sq_spin", { p_user: user.id, p_week: week });
      if (error) throw error;
      result = { action, status: data ? "ok" : "none_left" };
    } else if (action === "respin") {
      const { error } = await admin.rpc("sq_respin", { p_user: user.id, p_week: week });
      if (error) throw error;
      result = { action, status: "ok" };
    } else if (action === "lock") {
      const { error } = await admin.rpc("sq_lock", { p_user: user.id, p_week: week });
      if (error) throw error;
      result = { action, status: "ok" };
    } else if (action === "done") {
      const key = typeof body?.quest_key === "string" ? body.quest_key : "";
      if (!key) return jsonResponse({ error: "quest_key is required" }, 400);
      const { data, error } = await admin.rpc("sq_done", { p_user: user.id, p_quest: key, p_today: today, p_week: week });
      if (error) throw error;
      result = { action, status: String(data) };
    }

    const status = await buildStatus(admin, user.id, week);
    return jsonResponse({ ...status, result });
  } catch (err) {
    console.error("side-quests failed:", err);
    return jsonResponse({ error: "Could not load Side Quests" }, 500);
  }
});
