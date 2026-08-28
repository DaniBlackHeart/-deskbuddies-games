// Registers (or updates) this bot's slash commands with Discord.
//
// Run with `npm run register-commands` after adding/changing a command, or
// after first deploying. If DISCORD_DEV_GUILD_ID is set, commands register
// to that one server instantly — handy while developing, since global
// command updates can take up to an hour to show up everywhere. Leave it
// unset for the real production registration (global, all servers the bot
// is in).
import { REST, Routes } from "discord.js";
import { env } from "./env.js";

import playCommand from "./commands/play.js";
import skipCommand from "./commands/skip.js";
import pauseCommand from "./commands/pause.js";
import resumeCommand from "./commands/resume.js";
import stopCommand from "./commands/stop.js";
import queueCommand from "./commands/queue.js";
import nowPlayingCommand from "./commands/nowplaying.js";
import setDjRoleCommand from "./commands/setdjrole.js";

const commandsJson = [
  playCommand,
  skipCommand,
  pauseCommand,
  resumeCommand,
  stopCommand,
  queueCommand,
  nowPlayingCommand,
  setDjRoleCommand,
].map((c) => c.data.toJSON());

const rest = new REST().setToken(env.discordBotToken);

async function main() {
  const route = env.discordDevGuildId
    ? Routes.applicationGuildCommands(env.discordClientId, env.discordDevGuildId)
    : Routes.applicationCommands(env.discordClientId);

  console.log(
    env.discordDevGuildId
      ? `Registering ${commandsJson.length} commands to dev guild ${env.discordDevGuildId}...`
      : `Registering ${commandsJson.length} commands globally (can take up to an hour to propagate)...`
  );

  await rest.put(route, { body: commandsJson });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to register commands:", err);
  process.exit(1);
});
