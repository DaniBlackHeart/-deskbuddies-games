import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.js";
import { getQueue } from "../music/manager.js";
import { formatDuration } from "../lib/format.js";

// Read-only — intentionally not DJ-role-gated, same reasoning as /nowplaying:
// anyone in the server can see what's queued, only playback control itself
// is restricted.
const data = new SlashCommandBuilder()
  .setName("queue")
  .setDescription("Show the current queue") as SlashCommandBuilder;

const MAX_SHOWN = 10;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
    return;
  }
  const queue = getQueue(interaction.guildId);
  const current = queue?.nowPlaying();
  const upcoming = queue?.listQueue() ?? [];

  if (!current && upcoming.length === 0) {
    await interaction.reply("Nothing's queued right now.");
    return;
  }

  const lines: string[] = [];
  if (current) {
    lines.push(`**Now playing:** ${current.title} (${formatDuration(current.durationSec)})`);
  }
  if (upcoming.length > 0) {
    lines.push("", "**Up next:**");
    upcoming.slice(0, MAX_SHOWN).forEach((track, i) => {
      lines.push(`${i + 1}. ${track.title} (${formatDuration(track.durationSec)}) — added by ${track.requestedByName}`);
    });
    if (upcoming.length > MAX_SHOWN) {
      lines.push(`...and ${upcoming.length - MAX_SHOWN} more.`);
    }
  }

  await interaction.reply(lines.join("\n"));
}

export default { data, execute } satisfies Command;
