// beyond-the-desk
// Debbie's Beyond the Desk page: Daily Detours, Weekly Wins and Keepsakes.
//   { action: "status" }                         -> the whole page, for the caller
//   { action: "detour_done", prompt_key }        -> tick one of today's three detours
//
// The browser never says what day it is, what today's detours are, what a counter
// reads or that a goal is finished. Everything here is worked out from stored
// rows. Every call also settles anything newly reached (weekly goals, Keepsake
// steps) and asks grant_reward() to pay what has a rule. grant_reward is
// idempotent per source key, so repeating it is safe and repairs a payout that
// failed earlier. A payout failure never loses the progress itself.
//
// Source keys:  detour:<day>:<prompt_key>   weekly:<week_start>:<goal_key>
//               milestone:<step_key>
// Amounts, caps and the master switch live in the database, not here. Reward
// amounts are returned to the browser only when earning is on and the rule is
// active, so a switched-off page shows no amounts at all.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;
type RewardResult = { status: string; xp: number; deskbits: number; payout?: string };
type Rule = { xp: number; deskbits: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (ymd: string) => Math.round(Date.parse(ymd + "T00:00:00Z") / DAY_MS);
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
/** Monday of the week containing ymd (1 Jan 1970 was a Thursday). */
function weekStartOf(ymd: string): string {
  const n = dayNumber(ymd);
  return fromDayNumber(n - ((n + 3) % 7));
}
const addDays = (ymd: string, k: number) => fromDayNumber(dayNumber(ymd) + k);

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

async function loadRules(admin: Admin) {
  const settings = await must<{ earning_enabled: boolean }>(
    admin.from("earning_settings").select("earning_enabled").eq("id", true).single(),
  );
  const rows = await must<{ event_type: string; xp: number; deskbits: number }[]>(
    admin.from("reward_rules").select("event_type,xp,deskbits").eq("is_active", true),
  );
  const rules = new Map<string, Rule>();
  for (const r of rows ?? []) rules.set(r.event_type, { xp: r.xp, deskbits: r.deskbits });
  return { earningOn: settings.earning_enabled, rules };
}

/** Ask grant_reward for every item that has an active rule and no ledger row yet. */
async function payMissing(
  admin: Admin,
  userId: string,
  items: { event_type: string; source_key: string }[],
  env: { earningOn: boolean; rules: Map<string, Rule> },
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
    if (error) console.error("beyond-the-desk: grant_reward failed:", item.source_key, error);
  }
}

