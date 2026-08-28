import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.js";
import { canControlMusic } from "../lib/permissions.js";
import { resolveMember } from "../lib/discord-helpers.js";
import { getQueue } from "../music/manager.js";

const data = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pause the current track") as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Ack Discord immediately — the DJ-role check below hits Supabase, and
  // Discord requires the initial response within 3 seconds or it shows
  // "The application did not respond" even if the command would have
  // otherwise succeeded a moment later.
  await interaction.deferReply();

  const member = await resolveMember(interaction);
  if (!(await canControlMusic(member))) {
    await interaction.editReply("You need the DJ role (or Manage Server) to control music here.");
    return;
  }

  const queue = getQueue(interaction.guildId);
  if (!queue || !queue.pause()) {
    await interaction.editReply("Nothing's playing right now.");
    return;
  }

  await interaction.editReply("Paused. ⏸️");
}

export default { data, execute } satisfies Command;
