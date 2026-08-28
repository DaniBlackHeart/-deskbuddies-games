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
  const member = await resolveMember(interaction);
  if (!(await canControlMusic(member))) {
    await interaction.reply({
      content: "You need the DJ role (or Manage Server) to control music here.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const queue = getQueue(interaction.guildId);
  if (!queue || !queue.pause()) {
    await interaction.reply({ content: "Nothing's playing right now.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply("Paused. ⏸️");
}

export default { data, execute } satisfies Command;
