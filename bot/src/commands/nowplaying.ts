import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.js";
import { getQueue } from "../music/manager.js";
import { formatDuration } from "../lib/format.js";

const data = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Show the currently playing track") as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
    return;
  }
  const current = getQueue(interaction.guildId)?.nowPlaying();
  if (!current) {
    await interaction.reply("Nothing's playing right now.");
    return;
  }

  await interaction.reply(
    `🎵 **${current.title}** (${formatDuration(current.durationSec)}) — requested by ${current.requestedByName}`
  );
}

export default { data, execute } satisfies Command;
