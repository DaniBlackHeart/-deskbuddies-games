import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { STICKY_MAX, stickyDate, useMyStickies, type Board, type BoardSticky, type LeaveReason } from "../lib/useDeskStickies";

// Desk Stickies UI (design: Debbie_UI_Decisions_2026-11-24_v1.md, items 7 and 9).
//   <PinBoard>          the visitor's view of a desk's pin board (member profile page)
//   <StickiesSidePanel> the "Leave a Desk Sticky" card beside it, with the popup
//   <MyStickiesCard>    the owner's list on My Desk: Keep in Buddybook or Trash
// Every rule is enforced on the server; this file only shows what the server says.

const REASON_TEXT: Partial<Record<LeaveReason, string>> = {
  not_checked_in: "Check in today to leave a Desk Sticky. Visiting and looking around is always open.",
  full: "This week’s board is full. Try again next week.",
  self: "This is your own desk. Your Desk Stickies list is on My Desk.",
};

function Note({ s, onReport }: { s: BoardSticky; onReport: (id: string) => Promise<string> }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  return (
    <li className="ds-note">
      <p className="ds-note__body">{s.body}</p>
      <p className="ds-note__meta">
        <span>{s.mine ? "You" : s.sender_name} · {stickyDate(s.created_at)}</span>
        {!s.mine && (
          state === "done" ? (
            <span role="status">Thanks. The mods have been told.</span>
          ) : (
            <button
              type="button"
              className="ds-link"
              disabled={state === "sending"}
              onClick={async () => {
                setState("sending");
                try {
                  await onReport(s.id);
                  setState("done");
                } catch {
                  setState("error");
                }
              }}
            >
              {state === "error" ? "Couldn’t report. Try again" : "Report"}
            </button>
          )
        )}
      </p>
    </li>
  );
}

