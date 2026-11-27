// daily-checkin
// Debbie's daily check-in. Two actions:
//   { action: "status" } -> where the caller's streak stands (read-only)
//   { action: "claim" }  -> check in for today (safe to call repeatedly)
//   { action: "overview" } -> status plus what the Pull Up a Chair page shows (read-only): the
//                           days checked in over the last ~10 weeks, today's reward if one was
//                           paid, and the streak milestones. Own data only.
//
// The browser never says what day it is or what the streak is. The day comes
// from the database (community_today(), Asia/Manila, set in earning_settings),
// and the streak is derived from stored rows.
//
// Rewards: a claim also asks the database to pay the "daily_checkin" rule via
// grant_reward(). Amounts, caps and the on/off master switch live in the
// database, not here. grant_reward is idempotent per day (source key
// "checkin:<date>"), so calling it on every claim is safe and also repairs a
// claim whose payout failed the first time. A payout failure never fails the
// check-in itself.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
} from "../_shared/utils.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

type RewardResult = {
  status: string; // granted | capped | duplicate | disabled | no_rule | not_member
  xp: number;
  deskbits: number;
  payout?: string;
};

function dayNumber(ymd: string): number {
  // Whole days since epoch for a YYYY-MM-DD string (timezone-free math).
  return Math.round(Date.parse(ymd + "T00:00:00Z") / DAY_MS);
}

async function getCommunityToday(admin: ReturnType<typeof getAdminClient>): Promise<string> {
  const { data, error } = await admin.rpc("community_today");
  if (error || typeof data !== "string") {
    throw error ?? new Error("community_today returned no date");
  }
  return data; // YYYY-MM-DD
}

async function grantCheckinReward(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  today: string
): Promise<RewardResult | null> {
  const { data, error } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_event_type: "daily_checkin",
    p_source_key: `checkin:${today}`,
    p_meta: {},
  });
  if (error) {
    console.error("daily-checkin: grant_reward failed:", error);
    return null;
  }
  return data as RewardResult;
}

async function getStatus(admin: ReturnType<typeof getAdminClient>, userId: string, today: string) {
  const { data, error } = await admin
    .from("daily_checkins")
    .select("checkin_date")
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const days = (data ?? []).map((r: { checkin_date: string }) => dayNumber(r.checkin_date));
  const todayNum = dayNumber(today);
  const checkedInToday = days.length > 0 && days[0] === todayNum;

  // Current streak: consecutive days ending today, or ending yesterday if
  // today hasn't been claimed yet (the streak is still alive until the day
  // is over).
  let current = 0;
  if (days.length > 0 && (days[0] === todayNum || days[0] === todayNum - 1)) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] - 1) current++;
      else break;
    }
  }

  // Longest streak across the fetched history.
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] - 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return {
    today,
    checked_in_today: checkedInToday,
    current_streak: current,
    longest_streak: longest,
    total_checkins: days.length,
  };
}


type Admin = ReturnType<typeof getAdminClient>;

/** What the Pull Up a Chair page needs beyond the streak. Read-only, the caller's own rows only. */
async function getOverview(admin: Admin, userId: string, today: string, status: Awaited<ReturnType<typeof getStatus>>) {
  const since = new Date(Date.parse(today + "T00:00:00Z") - 70 * DAY_MS).toISOString().slice(0, 10);

  const [datesRes, ledgerRes, stepsRes, earnedRes] = await Promise.all([
    admin.from("daily_checkins").select("checkin_date").eq("user_id", userId).gte("checkin_date", since).order("checkin_date", { ascending: true }),
    admin.from("reward_ledger").select("xp_delta,deskbits_delta,payout").eq("user_id", userId).eq("source_key", `checkin:${today}`).maybeSingle(),
    admin.from("keepsake_steps").select("step_key,tier,threshold").eq("card_key", "keep_streak").order("threshold", { ascending: true }),
    admin.from("keepsake_earned").select("step_key").eq("user_id", userId).like("step_key", "keep_streak_%"),
  ]);
  if (datesRes.error) throw datesRes.error;
  if (ledgerRes.error) throw ledgerRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (earnedRes.error) throw earnedRes.error;

  const steps = (stepsRes.data ?? []) as { step_key: string; tier: string; threshold: number }[];
  const rulesRes = steps.length
    ? await admin.from("reward_rules").select("event_type,xp,deskbits").in("event_type", steps.map((x) => x.step_key))
    : { data: [], error: null };
  if (rulesRes.error) throw rulesRes.error;
  const rules = new Map(((rulesRes.data ?? []) as { event_type: string; xp: number; deskbits: number }[]).map((r) => [r.event_type, r]));
  const earned = new Set(((earnedRes.data ?? []) as { step_key: string }[]).map((e) => e.step_key));

  const ledger = ledgerRes.data as { xp_delta: number; deskbits_delta: number; payout: string } | null;
  return {
    dates: ((datesRes.data ?? []) as { checkin_date: string }[]).map((r) => r.checkin_date),
    today_reward: ledger && ledger.payout === "paid" ? { xp: ledger.xp_delta, deskbits: ledger.deskbits_delta } : null,
    milestones: steps.map((m) => ({
      tier: m.tier,
      days: m.threshold,
      xp: rules.get(m.step_key)?.xp ?? 0,
      deskbits: rules.get(m.step_key)?.deskbits ?? 0,
      // A milestone is permanent: reached once, even if the streak later breaks.
      reached: earned.has(m.step_key) || status.longest_streak >= m.threshold,
    })),
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
    if (action !== "status" && action !== "claim" && action !== "overview") {
      return jsonResponse({ error: "action must be 'status', 'claim' or 'overview'" }, 400);
    }

    const admin = getAdminClient();
    const today = await getCommunityToday(admin);

    let newlyClaimed = false;
    let reward: RewardResult | null = null;
    if (action === "claim") {
      // ignoreDuplicates => a second claim the same day is a harmless no-op.
      const { data, error } = await admin
        .from("daily_checkins")
        .upsert(
          { user_id: user.id, checkin_date: today },
          { onConflict: "user_id,checkin_date", ignoreDuplicates: true }
        )
        .select("id");
      if (error) throw error;
      newlyClaimed = (data ?? []).length > 0;

      // Always ask, even when not newly claimed: grant_reward is idempotent, and
      // this repairs a claim whose payout failed earlier.
      reward = await grantCheckinReward(admin, user.id, today);

      // A second check-in day can complete Paper Pal's rule. Never fails the check-in.
      const { error: palError } = await admin.rpc("grant_paper_pal", { p_user: user.id });
      if (palError) console.error("daily-checkin: grant_paper_pal failed:", palError);
    }

    const status = await getStatus(admin, user.id, today);
    if (action === "overview") {
      return jsonResponse({ ...status, ...(await getOverview(admin, user.id, today, status)) });
    }
    return jsonResponse({ ...status, newly_claimed: newlyClaimed, reward });
  } catch (err) {
    console.error("daily-checkin failed:", err);
    return jsonResponse({ error: "Could not process check-in" }, 500);
  }
});
