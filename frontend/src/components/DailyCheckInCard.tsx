import { Link } from "react-router-dom";
import { resetText } from "../lib/checkInReset";
import type { CheckInStatus } from "../lib/useDailyCheckIn";

// "Pull Up a Chair" — the sage panel beside Home's greeting. Copy follows the
// Debbie Naming Guide. Streak-only for now: no Buddy XP or deskbits are
// granted until reward values are decided, so none are shown.


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
        <Link to="/pull-up-a-chair" className="db-checkin__title" aria-label="Pull Up a Chair, open your check-in page">
          Pull Up a Chair <span aria-hidden="true">›</span>
        </Link>
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
