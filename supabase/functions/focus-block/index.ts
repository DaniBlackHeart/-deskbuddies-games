// focus-block
// Debbie's Desk Time Focus Blocks. Actions:
//   { action: "status" }                                   -> where the caller's block stands
//   { action: "start", minutes, activity, goal? }          -> begin a block
//   { action: "hold" } / { action: "resume" }              -> pause / unpause the clock
//   { action: "finish" }                                   -> settle a block whose time is up
//   { action: "stop" }                                     -> end early (no finished-block reward)
//
// The browser never says what time it is or that a block is finished. The clock
// is worked out here from started_at, the time spent on hold and now(). A block
// completes only when that server clock reaches its length. The completion
// reward is asked of grant_reward() with the source key "focus:<block id>", so
// it can only pay once however many times this runs. Amounts, daily caps and
// the on/off switch live in the database. A reward failure never loses the block.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";
import { LENGTHS, ACTIVITIES, MAX_GOAL_LENGTH } from "../_shared/focusBlock.ts";

type Admin = ReturnType<typeof getAdminClient>;

type RewardResult = { status: string; xp: number; deskbits: number; payout?: string };

type Block = {
  id: string;
  user_id: string;
  activity: string;
  minutes: number;
  goal: string | null;
  status: "running" | "completed" | "stopped_early";
  started_at: string;
  held_at: string | null;
  held_ms: number;
  ended_at: string | null;
  community_day: string | null;
  reward: RewardResult | null;
};

const COLS = "id,user_id,activity,minutes,goal,status,started_at,held_at,held_ms,ended_at,community_day,reward";

/** Milliseconds of the block that have actually counted (time on hold excluded). */
function elapsedMs(b: Block, nowMs: number): number {
  const reference = b.held_at ? Date.parse(b.held_at) : nowMs;
  return Math.max(0, reference - Date.parse(b.started_at) - Number(b.held_ms));
}

function view(b: Block, nowMs: number) {
  return {
    id: b.id,
    activity: b.activity,
    minutes: b.minutes,
    goal: b.goal,
    held: b.held_at !== null,
    remaining_ms: Math.max(0, b.minutes * 60_000 - elapsedMs(b, nowMs)),
  };
}

async function getRunning(admin: Admin, userId: string): Promise<Block | null> {
  const { data, error } = await admin
    .from("focus_blocks")
    .select(COLS)
    .eq("user_id", userId)
    .eq("status", "running")
    .maybeSingle();
  if (error) throw error;
  return (data as Block | null) ?? null;
}

async function askForReward(admin: Admin, b: Block): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: b.user_id,
    p_event_type: "focus_block_complete",
    p_source_key: `focus:${b.id}`,
    p_meta: { minutes: b.minutes, activity: b.activity },
  });
  if (error) {
    console.error("focus-block: grant_reward failed:", error);
    return null;
  }
  const result = data as RewardResult;
  await admin.from("focus_blocks").update({ reward: result }).eq("id", b.id);
  return result;
}

/**
 * If the running block's time is up, mark it completed (once) and ask for its
 * reward. Returns null if it is still running or another request settled it first.
 */
async function settleIfDone(admin: Admin, b: Block, nowMs: number): Promise<{ block: Block; reward: RewardResult | null } | null> {
  if (b.status !== "running" || b.held_at) return null;
  if (elapsedMs(b, nowMs) < b.minutes * 60_000) return null;

  const endedAt = new Date(Date.parse(b.started_at) + Number(b.held_ms) + b.minutes * 60_000).toISOString();
  const { data: day, error: dayErr } = await admin.rpc("community_day_of", { p_ts: endedAt });
  if (dayErr) throw dayErr;

  // Only one request wins this update; the others see no row and move on.
  const { data, error } = await admin
    .from("focus_blocks")
    .update({ status: "completed", ended_at: endedAt, community_day: day })
    .eq("id", b.id)
    .eq("status", "running")
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const done = data as Block;
  const reward = await askForReward(admin, done);
  return { block: { ...done, reward }, reward };
}

