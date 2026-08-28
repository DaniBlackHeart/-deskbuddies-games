import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in — see SETUP.md.`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

export const env = {
  discordBotToken: required("DISCORD_BOT_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordDevGuildId: optional("DISCORD_DEV_GUILD_ID"),

  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  spotifyClientId: optional("SPOTIFY_CLIENT_ID"),
  spotifyClientSecret: optional("SPOTIFY_CLIENT_SECRET"),

  ytDlpPath: process.env.YTDLP_PATH?.trim() || "yt-dlp",
  ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg",

  defaultVolume: Number(process.env.DEFAULT_VOLUME ?? "0.5"),
};

export const spotifyConfigured = Boolean(
  env.spotifyClientId && env.spotifyClientSecret
);
