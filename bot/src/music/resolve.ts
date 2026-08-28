import { ytDlpLookup } from "./ytdlp.js";
import { parseSpotifyLink, resolveSpotifyLink } from "./spotify.js";
import type { Track } from "./types.js";

function isUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

/** Run a small batch of async jobs with limited concurrency, so resolving a
 * Spotify playlist doesn't fire off 25 simultaneous yt-dlp processes. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      const result = await fn(current);
      if (result) results.push(result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Turns whatever a member typed into /play's `query` option into one or more
 * playable Tracks. Handles, in order: a Spotify link (resolved to a
 * title+artist search, since Spotify's API never gives out raw audio — see
 * spotify.ts), any other URL yt-dlp understands directly (YouTube,
 * SoundCloud, ...), or plain text treated as a YouTube search.
 */
export async function resolveTracksForQuery(
  query: string,
  requestedById: string,
  requestedByName: string
): Promise<Track[]> {
  if (parseSpotifyLink(query)) {
    const refs = await resolveSpotifyLink(query);
    if (!refs || refs.length === 0) {
      return [];
    }

    const resolved = await mapWithConcurrency(refs, 3, async (ref) => {
      const info = await ytDlpLookup(`ytsearch1:${ref.searchQuery}`);
      if (!info) return null;
      const track: Track = {
        title: info.title,
        webpageUrl: info.webpage_url,
        durationSec: info.duration,
        requestedById,
        requestedByName,
        spotifySourceLabel: ref.label,
      };
      return track;
    });

    return resolved;
  }

  const lookupTarget = isUrl(query) ? query : `ytsearch1:${query}`;
  const info = await ytDlpLookup(lookupTarget);
  if (!info) return [];

  return [
    {
      title: info.title,
      webpageUrl: info.webpage_url,
      durationSec: info.duration,
      requestedById,
      requestedByName,
    },
  ];
}
