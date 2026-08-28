import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";
import { env } from "./env.js";
import type { Command } from "./command.js";

import playCommand from "./commands/play.js";
import skipCommand from "./commands/skip.js";
import pauseCommand from "./commands/pause.js";
import resumeCommand from "./commands/resume.js";
import stopCommand from "./commands/stop.js";
import queueCommand from "./commands/queue.js";
import nowPlayingCommand from "./commands/nowplaying.js";
import setDjRoleCommand from "./commands/setdjrole.js";

const client = new Client({
  intents: [
    // Guilds: required for any slash-command interaction and to see
    // channels/roles at all.
    GatewayIntentBits.Guilds,
    // Needed so the bot can see who's in a voice channel (e.g. for the
    // "leave when empty" behavior) — not privileged, no Developer Portal
    // toggle required, unlike Server Members/Message Content.
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const commands = new Collection<string, Command>();
for (const command of [
  playCommand,
  skipCommand,
  pauseCommand,
  resumeCommand,
  stopCommand,
  queueCommand,
  nowPlayingCommand,
  setDjRoleCommand,
]) {
  commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}. Serving ${readyClient.guilds.cache.size} server(s).`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[command:${interaction.commandName}] error:`, err);
    const payload = {
      content: "Something went wrong running that command — check the bot's logs.",
      flags: MessageFlags.Ephemeral,
    } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(env.discordBotToken);

process.on("SIGINT", () => {
  console.log("Shutting down...");
  client.destroy();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  client.destroy();
  process.exit(0);
});
