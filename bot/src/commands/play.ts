import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../command.js";
import { canControlMusic } from "../lib/permissions.js";
import { resolveMember } from "../lib/discord-helpers.js";
import { getOrCreateQueue } from "../music/manager.js";
import { resolveTracksForQuery } from "../music/resolve.js";
import { formatDuration } from "../lib/format.js";

const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a song — a search term, YouTube/SoundCloud link, or Spotify link")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Song name, YouTube/SoundCloud URL, or Spotify track/playlist/album link")
      .setRequired(true)
  ) as SlashCommandBuilder;

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

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: "Join a voice channel first, then try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const query = interaction.options.getString("query", true);
  await interaction.deferReply();

  let tracks;
  try {
    tracks = await resolveTracksForQuery(query, member.id, member.displayName);
  } catch (err) {
    console.error("[play] resolve failed:", err);
    const message = err instanceof Error ? err.message : "Couldn't resolve that link.";
    await interaction.editReply(message);
    return;
  }

  if (tracks.length === 0) {
    await interaction.editReply(`Couldn't find anything for **${query}**.`);
    return;
  }

  const guildQueue = getOrCreateQueue(interaction.guildId);
  guildQueue.statusChannel = interaction.channel;

  try {
    await guildQueue.connect(voiceChannel);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't join your voice channel.";
    await interaction.editReply(message);
    return;
  }

  guildQueue.enqueue(tracks);

  if (tracks.length === 1) {
    const [track] = tracks;
    await interaction.editReply(
      `Queued: **${track.title}** (${formatDuration(track.durationSec)})` +
        (track.spotifySourceLabel ? `\n_from Spotify: ${track.spotifySourceLabel}_` : "")
    );
  } else {
    await interaction.editReply(`Queued **${tracks.length} tracks** from that link.`);
  }
}

export default { data, execute } satisfies Command;