async function finishedToday(admin: Admin, userId: string): Promise<number> {
  const { data: today, error: dayErr } = await admin.rpc("community_today");
  if (dayErr || typeof today !== "string") throw dayErr ?? new Error("community_today returned no date");
  const { count, error } = await admin
    .from("focus_blocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("community_day", today);
  if (error) throw error;
  return count ?? 0;
}

/** Repairs a completed block whose reward request failed earlier (idempotent). */
async function repairLatestReward(admin: Admin, userId: string) {
  const { data } = await admin
    .from("focus_blocks")
    .select(COLS)
    .eq("user_id", userId)
    .eq("status", "completed")
    .is("reward", null)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) await askForReward(admin, data as Block);
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
    if (!["status", "start", "hold", "resume", "finish", "stop"].includes(action)) {
      return jsonResponse({ error: "Unknown action" }, 400);
    }

    const admin = getAdminClient();
    const now = Date.now();
    let result: Record<string, unknown> | null = null;
    let notFinished = false;

    let running = await getRunning(admin, user.id);

    // Every action first settles a block whose time is already up, so a refresh
    // after the clock ran out still finishes it.
    if (running) {
      const settled = await settleIfDone(admin, running, now);
      if (settled) {
        result = { outcome: "completed", minutes: settled.block.minutes, activity: settled.block.activity, reward: settled.reward };
        running = null;
      } else {
        running = await getRunning(admin, user.id); // null if another request settled it just now
      }
    }

    if (action === "start") {
      const minutes = body?.minutes;
      const activity = body?.activity;
      if (!LENGTHS.includes(minutes)) return jsonResponse({ error: "Pick one of the available lengths" }, 400);
      if (!ACTIVITIES.includes(activity)) return jsonResponse({ error: "Pick what you're doing" }, 400);
      let goal: string | null = null;
      if (typeof body?.goal === "string") {
        const g = body.goal.trim();
        if (g.length > MAX_GOAL_LENGTH) return jsonResponse({ error: `Keep the goal under ${MAX_GOAL_LENGTH} characters` }, 400);
        goal = g.length > 0 ? g : null;
      }
      if (!running) {
        const { data, error } = await admin
          .from("focus_blocks")
          .insert({ user_id: user.id, minutes, activity, goal })
          .select(COLS)
          .single();
        if (error) {
          if (error.code === "23505") running = await getRunning(admin, user.id); // lost a double-click race
          else throw error;
        } else {
          running = data as Block;
        }
      }
    } else if (action === "hold") {
      if (running && !running.held_at) {
        const { data, error } = await admin
          .from("focus_blocks")
          .update({ held_at: new Date(now).toISOString() })
          .eq("id", running.id)
          .eq("status", "running")
          .is("held_at", null)
          .select(COLS)
          .maybeSingle();
        if (error) throw error;
        running = (data as Block | null) ?? (await getRunning(admin, user.id));
      }
    } else if (action === "resume") {
      if (running && running.held_at) {
        const add = Math.max(0, now - Date.parse(running.held_at));
        const { data, error } = await admin
          .from("focus_blocks")
          .update({ held_at: null, held_ms: Number(running.held_ms) + add })
          .eq("id", running.id)
          .eq("status", "running")
          .eq("held_at", running.held_at) // a second tab can't add the same hold twice
          .select(COLS)
          .maybeSingle();
        if (error) throw error;
        running = (data as Block | null) ?? (await getRunning(admin, user.id));
      }
    } else if (action === "finish") {
      // Settling already happened above. Still running means the time isn't up.
      if (running) notFinished = true;
    } else if (action === "stop") {
      if (running) {
        const { data, error } = await admin
          .from("focus_blocks")
          .update({ status: "stopped_early", ended_at: new Date(now).toISOString() })
          .eq("id", running.id)
          .eq("status", "running")
          .select("id,minutes,activity")
          .maybeSingle();
        if (error) throw error;
        if (data) {
          result = { outcome: "stopped_early", minutes: data.minutes, activity: data.activity, reward: null };
          running = null;
        } else {
          running = await getRunning(admin, user.id);
        }
      }
    } else if (action === "status") {
      await repairLatestReward(admin, user.id);
    }

    return jsonResponse({
      block: running ? view(running, now) : null,
      finished_today: await finishedToday(admin, user.id),
      result,
      not_finished: notFinished,
    });
  } catch (err) {
    console.error("focus-block failed:", err);
    return jsonResponse({ error: "Could not process your Focus Block" }, 500);
  }
});
