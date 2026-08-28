import { env, spotifyConfigured } from "../env.js";

interface SpotifyToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: SpotifyToken | null = null;

/**
 * Client Credentials flow — no user login involved, just proves this app is
 * allowed to read public catalog data. Only used to translate a Spotify link
 * into a track name + artist; the actual audio always comes from yt-dlp,
 * since Spotify's API never hands out raw audio (see the earlier
 * conversation — this is a hard platform restriction, not a bug to work
 * around).
 */
async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const basic = Buffer.from(
    `${env.spotifyClientId}:${env.spotifyClientSecret}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    // Refresh a minute early to avoid a request landing right on expiry.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.accessToken;
}

export type SpotifyLinkKind = "track" | "playlist" | "album";

export function parseSpotifyLink(
  input: string
): { kind: SpotifyLinkKind; id: string } | null {
  const match = input.match(
    /open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/
  );
  if (!match) return null;
  return { kind: match[1] as SpotifyLinkKind, id: match[2] };
}

export interface SpotifyTrackRef {
  searchQuery: string;
  label: string;
}

async function spotifyGet(path: string): Promise<any> {
  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API error (${path}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function trackToRef(track: any): SpotifyTrackRef {
  const artists = (track.artists ?? []).map((a: any) => a.name).join(", ");
  const label = artists ? `${track.name} — ${artists}` : track.name;
  return { searchQuery: `${track.name} ${artists}`.trim(), label };
}

/** Cap how many tracks a single playlist/album import resolves, so queueing
 * one link doesn't spend several minutes making sequential yt-dlp calls. */
const MAX_TRACKS_FROM_COLLECTION = 25;

export async function resolveSpotifyLink(
  input: string
): Promise<SpotifyTrackRef[] | null> {
  if (!spotifyConfigured) {
    throw new Error(
      "This server hasn't been set up with Spotify credentials yet, so I can't read Spotify links directly. Ask whoever runs the bot to add SPOTIFY_CLIENT_ID/SECRET (see SETUP.md) — or just paste the song name instead."
    );
  }

  const parsed = parseSpotifyLink(input);
  if (!parsed) return null;

  if (parsed.kind === "track") {
    const track = await spotifyGet(`/tracks/${parsed.id}`);
    return [trackToRef(track)];
  }

  if (parsed.kind === "playlist") {
    const data = await spotifyGet(
      `/playlists/${parsed.id}/tracks?limit=${MAX_TRACKS_FROM_COLLECTION}&fields=items(track(name,artists(name)))`
    );
    return (data.items ?? [])
      .map((item: any) => item.track)
      .filter(Boolean)
      .map(trackToRef);
  }

  // album
  const data = await spotifyGet(
    `/albums/${parsed.id}/tracks?limit=${MAX_TRACKS_FROM_COLLECTION}`
  );
  return (data.items ?? []).map(trackToRef);
}
