// Shared by the Buddy Calendar page and the Common Room's calendar card.
// Times are stored in UTC and shown in Asia/Manila ("Philippine time").

export const TZ = "Asia/Manila";

/** "8:00 – 9:30 PM", or "11:30 AM – 1:00 PM" when the period changes. */
export function timeRange(a: string, b: string | null, zone = TZ): string {
  const t = (ts: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).formatToParts(new Date(ts));
    const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
    return { hm: `${g("hour")}:${g("minute")}`, ap: g("dayPeriod") };
  };
  const x = t(a);
  if (!b) return `${x.hm} ${x.ap}`;
  const y = t(b);
  return x.ap === y.ap ? `${x.hm} – ${y.hm} ${y.ap}` : `${x.hm} ${x.ap} – ${y.hm} ${y.ap}`;
}
