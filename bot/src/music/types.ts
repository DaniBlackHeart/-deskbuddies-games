export interface Track {
  title: string;
  /** The page URL yt-dlp resolved this from (YouTube watch URL, etc). */
  webpageUrl: string;
  durationSec: number | null;
  requestedById: string;
  requestedByName: string;
  /** Set when this track came from a Spotify link, purely for display. */
  spotifySourceLabel?: string;
}
