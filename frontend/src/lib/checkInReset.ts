// When the next check-in opens. Shared by the Home card and the Pull Up a Chair page.
// The daily reset is 12:00 am Philippine time (16:00 UTC) for everyone. Show
// it in the member's own time too when that differs.
export function resetText(): string {
  const fallback = "Next check-in opens at 12:00 am Philippine time.";
  try {
    const now = new Date();
    let t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 0);
    if (t <= now.getTime()) t += 864e5;
    const d = new Date(t);
    const fmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
    const local = d.toLocaleTimeString([], fmt);
    const ph = d.toLocaleTimeString([], { ...fmt, timeZone: "Asia/Manila" });
    const dayDiffers =
      d.toLocaleDateString([], { weekday: "short" }) !==
      d.toLocaleDateString([], { weekday: "short", timeZone: "Asia/Manila" });
    if (local === ph && !dayDiffers) return fallback;
    return `Next check-in opens at ${local.toLowerCase()} your time (12:00 am Philippine time).`;
  } catch {
    return fallback;
  }
}