async function buildStatus(admin: Admin, userId: string, today: string) {
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const lastWeekStart = addDays(weekStart, -7);
  const env = await loadRules(admin);
  const settings = await must<{ weekly_goals_shown: number; full_week_goals: number; min_goals_visible: number }>(
    admin.from("beyond_settings").select("*").eq("id", true).single(),
  );
  const justEarned: { goals: string[]; steps: { card: string; tier: string }[] } = { goals: [], steps: [] };

  // ---- Daily Detours -------------------------------------------------------
  const picked = await must<{ slot: string; prompt_key: string; prompt_text: string }[]>(
    admin.rpc("ensure_detour_day", { p_day: today }),
  );
  const claimsToday = await must<{ prompt_key: string }[]>(
    admin.from("detour_claims").select("prompt_key").eq("user_id", userId).eq("community_day", today),
  );
  const doneKeys = new Set((claimsToday ?? []).map((c) => c.prompt_key));
  await payMissing(
    admin,
    userId,
    [...doneKeys].map((k) => ({ event_type: "daily_detour", source_key: `detour:${today}:${k}` })),
    env,
  );

  // ---- Weekly Wins ---------------------------------------------------------
  const weekRows = await must<{ goal_key: string }[]>(admin.rpc("ensure_goal_week", { p_week: weekStart }));
  const pool = await must<
    { key: string; name: string; goal_text: string; counter: string; target: number; unit: string; sort: number }[]
  >(admin.from("weekly_goal_pool").select("key,name,goal_text,counter,target,unit,sort").order("sort"));
  const thisKeys = new Set((weekRows ?? []).map((w) => w.goal_key));
  const goalDefs = (pool ?? []).filter((g) => thisKeys.has(g.key));
  const weekCounters = await must<Record<string, number>>(
    admin.rpc("beyond_week_counters", { p_user: userId, p_week: weekStart }),
  );
  const claimedRows = await must<{ goal_key: string }[]>(
    admin.from("weekly_goal_claims").select("goal_key").eq("user_id", userId).eq("week_start", weekStart),
  );
  const claimed = new Set((claimedRows ?? []).map((c) => c.goal_key));
  for (const g of goalDefs) {
    if (claimed.has(g.key) || Number(weekCounters[g.counter] ?? 0) < g.target) continue;
    const { data, error } = await admin
      .from("weekly_goal_claims")
      .upsert({ user_id: userId, week_start: weekStart, goal_key: g.key }, { onConflict: "user_id,week_start,goal_key", ignoreDuplicates: true })
      .select("goal_key");
    if (error) throw error;
    claimed.add(g.key);
    if ((data ?? []).length > 0) justEarned.goals.push(g.name);
  }
  await payMissing(
    admin,
    userId,
    [...claimed].map((k) => ({ event_type: "weekly_win", source_key: `weekly:${weekStart}:${k}` })),
    env,
  );

  const goals = goalDefs.map((g) => {
    const value = Number(weekCounters[g.counter] ?? 0);
    return {
      key: g.key,
      name: g.name,
      text: g.goal_text,
      unit: g.unit,
      target: g.target,
      progress: Math.min(value, g.target),
      done: claimed.has(g.key),
    };
  });

  // Last week: shown only if its five were stored (the member's page, or anyone's, picked it).
  let lastWeek: null | { start: string; end: string; goals: typeof goals } = null;
  const lastRows = await must<{ goal_key: string }[]>(
    admin.from("weekly_goal_weeks").select("goal_key").eq("week_start", lastWeekStart),
  );
  if ((lastRows ?? []).length > 0) {
    const lastKeys = new Set(lastRows.map((r) => r.goal_key));
    const lastCounters = await must<Record<string, number>>(
      admin.rpc("beyond_week_counters", { p_user: userId, p_week: lastWeekStart }),
    );
    const lastClaims = await must<{ goal_key: string }[]>(
      admin.from("weekly_goal_claims").select("goal_key").eq("user_id", userId).eq("week_start", lastWeekStart),
    );
    const lastDone = new Set((lastClaims ?? []).map((c) => c.goal_key));
    lastWeek = {
      start: lastWeekStart,
      end: addDays(lastWeekStart, 6),
      goals: (pool ?? [])
        .filter((g) => lastKeys.has(g.key))
        .map((g) => ({
          key: g.key,
          name: g.name,
          text: g.goal_text,
          unit: g.unit,
          target: g.target,
          progress: Math.min(Number(lastCounters[g.counter] ?? 0), g.target),
          done: lastDone.has(g.key),
        })),
    };
  }

  // ---- Keepsakes -----------------------------------------------------------
  const cards = await must<{ key: string; category: string; name: string; counts_text: string; sort: number }[]>(
    admin.from("keepsake_cards").select("key,category,name,counts_text,sort").eq("is_live", true).order("sort"),
  );
  const steps = await must<{ step_key: string; card_key: string; tier: string; threshold: number }[]>(
    admin.from("keepsake_steps").select("step_key,card_key,tier,threshold").order("threshold"),
  );
  const counters = await must<Record<string, number>>(admin.rpc("beyond_counters", { p_user: userId }));
  const earnedRows = await must<{ step_key: string }[]>(
    admin.from("keepsake_earned").select("step_key").eq("user_id", userId),
  );
  const earned = new Set((earnedRows ?? []).map((e) => e.step_key));
  const liveCardKeys = new Set(cards.map((c) => c.key));
  const cardName = new Map(cards.map((c) => [c.key, c.name]));
  for (const s of steps ?? []) {
    if (!liveCardKeys.has(s.card_key) || earned.has(s.step_key)) continue;
    if (Number(counters[s.card_key] ?? 0) < s.threshold) continue;
    const { data, error } = await admin
      .from("keepsake_earned")
      .upsert({ user_id: userId, step_key: s.step_key }, { onConflict: "user_id,step_key", ignoreDuplicates: true })
      .select("step_key");
    if (error) throw error;
    earned.add(s.step_key);
    if ((data ?? []).length > 0) justEarned.steps.push({ card: cardName.get(s.card_key) ?? s.card_key, tier: s.tier });
  }
  await payMissing(
    admin,
    userId,
    [...earned].map((k) => ({ event_type: k, source_key: `milestone:${k}` })),
    env,
  );

  const rewardFor = (eventType: string) => {
    const r = env.earningOn ? env.rules.get(eventType) : undefined;
    return r ? { xp: r.xp, deskbits: r.deskbits } : null;
  };

  const categories: { category: string; cards: unknown[] }[] = [];
  for (const c of cards ?? []) {
    const mine = (steps ?? []).filter((s) => s.card_key === c.key);
    const value = Number(counters[c.key] ?? 0);
    const next = mine.find((s) => !earned.has(s.step_key));
    let bucket = categories.find((b) => b.category === c.category);
    if (!bucket) {
      bucket = { category: c.category, cards: [] };
      categories.push(bucket);
    }
    bucket.cards.push({
      key: c.key,
      name: c.name,
      counts: c.counts_text,
      value,
      target: next ? next.threshold : (mine[mine.length - 1]?.threshold ?? 0),
      all_earned: !next,
      steps: mine.map((s) => ({
        tier: s.tier,
        threshold: s.threshold,
        earned: earned.has(s.step_key),
        reward: rewardFor(s.step_key),
      })),
    });
  }

  // ---- Your week strip -----------------------------------------------------
  const weekCheckins = await must<{ checkin_date: string }[]>(
    admin.from("daily_checkins").select("checkin_date").eq("user_id", userId).gte("checkin_date", weekStart).lte("checkin_date", weekEnd),
  );
  const weekDetours = await must<{ community_day: string }[]>(
    admin.from("detour_claims").select("community_day").eq("user_id", userId).gte("community_day", weekStart).lte("community_day", weekEnd),
  );
  const checkedIn = new Set((weekCheckins ?? []).map((c) => c.checkin_date));
  const detoursByDay = new Map<string, number>();
  for (const d of weekDetours ?? []) detoursByDay.set(d.community_day, (detoursByDay.get(d.community_day) ?? 0) + 1);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, checked_in: checkedIn.has(date), detours_done: detoursByDay.get(date) ?? 0 };
  });

  const goalsDone = goals.filter((g) => g.done).length;
  return {
    today,
    earning_on: env.earningOn,
    week: { start: weekStart, end: weekEnd, days },
    detours: {
      reward: rewardFor("daily_detour"),
      done_count: doneKeys.size,
      items: (picked ?? []).map((p) => ({
        key: p.prompt_key,
        slot: p.slot,
        text: p.prompt_text,
        done: doneKeys.has(p.prompt_key),
      })),
    },
    weekly: {
      visible: goals.length >= settings.min_goals_visible,
      full_week_goals: settings.full_week_goals,
      done_count: goalsDone,
      reward: rewardFor("weekly_win"),
      goals,
      last_week: lastWeek,
    },
    keepsakes: categories,
    just_earned: justEarned,
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
    if (action !== "status" && action !== "detour_done") {
      return jsonResponse({ error: "action must be 'status' or 'detour_done'" }, 400);
    }

    const admin = getAdminClient();
    const today = await must<string>(admin.rpc("community_today"));

    let result: RewardResult | null = null;
    if (action === "detour_done") {
      const key = typeof body?.prompt_key === "string" ? body.prompt_key : "";
      const picked = await must<{ prompt_key: string }[]>(admin.rpc("ensure_detour_day", { p_day: today }));
      // Only one of today's three stored prompts can be ticked.
      if (!key || !(picked ?? []).some((p) => p.prompt_key === key)) {
        return jsonResponse({ error: "That detour isn't one of today's. Refresh to see today's three." }, 409);
      }
      const { error } = await admin
        .from("detour_claims")
        .upsert({ user_id: user.id, community_day: today, prompt_key: key }, { onConflict: "user_id,community_day,prompt_key", ignoreDuplicates: true });
      if (error) throw error;

      const env = await loadRules(admin);
      if (env.earningOn) {
        const { data, error: gErr } = await admin.rpc("grant_reward", {
          p_user_id: user.id,
          p_event_type: "daily_detour",
          p_source_key: `detour:${today}:${key}`,
          p_meta: {},
        });
        if (gErr) console.error("beyond-the-desk: grant_reward failed:", gErr);
        else result = data as RewardResult;
      } else {
        result = { status: "disabled", xp: 0, deskbits: 0 };
      }
    }

    const status = await buildStatus(admin, user.id, today);
    return jsonResponse({ ...status, result });
  } catch (err) {
    console.error("beyond-the-desk failed:", err);
    return jsonResponse({ error: "Could not load Beyond the Desk" }, 500);
  }
});
