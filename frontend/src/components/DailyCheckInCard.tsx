import type { CheckInStatus } from "../lib/useDailyCheckIn";

// "Pull Up a Chair" — the sage panel beside Home's greeting. Copy follows the
// Debbie Naming Guide. Streak-only for now: no Buddy XP or deskbits are
// granted until reward values are decided, so none are shown.

// The daily reset is 12:00 am Philippine time (16:00 UTC) for everyone. Show
// it in the member's own time too when that differs.
function resetText(): string {
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

export default function DailyCheckInCard({
  status,
  busy,
  error,
  onClaim,
}: {
  status: CheckInStatus | null;
  busy: boolean;
  error: string | null;
  onClaim: () => void;
}) {
  return (
    <div className="db-checkin">
      <h2 className="t-h2" style={{ margin: 0 }}>
        Pull Up a Chair
      </h2>

      {!status && !error && <p className="t-body-sm text-muted" style={{ margin: 0 }}>Loading…</p>}

      {status && !status.checked_in_today && (
        <>
          <p className="t-body-sm" style={{ margin: 0 }}>
            Say you're here for today. That's all it takes.
          </p>
          <button className="btn btn-primary db-checkin__btn" onClick={onClaim} disabled={busy}>
            {busy ? "Checking in…" : "i'm here!"}
          </button>
        </>
      )}

      {status?.checked_in_today && (
        <>
          <p className="t-body" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            You're here. See you tomorrow.
          </p>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>
            {resetText()}
          </p>
        </>
      )}

      {error && (
        <p className="t-body-sm" role="alert" style={{ margin: 0, color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
