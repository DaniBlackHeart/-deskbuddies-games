import { ChatInputCommandInteraction, GuildMember } from "discord.js";

/**
 * Resolves the real GuildMember for a guild-scoped interaction, regardless
 * of whether discord.js already had it cached (`interaction.member` can be
 * a full GuildMember or a raw partial object depending on cache state) —
 * callers get a real GuildMember either way, so `.voice`, `.roles`, and
 * `.permissions` always work correctly.
 */
export async function resolveMember(
  interaction: ChatInputCommandInteraction<"raw" | "cached">
): Promise<GuildMember> {
  if (interaction.member instanceof GuildMember) {
    return interaction.member;
  }
  // 'raw' interactions (an uncached guild) have a null `.guild` even though
  // `.guildId` is always present — fall back to fetching the guild itself
  // first in that case.
  const guild = interaction.guild ?? (await interaction.client.guilds.fetch(interaction.guildId));
  return guild.members.fetch(interaction.user.id);
}
