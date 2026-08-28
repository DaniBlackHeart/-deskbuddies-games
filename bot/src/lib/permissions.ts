import { GuildMember, PermissionFlagsBits } from "discord.js";
import { getMusicSettings } from "./supabase.js";

/**
 * DJ-role gate for playback-control commands (/play, /skip, /pause, /resume,
 * /stop). Rules, in order:
 *   1. Server admins / anyone with Manage Guild can always control playback
 *      (same "mods can override" shape the games app uses for its MOD role).
 *   2. If a DJ role has been configured (`/setdjrole`), members holding that
 *      role can control playback.
 *   3. If no DJ role has been configured yet, playback control is
 *      restricted to admins/Manage Guild — i.e. the bot defaults to
 *      role-gated-and-closed, not open-to-everyone, until a MOD deliberately
 *      opens it up with /setdjrole. This matches what was actually asked
 *      for ("only a certain role can use it") rather than assuming an
 *      open-by-default music bot.
 */
export async function canControlMusic(member: GuildMember): Promise<boolean> {
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  const settings = await getMusicSettings(member.guild.id);
  if (!settings?.dj_role_id) {
    return false;
  }

  return member.roles.cache.has(settings.dj_role_id);
}

/** Only server admins / Manage Guild may change the DJ role itself. */
export function canManageMusicSettings(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}
