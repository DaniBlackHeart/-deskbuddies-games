export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "live/unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
