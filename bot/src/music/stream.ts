import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { env } from "../env.js";
import { ytDlpDirectStreamUrl } from "./ytdlp.js";

export interface AudioStreamHandle {
  /** Raw PCM (s16le, 48kHz, stereo) — what @discordjs/voice's StreamType.Raw expects. */
  stream: ChildProcessWithoutNullStreams["stdout"];
  /** Call when playback stops/skips, so the ffmpeg process doesn't linger. */
  kill: () => void;
}

/**
 * Resolves a fresh direct media URL for `webpageUrl` and starts ffmpeg
 * transcoding it to raw PCM piped to stdout. One ffmpeg process per track,
 * killed on skip/stop/track-end — @discordjs/voice handles the actual Opus
 * encoding + encryption from there.
 */
export async function startAudioStream(webpageUrl: string): Promise<AudioStreamHandle> {
  const directUrl = await ytDlpDirectStreamUrl(webpageUrl);

  const ffmpeg = spawn(env.ffmpegPath, [
    // Tolerate the odd network blip on a long-lived HTTP stream rather than
    // dying on the first hiccup.
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", directUrl,
    "-analyzeduration", "0",
    "-loglevel", "error",
    "-vn",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1",
  ]);

  ffmpeg.stderr.on("data", (chunk: Buffer) => {
    console.error(`[ffmpeg] ${chunk.toString().trim()}`);
  });

  let killed = false;
  const kill = () => {
    if (killed) return;
    killed = true;
    ffmpeg.kill("SIGKILL");
  };

  ffmpeg.on("error", (err) => {
    console.error("[ffmpeg] process error:", err);
  });

  return { stream: ffmpeg.stdout, kill };
}
