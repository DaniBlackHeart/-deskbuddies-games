import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.js";
import { canControlMusic } from "../lib/permissions.js";
import { resolveMember } from "../lib/discord-helpers.js";
import { destroyQueue, getQueue } from "../music/manager.js";

const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop playback, clear the queue, and leave the voice channel") as SlashCommandBuilder;

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

  const guildId = interaction.guildId;
  if (!getQueue(guildId)) {
    await interaction.reply({ content: "I'm not playing anything here.", flags: MessageFlags.Ephemeral });
    return;
  }

  destroyQueue(guildId);
  await interaction.reply("Stopped and left the voice channel. 👋");
}

export default { data, execute } satisfies Command;
