// calendar
// Debbie's Buddy Calendar. See migration 0035 and claude/Debbie_Buddy_Calendar_System_Decisions_v1.md.
//   { action: "status", month?: "YYYY-MM" }          -> events for that month, birthdays, sync info
//   { action: "checkin", event_id, code }             -> the member's check-in with the host's code
//   Mods only:
//   { action: "refresh" }                             -> fetch Discord now
//   { action: "moderate", series_id, state?, kind?, category? }
//   { action: "set_code", series_id, code }           -> add, replace or clear (empty) a host code
//
// Discord scheduled events are the source of title, time, place and status. They are fetched
// ONE time per sync interval for everyone (a shared lock in the database), never per visitor.
// A failed fetch is never read as a cancellation; the page keeps the last schedule.
// Host codes are never sent to a member's browser: only to Mods and to the event's own host.
// The check-in window and the lockout are decided in the database function calendar_checkin.
//
// Provisional: the reward values (rule 'event_checkin', inactive until switched on).

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

type Admin = ReturnType<typeof getAdminClient>;

const H = 3_600_000;
const MANILA_OFFSET = 8 * H; // Asia/Manila has no daylight saving time
const DISCORD = "https://discord.com/api/v10";
const CATEGORIES = ["coworking", "reading", "games", "career"];

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

/** Same as must(), for embedded selects whose row shape Postgrest cannot type here. */
async function mustAs<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

