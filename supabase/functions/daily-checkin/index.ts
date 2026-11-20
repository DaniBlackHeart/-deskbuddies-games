// daily-checkin
// Debbie's daily check-in. Two actions:
//   { action: "status" } -> where the caller's streak stands (read-only)
//   { action: "claim" }  -> check in for today (safe to call repeatedly)
//
// The browser never says what day it is or what the streak is. The day is
// computed here in Asia/Manila, and the streak is derived from stored rows.
// Streak-only for now: no XP/currency is granted (reward values undecided).

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  requireMember,
} from "../_shared/utils.ts";

// Community day boundary. Change here (one place) if the community moves.
const CHECKIN_TIMEZONE = "Asia/Manila";
const DAY_MS = 24 * 60 * 60 * 1000;

function dateInZone(ms: number): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHECKIN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function dayNumber(ymd: string): number {
  // Whole days since epoch for a YYYY-MM-DD string (timezone-free math).
  return Math.round(Date.parse(ymd + "T00:00:00Z") / DAY_MS);
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

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "status" && action !== "claim") {
      return jsonResponse({ error: "action must be 'status' or 'claim'" }, 400);
    }

    const admin = getAdminClient();
    const today = dateInZone(Date.now());

    let newlyClaimed = false;
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
    }

    const status = await getStatus(admin, user.id, today);
    return jsonResponse({ ...status, newly_claimed: newlyClaimed });
  } catch (err) {
    console.error("daily-checkin failed:", err);
    return jsonResponse({ error: "Could not process check-in" }, 500);
  }
});