export function PinBoard({ ownerName, board, error, onReport }: { ownerName: string; board: Board | null; error: boolean; onReport: (id: string) => Promise<string> }) {
  return (
    <>
      <h2 id="mp-pin" className="md-h2" style={{ marginTop: 8 }}>{ownerName}’s pin board</h2>
      {error && <p className="text-muted t-body-sm" role="alert" style={{ margin: 0 }}>Couldn’t load the pin board. Check your connection and try again.</p>}
      {!error && !board && <p className="text-muted t-body-sm" role="status" style={{ margin: 0 }}>Loading the pin board…</p>}
      {board && (
        <div className="mp-cork ds-cork">
          {board.stickies.length === 0 ? (
            <span>No stickies yet this week. Be the first to leave one.</span>
          ) : (
            <ul className="ds-notes" aria-labelledby="mp-pin">
              {board.stickies.map((s) => <Note key={s.id} s={s} onReport={onReport} />)}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function LeaveDialog({ ownerName, onClose, onSend }: { ownerName: string; onClose: () => void; onSend: (text: string) => Promise<string> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const left = STICKY_MAX - text.length;

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await onSend(t);
      if (r === "ok") { onClose(); return; }
      setMsg(
        REASON_TEXT[r as LeaveReason] ??
          (r === "off" ? `${ownerName} isn’t taking Desk Stickies right now.` : r === "bad_body" ? `Write between 1 and ${STICKY_MAX} characters.` : "That didn’t go through. Try again."),
      );
    } catch {
      setMsg("That didn’t go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-backdrop" onClick={onClose}>
      <div className="card ds-dialog" role="dialog" aria-modal="true" aria-labelledby="ds-dlg-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="ds-dlg-title" className="md-h2">Leave a Desk Sticky</h2>
        <label className="t-body-sm" htmlFor="ds-text">A short note for {ownerName}’s pin board</label>
        <textarea
          id="ds-text"
          ref={area}
          className="ds-text"
          rows={4}
          maxLength={STICKY_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="ds-count ds-who"
        />
        <p id="ds-count" className="t-body-sm text-muted" style={{ margin: 0 }} aria-live="polite">{left} characters left</p>
        <p id="ds-who" className="t-body-sm text-muted" style={{ margin: 0 }}>
          Other signed-in members can see it on this pin board with your name, and {ownerName} can keep it or trash it. It isn’t public on the internet.
        </p>
        {msg && <p className="t-body-sm" role="alert" style={{ margin: 0 }}>{msg}</p>}
        <div className="ds-actions">
          <button type="button" className="kdl-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="kdl-btn kdl-btn--primary" disabled={busy || text.trim().length === 0} onClick={() => void send()}>
            {busy ? "Sending…" : "Send sticky"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StickiesSidePanel({ ownerName, board, onLeave }: { ownerName: string; board: Board | null; onLeave: (text: string) => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const reason = board?.can_leave;
  return (
    <section className="card" aria-labelledby="mp-stickies">
      <h2 id="mp-stickies" className="md-h2">Desk Stickies</h2>
      <p className="text-muted t-body-sm" style={{ margin: 0 }}>
        Short notes from visitors who have checked in. They refresh each week, and {ownerName} chooses which ones to keep.
      </p>
      {reason === "off" ? (
        <p className="text-muted t-body-sm" style={{ margin: 0 }}>{ownerName} isn’t taking Desk Stickies right now.</p>
      ) : (
        <>
          <button type="button" className="kdl-btn kdl-btn--primary mp-btn" disabled={!board || reason !== "ok"} onClick={() => setOpen(true)}>
            Leave a Desk Sticky
          </button>
          {reason && reason !== "ok" && REASON_TEXT[reason] && (
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>
              {REASON_TEXT[reason]}{" "}
              {reason === "not_checked_in" && <Link to="/">Go to Home</Link>}
            </p>
          )}
        </>
      )}
      {open && <LeaveDialog ownerName={ownerName} onClose={() => setOpen(false)} onSend={onLeave} />}
    </section>
  );
}

function StickyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" style={{ display: "block" }}>
      <rect x="2" y="2" width="12" height="12" fill="#FFF3B0" />
      <path fill="#4A3228" d="M2 1h12v1h-12zM1 2h1v12h-1zM14 2h1v12h-1zM2 14h12v1h-12z" />
      <path fill="#B5573A" d="M7 2h2v2h-2z" />
      <path fill="#4A3228" d="M4 7h8v1h-8zM4 9h6v1h-6zM4 11h4v1h-4z" />
    </svg>
  );
}

export function MyStickiesCard() {
  const { data, error, keep, trash } = useMyStickies();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function run(fn: () => Promise<string>, done: string) {
    setMsg("");
    try {
      const r = await fn();
      setMsg(r === "ok" ? done : "That one is no longer on your board.");
    } catch {
      setMsg("That didn’t go through. Try again.");
    }
    setConfirm(null);
  }

  return (
    <section className="ard-card" aria-labelledby="ard-ds">
      <div className="ard-head">
        <span className="ard-icon" aria-hidden="true"><StickyIcon /></span>
        <div>
          <h3 id="ard-ds" className="t-h3" style={{ margin: 0 }}>Desk Stickies</h3>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>Notes visitors leave on your pin board</p>
        </div>
      </div>
      <div className="ard-box">
        {error && <span className="t-body-sm" role="alert">Couldn’t load your stickies. Check your connection and try again.</span>}
        {!error && !data && <span className="t-body-sm text-muted" role="status">Loading…</span>}
        {data && data.stickies.length === 0 && (
          <span className="t-body-sm">No stickies on your board this week. Only you see this list.</span>
        )}
        {data && data.stickies.length > 0 && (
          <>
            <span className="ard-eyebrow">THIS WEEK · {data.count} OF {data.cap}</span>
            <ul className="ds-list">
              {data.stickies.map((s) => (
                <li key={s.id} className="ds-note">
                  <p className="ds-note__body">{s.body}</p>
                  <p className="ds-note__meta"><span>{s.is_new ? "New · " : ""}{s.sender_name} · {stickyDate(s.created_at)}</span></p>
                  <div className="ds-actions">
                    {confirm === s.id ? (
                      <>
                        <span className="t-body-sm">Trash for good? It can’t be undone.</span>
                        <button type="button" className="kdl-btn" onClick={() => setConfirm(null)}>Keep it on the board</button>
                        <button type="button" className="kdl-btn" onClick={() => void run(() => trash(s.id), "Trashed.")}>Yes, trash</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="kdl-btn kdl-btn--primary" onClick={() => void run(() => keep(s.id), "Kept in your Buddybook.")}>Keep in Buddybook</button>
                        <button type="button" className="kdl-btn" onClick={() => setConfirm(s.id)}>Trash</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <span className="t-body-sm text-muted">Ones you don’t keep leave the board when the week ends.</span>
          </>
        )}
        {msg && <span className="t-body-sm" role="status">{msg}</span>}
      </div>
    </section>
  );
}