// ---------- time helpers (Manila) ----------
const manilaDayStart = (ts: number) => Math.floor((ts + MANILA_OFFSET) / (24 * H)) * 24 * H - MANILA_OFFSET;
/** End of the Manila day the event ends on (exclusive): when check-in closes. */
const windowEnd = (t0: number, t1: number | null) => manilaDayStart(t1 ?? t0) + 24 * H;
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { start: Date.UTC(y, m - 1, 1) - MANILA_OFFSET, end: Date.UTC(y, m, 1) - MANILA_OFFSET };
}
function manilaYm(ts: number) {
  const d = new Date(ts + MANILA_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function shiftYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------- rewards (same pattern as the other features) ----------
type Rule = { xp: number; deskbits: number };
async function loadRule(admin: Admin) {
  const settings = await must<{ earning_enabled: boolean }>(
    admin.from("earning_settings").select("earning_enabled").eq("id", true).single(),
  );
  const rows = await must<{ xp: number; deskbits: number }[]>(
    admin.from("reward_rules").select("xp,deskbits").eq("event_type", "event_checkin").eq("is_active", true),
  );
  const rule: Rule | null = settings.earning_enabled && rows?.[0] ? { xp: rows[0].xp, deskbits: rows[0].deskbits } : null;
  return rule;
}
/** Pay official-event check-ins that have no ledger row yet (idempotent per occurrence). */
async function payCheckins(admin: Admin, userId: string, eventIds: string[], rule: Rule | null) {
  if (!rule || eventIds.length === 0) return;
  const keys = eventIds.map((id) => `event:${id}`);
  const paid = await must<{ source_key: string }[]>(
    admin.from("reward_ledger").select("source_key").eq("user_id", userId).in("source_key", keys),
  );
  const have = new Set((paid ?? []).map((p) => p.source_key));
  for (const key of keys) {
    if (have.has(key)) continue;
    const { error } = await admin.rpc("grant_reward", {
      p_user_id: userId,
      p_event_type: "event_checkin",
      p_source_key: key,
      p_meta: {},
    });
    if (error) console.error("calendar: grant_reward failed:", key, error);
  }
}

// ---------- Discord sync ----------
type DiscordUser = { id: string; username?: string; global_name?: string | null; bot?: boolean };
type DiscordMember = { user?: DiscordUser; nick?: string | null; roles?: string[] };
type DiscordEvent = {
  id: string;
  creator_id?: string | null;
  creator?: DiscordUser | null;
  name: string;
  description?: string | null;
  scheduled_start_time: string;
  scheduled_end_time?: string | null;
  status: number; // 1 scheduled, 2 active, 3 completed, 4 canceled
  channel_id?: string | null;
  entity_metadata?: { location?: string | null } | null;
  recurrence_rule?: unknown;
};

async function discordGet<T>(path: string): Promise<T> {
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  const res = await fetch(`${DISCORD}${path}`, {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Discord ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

const displayName = (m: DiscordMember | null | undefined, fallback?: DiscordUser | null) =>
  m?.nick || m?.user?.global_name || m?.user?.username || fallback?.global_name || fallback?.username || null;

async function syncEvents(admin: Admin, teamRoles: string[]) {
  const guild = Deno.env.get("DISCORD_GUILD_ID");
  if (!guild) throw new Error("DISCORD_GUILD_ID is not set");
  const startedAt = new Date().toISOString();

  const events = await discordGet<DiscordEvent[]>(`/guilds/${guild}/scheduled-events`);
  const channelNames = new Map<string, string>();
  try {
    const chans = await discordGet<{ id: string; name: string }[]>(`/guilds/${guild}/channels`);
    for (const c of chans) channelNames.set(c.id, c.name);
  } catch (e) {
    console.error("calendar: channel names unavailable:", e);
  }

  const known = await must<{ id: string; discord_event_id: string; recurring: boolean }[]>(
    admin.from("event_series").select("id,discord_event_id,recurring"),
  );
  const seriesByEvent = new Map((known ?? []).map((s) => [s.discord_event_id, s]));
  const memberCache = new Map<string, DiscordMember | null>();

  for (const e of events) {
    const recurring = !!e.recurrence_rule;
    let series = seriesByEvent.get(e.id);
    if (!series) {
      const creator = e.creator_id ?? e.creator?.id ?? null;
      let member: DiscordMember | null = null;
      if (creator) {
        if (!memberCache.has(creator)) {
          try {
            memberCache.set(creator, await discordGet<DiscordMember>(`/guilds/${guild}/members/${creator}`));
          } catch {
            memberCache.set(creator, null);
          }
        }
        member = memberCache.get(creator) ?? null;
      }
      const isTeam = !!member?.roles?.some((r) => teamRoles.includes(r));
      const row = await must<{ id: string }>(
        admin
          .from("event_series")
          .insert({
            discord_event_id: e.id,
            creator_discord_id: creator,
            host_name: displayName(member, e.creator),
            recurring,
            state: isTeam ? "shown" : "pending",
            kind: isTeam ? "official" : "member",
          })
          .select("id")
          .single(),
      );
      series = { id: row.id, discord_event_id: e.id, recurring };
      seriesByEvent.set(e.id, series);
    } else if (series.recurring !== recurring) {
      await admin.from("event_series").update({ recurring }).eq("id", series.id);
    }

    const location = e.entity_metadata?.location || (e.channel_id ? channelNames.get(e.channel_id) ?? null : null);
    const fields = {
      ends_at: e.scheduled_end_time ?? null,
      title: e.name,
      description: e.description ?? null,
      location,
      status: e.status === 4 ? "cancelled" : "scheduled",
      last_seen_at: new Date().toISOString(),
    };

    if (recurring) {
      const { error } = await admin
        .from("calendar_events")
        .upsert({ series_id: series.id, starts_at: e.scheduled_start_time, ...fields }, { onConflict: "series_id,starts_at" });
      if (error) throw error;
    } else {
      // A one-off event keeps one row: if the host moves it, the same row moves with it.
      const existing = await must<{ id: string }[]>(
        admin.from("calendar_events").select("id").eq("series_id", series.id).order("starts_at", { ascending: false }).limit(1),
      );
      if (existing?.[0]) {
        const { error } = await admin
          .from("calendar_events")
          .update({ starts_at: e.scheduled_start_time, ...fields })
          .eq("id", existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("calendar_events").insert({ series_id: series.id, starts_at: e.scheduled_start_time, ...fields });
        if (error) throw error;
      }
    }
  }

  // After a SUCCESSFUL fetch only: a coming occurrence Discord no longer lists was cancelled or deleted.
  // It stays on record and shows as cancelled. Past occurrences are never touched.
  await admin
    .from("calendar_events")
    .update({ status: "cancelled" })
    .eq("status", "scheduled")
    .gt("starts_at", startedAt)
    .lt("last_seen_at", startedAt);
}

async function syncBirthdays(admin: Admin) {
  const guild = Deno.env.get("DISCORD_GUILD_ID");
  if (!guild) throw new Error("DISCORD_GUILD_ID is not set");
  const roles = await must<{ month: number; role_id: string | null }[]>(
    admin.from("birthday_month_roles").select("month,role_id").not("role_id", "is", null),
  );
  if (!roles || roles.length === 0) return;
  const monthOfRole = new Map(roles.map((r) => [r.role_id as string, r.month]));
  const names = new Map<number, string[]>(roles.map((r) => [r.month, []]));
  const people = new Map<number, { d: string; n: string }[]>(roles.map((r) => [r.month, []]));

  // Needs the bot's "Server Members" privileged intent. If Discord refuses, this throws and
  // the last saved names stay in place.
  let after = "0";
  for (let page = 0; page < 20; page++) {
    const batch = await discordGet<DiscordMember[]>(`/guilds/${guild}/members?limit=1000&after=${after}`);
    for (const m of batch) {
      if (m.user?.bot) continue;
      const hit = (m.roles ?? []).find((r) => monthOfRole.has(r));
      if (!hit) continue;
      const name = displayName(m);
      if (name) {
        names.get(monthOfRole.get(hit) as number)?.push(name);
        if (m.user?.id) people.get(monthOfRole.get(hit) as number)?.push({ d: m.user.id, n: name });
      }
    }
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user?.id ?? "";
    if (!after) break;
  }
  for (const [month, list] of names) {
    await admin
      .from("birthday_names")
      .upsert({
        month,
        names: list.sort((a, b) => a.localeCompare(b)),
        people: (people.get(month) ?? []).sort((a, b) => a.n.localeCompare(b.n)),
        updated_at: new Date().toISOString(),
      });
  }
}

type Settings = {
  team_role_ids: string[];
  sync_minutes: number;
  history_months: number;
  last_synced_at: string | null;
  last_attempt_failed: boolean;
  birthdays_synced_at: string | null;
};

/** Run the shared sync if it is due (or forced) and nobody else is already running it. */
async function maybeSync(admin: Admin, force: boolean) {
  const got = await must<boolean>(admin.rpc("calendar_try_lock", { p_force: force }));
  if (!got) return;
  let failed = false;
  try {
    const s = await must<Settings>(admin.from("calendar_settings").select("*").eq("id", true).single());
    try {
      await syncEvents(admin, s.team_role_ids ?? []);
      await admin.from("calendar_settings").update({ last_synced_at: new Date().toISOString() }).eq("id", true);
    } catch (e) {
      failed = true;
      console.error("calendar: event sync failed:", e);
    }
    const stale = !s.birthdays_synced_at || Date.now() - Date.parse(s.birthdays_synced_at) > 6 * H;
    if (!failed && (stale || force)) {
      try {
        await syncBirthdays(admin);
        await admin.from("calendar_settings").update({ birthdays_synced_at: new Date().toISOString() }).eq("id", true);
      } catch (e) {
        console.error("calendar: birthday sync failed:", e);
      }
    }
  } finally {
    await admin.from("calendar_settings").update({ sync_started_at: null, last_attempt_failed: failed }).eq("id", true);
  }
}

// ---------- status ----------
type EventRow = {
  id: string;
  series_id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  description: string | null;
  location: string | null;
  status: "scheduled" | "cancelled";
  event_series: {
    state: string;
    kind: "official" | "member";
    category: string | null;
    host_code: string | null;
    host_name: string | null;
    creator_discord_id: string | null;
    discord_event_id: string;
  };
};

async function buildStatus(admin: Admin, userId: string, discordId: string, isMod: boolean, requested: string | undefined) {
  const now = Date.now();
  const settings = await must<Settings>(admin.from("calendar_settings").select("*").eq("id", true).single());
  const thisMonth = manilaYm(now);
  const earliest = shiftYm(thisMonth, -settings.history_months);
  const latest = shiftYm(thisMonth, 6);
  let month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : thisMonth;
  if (month < earliest) month = earliest;
  if (month > latest) month = latest;
  const { start, end } = monthBounds(month);

  const rows = await mustAs<EventRow[]>(
    admin
      .from("calendar_events")
      .select(
        "id,series_id,starts_at,ends_at,title,description,location,status,event_series!inner(state,kind,category,host_code,host_name,creator_discord_id,discord_event_id)",
      )
      .eq("event_series.state", "shown")
      .gte("starts_at", new Date(start).toISOString())
      .lt("starts_at", new Date(end).toISOString())
      .order("starts_at"),
  );
  const list = rows ?? [];
  const ids = list.map((r) => r.id);

  const mine = ids.length
    ? await must<{ event_id: string }[]>(admin.from("event_checkins").select("event_id").eq("user_id", userId).in("event_id", ids))
    : [];
  const checkedIn = new Set((mine ?? []).map((m) => m.event_id));
  const recent = ids.length
    ? await must<{ event_id: string }[]>(
        admin
          .from("event_checkin_attempts")
          .select("event_id")
          .eq("user_id", userId)
          .in("event_id", ids)
          .gt("created_at", new Date(now - 15 * 60_000).toISOString()),
      )
    : [];
  const tries = new Map<string, number>();
  for (const a of recent ?? []) tries.set(a.event_id, (tries.get(a.event_id) ?? 0) + 1);

  // Catch up any official check-in that has not been paid yet (idempotent).
  const rule = await loadRule(admin);
  await payCheckins(admin, userId, list.filter((r) => checkedIn.has(r.id) && r.event_series.kind === "official").map((r) => r.id), rule);

  const guild = Deno.env.get("DISCORD_GUILD_ID") ?? "";
  const events = list.map((r) => {
    const t0 = Date.parse(r.starts_at);
    const t1 = r.ends_at ? Date.parse(r.ends_at) : null;
    const we = windowEnd(t0, t1);
    const liveEnd = t1 ?? t0 + H;
    const phase = r.status === "cancelled" ? "cancelled" : now < t0 ? "upcoming" : now < liveEnd ? "live" : now < we ? "after" : "closed";
    const s = r.event_series;
    const isHost = !!s.creator_discord_id && s.creator_discord_id === discordId;
    return {
      id: r.id,
      series_id: r.series_id,
      title: r.title,
      description: r.description,
      location: r.location,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      category: s.category,
      kind: s.kind,
      host: s.host_name,
      phase,
      window_ends_at: new Date(we).toISOString(),
      checked_in: checkedIn.has(r.id),
      locked: (tries.get(r.id) ?? 0) >= 5,
      code_set: !!s.host_code,
      host_code: isMod || isHost ? s.host_code : null,
      discord_url: guild ? `https://discord.com/events/${guild}/${s.discord_event_id}` : null,
    };
  });

  const total = await must<number>(
    admin
      .from("calendar_events")
      .select("id, event_series!inner(state)", { count: "exact", head: true })
      .eq("event_series.state", "shown")
      .then((r: { count: number | null; error: unknown }) => ({ data: r.count ?? 0, error: r.error })),
  );

  // Birthdays: only shown when the month roles have been configured.
  const roleRows = await must<{ month: number }[]>(
    admin.from("birthday_month_roles").select("month").not("role_id", "is", null),
  );
  let birthdays: { configured: boolean; names: string[]; people: { name: string; id: string | null }[] } = { configured: false, names: [], people: [] };
  if ((roleRows ?? []).length > 0 && settings.birthdays_synced_at) {
    const m = Number(month.slice(5));
    const b = await must<{ names: string[]; people: { d: string; n: string }[] }[]>(
      admin.from("birthday_names").select("names,people").eq("month", m),
    );
    const names = b?.[0]?.names ?? [];
    const raw = Array.isArray(b?.[0]?.people) ? (b?.[0]?.people ?? []) : [];
    // A name opens a profile only when that person has signed in to Debbie and is a member.
    // The Discord id stays on the server; the browser gets the Debbie member id or null.
    const ids = raw.map((x) => x.d).filter((d) => typeof d === "string");
    const found = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await admin.from("profiles").select("id,discord_id").in("discord_id", ids).eq("is_member", true);
      for (const pr of profs ?? []) found.set(pr.discord_id as string, pr.id as string);
    }
    const people = raw.length > 0 ? raw.map((x) => ({ name: x.n, id: found.get(x.d) ?? null })) : names.map((n) => ({ name: n, id: null }));
    birthdays = { configured: true, names, people };
  }

  let pending: unknown[] = [];
  if (isMod) {
    const p = await must<{ id: string; host_name: string | null; recurring: boolean; calendar_events: { title: string; starts_at: string }[] }[]>(
      admin
        .from("event_series")
        .select("id,host_name,recurring,calendar_events(title,starts_at)")
        .eq("state", "pending")
        .order("created_at", { ascending: false })
        .limit(30),
    );
    pending = (p ?? []).map((s) => {
      const latest = [...(s.calendar_events ?? [])].sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))[0];
      return { series_id: s.id, title: latest?.title ?? "Untitled event", starts_at: latest?.starts_at ?? null, host: s.host_name, recurring: s.recurring };
    });
  }

  return {
    now: new Date(now).toISOString(),
    month,
    earliest_month: earliest,
    latest_month: latest,
    events,
    has_any_events: total > 0,
    birthdays,
    sync: { last_synced_at: settings.last_synced_at, failed: settings.last_attempt_failed },
    checkin_reward: rule,
    is_mod: isMod,
    pending,
    discord_server_url: guild ? `https://discord.com/channels/${guild}` : null,
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user, profile } = auth;
  const isMod = !!profile.is_mod;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["status", "checkin", "refresh", "moderate", "set_code"].includes(action)) {
      return jsonResponse({ error: "unknown action" }, 400);
    }
    const admin = getAdminClient();
    let result: { action: string; status: string } | null = null;

    if (action === "checkin") {
      const eventId = typeof body?.event_id === "string" ? body.event_id : "";
      const code = typeof body?.code === "string" ? body.code.slice(0, 40) : "";
      if (!eventId) return jsonResponse({ error: "event_id is required" }, 400);
      if (!code.trim()) {
        result = { action, status: "empty" };
      } else {
        const status = await must<string>(
          admin.rpc("calendar_checkin", { p_user: user.id, p_event: eventId, p_code: code }),
        );
        result = { action, status };
        if (status === "ok" || status === "already") {
          const ev = await mustAs<{ event_series: { kind: string } }[]>(
            admin.from("calendar_events").select("event_series!inner(kind)").eq("id", eventId).limit(1),
          );
          // Official events pay; member-hosted check-ins are recorded and count toward nothing yet.
          if (ev?.[0]?.event_series.kind === "official") await payCheckins(admin, user.id, [eventId], await loadRule(admin));
        }
      }
    } else if (action === "refresh" || action === "moderate" || action === "set_code") {
      if (!isMod) return jsonResponse({ error: "MOD access required" }, 403);
      if (action === "refresh") {
        await maybeSync(admin, true);
        result = { action, status: "ok" };
      } else {
        const seriesId = typeof body?.series_id === "string" ? body.series_id : "";
        if (!seriesId) return jsonResponse({ error: "series_id is required" }, 400);
        if (action === "set_code") {
          const raw = typeof body?.code === "string" ? body.code.trim() : "";
          if (raw && (raw.length < 3 || raw.length > 40)) return jsonResponse({ error: "A code is 3 to 40 characters." }, 400);
          const { error } = await admin.from("event_series").update({ host_code: raw || null }).eq("id", seriesId);
          if (error) throw error;
          // A new code starts everyone's tries fresh.
          await admin.from("event_checkin_attempts").delete().in(
            "event_id",
            (await must<{ id: string }[]>(admin.from("calendar_events").select("id").eq("series_id", seriesId))).map((r) => r.id),
          );
          result = { action, status: "ok" };
        } else {
          const patch: Record<string, unknown> = {};
          if (body?.state !== undefined) {
            if (!["shown", "hidden", "pending"].includes(body.state)) return jsonResponse({ error: "bad state" }, 400);
            patch.state = body.state;
          }
          if (body?.kind !== undefined) {
            if (!["official", "member"].includes(body.kind)) return jsonResponse({ error: "bad kind" }, 400);
            patch.kind = body.kind;
          }
          if (body?.category !== undefined) {
            if (body.category !== null && !CATEGORIES.includes(body.category)) return jsonResponse({ error: "bad category" }, 400);
            patch.category = body.category;
          }
          if (Object.keys(patch).length === 0) return jsonResponse({ error: "nothing to change" }, 400);
          const { error } = await admin.from("event_series").update(patch).eq("id", seriesId);
          if (error) throw error;
          result = { action, status: "ok" };
        }
      }
    } else {
      await maybeSync(admin, false);
    }

    const status = await buildStatus(admin, user.id, profile.discord_id, isMod, body?.month);
    return jsonResponse({ ...status, result });
  } catch (err) {
    console.error("calendar error:", err);
    return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
  }
});
