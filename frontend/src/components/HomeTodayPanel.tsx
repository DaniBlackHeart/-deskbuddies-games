import { useState } from "react";
import { Link } from "react-router-dom";
import { useFocusBlock } from "../lib/useFocusBlock";
import { LENGTHS } from "../lib/focusBlock";

// Today (Debbie Home design): Focus Block and Brain Break in one panel.
//
// Focus Block runs on the real server clock (the same focus-block function Desk
// Time uses). Starting from Home picks "Work" as the activity and no goal; Desk
// Time has the full form (activity, private goal, hold). Brain Break has no
// puzzle behind it yet, so Play is shown but off, and says so.

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function FocusCard() {
  const fb = useFocusBlock();
  const [minutes, setMinutes] = useState<number>(25);

  return (
    <div className="ht-card">
      <h3 className="t-h3" style={{ margin: 0 }}>
        Focus Block
      </h3>
      <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
        Time on your own terms. Works inside or outside Discord voice.
      </p>

      {fb.loading ? (
        <p className="t-body-sm text-muted" style={{ margin: "12px 0 0" }}>
          Checking your desk…
        </p>
      ) : fb.block ? (
        <>
          <div className="ht-clock" role="timer" aria-label={`${fb.block.held ? "On hold, " : ""}${clock(fb.remainingMs)} left`}>
            <span className="ht-clock__time" aria-hidden="true">
              {clock(fb.remainingMs)}
            </span>
            <span className="t-caption text-muted">{fb.block.held ? "On hold" : `${fb.block.minutes} min block`}</span>
          </div>
          <p className="t-caption text-muted" style={{ margin: 0 }}>
            We'll check you're still there between blocks. A missed check only pauses new earning. Nothing you've earned is taken away.
          </p>
          <div className="ht-actions">
            <button type="button" className="btn btn-secondary" disabled={fb.busy} onClick={() => void fb.stop()}>
              End Focus Block
            </button>
            <Link to="/desk-time" className="db-link">
              Open Desk Time
            </Link>
          </div>
        </>
      ) : (
        <>
          {fb.result && (
            <p className="t-body-sm" role="status" style={{ margin: "12px 0 0" }}>
              {fb.result.outcome === "completed" ? "Block finished. Nice work." : "Block ended early. Nothing you've earned is lost."}
              {fb.result.reward && fb.result.reward.deskbits > 0 ? ` +${fb.result.reward.deskbits} deskbits` : ""}{" "}
              <button type="button" className="ht-link" onClick={fb.dismissResult}>
                Dismiss
              </button>
            </p>
          )}
          <div role="group" aria-label="Focus length" className="ht-lengths">
            {LENGTHS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                className={"md-seg" + (minutes === m ? " md-seg--on" : "")}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary ht-start" disabled={fb.busy} onClick={() => void fb.start(minutes, "work", "")}>
            Start Focus Block
          </button>
          <p className="t-caption text-muted" style={{ margin: 0 }}>
            Lengths are provisional. Want to pick what you're doing or set a goal? <Link to="/desk-time">Open Desk Time</Link>.
          </p>
        </>
      )}
      {fb.error && (
        <p className="t-body-sm" role="alert" style={{ margin: "8px 0 0" }}>
          {fb.error}
        </p>
      )}
    </div>
  );
}

function BrainBreakCard() {
  return (
    <div className="ht-card">
      <h3 className="t-h3" style={{ margin: 0 }}>
        Brain Break
      </h3>
      <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
        Today's word puzzle, the same for everyone.
      </p>
      <div className="row-between" style={{ alignItems: "center", marginTop: 12, gap: 12 }}>
        <span className="t-body-sm" style={{ fontWeight: 700 }}>
          Not played yet
        </span>
        <button type="button" className="btn btn-secondary" aria-disabled="true" aria-describedby="bb-note" onClick={(e) => e.preventDefault()}>
          Play
        </button>
      </div>
      <p id="bb-note" className="t-caption text-muted" style={{ margin: "8px 0 0" }}>
        Coming soon. Language, length and scoring are not decided yet. Placeholder.
      </p>
    </div>
  );
}

export default function HomeTodayPanel({ className }: { className?: string }) {
  return (
    <section className={"db-panel" + (className ? " " + className : "")} aria-labelledby="today">
      <h2 id="today" className="t-h2" style={{ margin: 0 }}>
        Today
      </h2>
      <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
        A couple of good ways to spend it. Pick one, or none.
      </p>
      <div className="ht-stack">
        <FocusCard />
        <BrainBreakCard />
      </div>
    </section>
  );
}
