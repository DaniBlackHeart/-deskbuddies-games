import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

// Service-role client — this process is a trusted backend (same trust level
// as the frontend's Supabase Edge Functions), never exposed to the browser.
// music_settings has RLS enabled with zero client-facing policies, matching
// the rest of this repo's "defense in depth" pattern (see PROJECT_CONTEXT.md
// §4) — only this service-role key can read or write it.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

export interface MusicSettings {
  guild_id: string;
  dj_role_id: string | null;
  default_volume: number | null;
}

const cache = new Map<string, { value: MusicSettings | null; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

/** Cached read so every command invocation doesn't round-trip to Postgres. */
export async function getMusicSettings(guildId: string): Promise<MusicSettings | null> {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const { data, error } = await supabase
    .from("music_settings")
    .select("guild_id, dj_role_id, default_volume")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) {
    console.error(`[supabase] Failed to load music_settings for guild ${guildId}:`, error);
    // Fail closed on the settings read: return null (treated as "no DJ role
    // configured yet") rather than throwing, so a transient DB hiccup
    // doesn't take music playback down entirely — the DJ-role check already
    // requires Manage Guild in this state, so nothing is opened up by it.
    return null;
  }

  cache.set(guildId, { value: data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function setDjRole(guildId: string, roleId: string | null): Promise<void> {
  const { error } = await supabase
    .from("music_settings")
    .upsert({ guild_id: guildId, dj_role_id: roleId }, { onConflict: "guild_id" });

  if (error) {
    throw new Error(`Could not save DJ role setting: ${error.message}`);
  }

  cache.delete(guildId);
}
