import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../env.js";

const execFileAsync = promisify(execFile);

// yt-dlp's own JSON output can be large for some extractors — 10MB is
// comfortably more than a single video/search result needs.
const MAX_BUFFER = 10 * 1024 * 1024;

interface YtDlpVideoInfo {
  title: string;
  webpage_url: string;
  duration: number | null;
}

/**
 * Resolves a search query or a direct URL (YouTube, SoundCloud, etc — anything
 * yt-dlp supports) to a single video's metadata. For a bare search string,
 * pass it prefixed as `ytsearch1:<text>` — that's yt-dlp's own search syntax,
 * so this function doesn't need to know which case it's in.
 */
export async function ytDlpLookup(queryOrUrl: string): Promise<YtDlpVideoInfo | null> {
  try {
    const { stdout } = await execFileAsync(
      env.ytDlpPath,
      ["--dump-single-json", "--no-warnings", "--no-playlist", queryOrUrl],
      { maxBuffer: MAX_BUFFER, timeout: 30_000 }
    );

    const parsed = JSON.parse(stdout);
    // A search query (ytsearchN:) comes back as a playlist-shaped object
    // with `entries`; a direct video URL comes back as the video object
    // itself. Normalize both to the same shape.
    const info = Array.isArray(parsed.entries) ? parsed.entries[0] : parsed;
    if (!info || !info.webpage_url) return null;

    return {
      title: info.title ?? "Unknown title",
      webpage_url: info.webpage_url,
      duration: typeof info.duration === "number" ? info.duration : null,
    };
  } catch (err) {
    console.error(`[yt-dlp] lookup failed for "${queryOrUrl}":`, err);
    return null;
  }
}

/**
 * Gets a fresh direct, playable media URL for a webpage URL. Called right
 * before playback starts (not cached long-term) — these signed URLs
 * typically expire after a few hours, so resolving at play-time avoids
 * queueing a track now and having it fail to play later.
 */
export async function ytDlpDirectStreamUrl(webpageUrl: string): Promise<string> {
  const { stdout } = await execFileAsync(
    env.ytDlpPath,
    ["-f", "bestaudio/best", "-g", "--no-playlist", webpageUrl],
    { maxBuffer: MAX_BUFFER, timeout: 30_000 }
  );

  const url = stdout.trim().split("\n")[0];
  if (!url) {
    throw new Error(`yt-dlp returned no playable stream URL for ${webpageUrl}`);
  }
  return url;
}
