import { useEffect, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useFocusBlock, type BlockResult } from "../lib/useFocusBlock";
import { useMyDesk } from "../lib/useMyDesk";
import { buddyName } from "../lib/deskCatalog";
import { ACTIVITIES, LENGTHS, MAX_GOAL_LENGTH, activityLabel, type ActivityId } from "../lib/focusBlock";

// Desk Time: start a Focus Block and see it through. Follows the "Debbie Desk
// Time" design. The clock lives on the server (focus-block Edge Function): a
// refresh or a closed laptop loses nothing, and only the server decides a block
// is finished. Rewards come from the database rules; the page only shows what
// the server says was paid. Your goal is private: only you can read it.
//
// Not built yet (undecided or needs Discord): Focusing now, the Discord name
// icon, the between-block check-in and earning pause, Desk Breaks, custom
// lengths, Shared Desk and Desk Sounds.

function clockText(ms: number) {
  const total = Math.ceil(ms / 1000);
  const pad = (n: number) => (n < 10 ? "0" : "") + n;
  return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
}

function whenLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function rewardLine(r: BlockResult["reward"]) {
  if (!r || r.status !== "granted") return "";
  const parts: string[] = [];
  if (r.xp > 0) parts.push(`+${r.xp} Buddy XP`);
  if (r.deskbits > 0) parts.push(`+${r.deskbits} deskbits`);
  return parts.join(" · ");
}

export default function DeskTimePage() {
  const fb = useFocusBlock();
  const { saved, loading: deskLoading } = useMyDesk();
  const [mins, setMins] = useState<number>(25);
  const [act, setAct] = useState<ActivityId>("work");
  const [goal, setGoal] = useState("");

  const clockRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const blockId = fb.block?.id;

  // Keep keyboard focus somewhere sensible when the card changes shape.
  useEffect(() => {
    if (blockId) clockRef.current?.focus();
  }, [blockId]);
  useEffect(() => {
    if (fb.result) resultRef.current?.focus();
  }, [fb.result]);

  const names = saved.companions.map(buddyName);
  const scene = `/desk/scene-${saved.companions[0] ?? "none"}.png`;
  const deskLine =
    names.length > 1
      ? `${names.join(" and ")} are keeping your seat.`
      : names.length === 1
        ? `${names[0]} is keeping your seat.`
        : "Your desk is ready whenever you are.";

  const blocksText =
    fb.finishedToday === 0
      ? "No Focus Blocks finished yet today."
      : fb.finishedToday === 1
        ? "1 Focus Block finished today."
        : `${fb.finishedToday} Focus Blocks finished today.`;

  const left = fb.block ? Math.ceil(fb.remainingMs / 60_000) : 0;
  const pct = fb.block ? Math.min(100, Math.round((1 - fb.remainingMs / (fb.block.minutes * 60_000)) * 100)) : 0;

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page dt-page" id="desk-time">
        <div>
          <h1 className="t-h1">Desk Time</h1>
          <p className="text-muted t-subtitle" style={{ margin: 0 }}>
            Quiet company for getting things done. Start a Focus Block whenever you like, in Discord or not.
          </p>
        </div>

        <div className="dt-grid">
          <div className="dt-main">
            <section className="dt-card" aria-labelledby="dt-block-h">
              <h2 className="t-h2" id="dt-block-h" style={{ margin: 0 }}>Focus Block</h2>

              <div role="status" aria-live="polite">
                {fb.error && <div className="dt-notice">{fb.error}</div>}
              </div>

              {fb.loading ? (
                <p className="text-muted t-body" role="status" style={{ margin: 0 }}>Finding your desk…</p>
              ) : fb.block ? (
                <>
                  <div className="dt-clockbox" ref={clockRef} tabIndex={-1}>
                    <span className="t-body" style={{ fontWeight: 700 }}>
                      {activityLabel(fb.block.activity)} · {fb.block.minutes} min
                    </span>
                    <span role="timer" className="dt-clock">{clockText(fb.remainingMs)}</span>
                    <span className="t-body text-muted">
                      {fb.block.held ? "On hold. Time isn't counting." : `${left} min left`}
                    </span>
                    <div aria-hidden="true" className="dt-bar"><div className="dt-bar__fill" style={{ width: pct + "%" }} /></div>
                    {fb.block.goal && <span className="t-body dt-goal">Your goal: {fb.block.goal}</span>}
                  </div>
                  <div className="dt-actions">
                    <button type="button" className="dt-btn" disabled={fb.busy} onClick={fb.block.held ? fb.resume : fb.hold}>
                      {fb.block.held ? "Resume" : "Hold"}
                    </button>
                    <button type="button" className="dt-btn" disabled={fb.busy} onClick={fb.stop}>Finish early</button>
                  </div>
                  <p className="t-caption text-muted" style={{ margin: 0 }}>
                    Finishing early doesn't count as a finished block. Nothing you've already earned changes.
                  </p>
                </>
              ) : fb.result ? (
                <div ref={resultRef} tabIndex={-1} className="dt-result">
                  {fb.result.outcome === "completed" ? (
                    <>
                      <div className="dt-done">
                        <span className="t-body" style={{ fontSize: "1.125rem", fontWeight: 700 }}>Block finished. Nice one.</span>
                        {rewardLine(fb.result.reward) && (
                          <>
                            <span className="t-body" style={{ fontWeight: 700 }}>{rewardLine(fb.result.reward)}</span>
                            <span className="t-body-sm">
                              Your bonus is the same whether or not you were in a Discord voice channel.
                            </span>
                          </>
                        )}
                      </div>
                      <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>{blocksText}</p>
                    </>
                  ) : (
                    <>
                      <p className="t-body" style={{ margin: 0 }}>
                        You stopped early. That's fine. This one doesn't count as a finished block, and nothing you've earned changes.
                      </p>
                      <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>{blocksText}</p>
                    </>
                  )}
                  <div>
                    <button type="button" className="dt-btn dt-btn--primary" onClick={fb.dismissResult}>
                      Another Focus Block
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="t-body text-muted" style={{ margin: 0 }}>
                    Pick how long and what you're doing, then start. You don't need to be in a Discord voice channel.
                  </p>
                  <div className="dt-field">
                    <span id="dt-len-l" className="dt-label">HOW LONG</span>
                    <div role="group" aria-labelledby="dt-len-l" className="dt-chips">
                      {LENGTHS.map((m) => (
                        <button key={m} type="button" aria-pressed={mins === m} className={"dt-chip" + (mins === m ? " dt-chip--on" : "")} onClick={() => setMins(m)}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dt-field">
                    <span id="dt-act-l" className="dt-label">WHAT ARE YOU DOING</span>
                    <div role="group" aria-labelledby="dt-act-l" className="dt-chips">
                      {ACTIVITIES.map((a) => (
                        <button key={a.id} type="button" aria-pressed={act === a.id} className={"dt-chip" + (act === a.id ? " dt-chip--on" : "")} onClick={() => setAct(a.id)}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dt-field">
                    <label htmlFor="dt-goal" className="t-body" style={{ fontWeight: 700 }}>
                      A goal for this block <span className="text-muted" style={{ fontWeight: 600 }}>(optional)</span>
                    </label>
                    <input
                      id="dt-goal"
                      type="text"
                      value={goal}
                      maxLength={MAX_GOAL_LENGTH}
                      placeholder="For example: finish one section"
                      className="dt-input"
                      onChange={(e) => setGoal(e.target.value)}
                    />
                    <span className="t-caption text-muted">Only you can see this. It never goes in a post or a log.</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="dt-btn dt-btn--primary"
                      disabled={fb.busy}
                      onClick={() => {
                        void fb.start(mins, act, goal).then((r) => {
                          if (r?.block) setGoal("");
                        });
                      }}
                    >
                      Start Focus Block
                    </button>
                  </div>
                </>
              )}
            </section>

            <div className="dt-desk">
              <img
                src={scene}
                alt={deskLoading ? "" : names.length ? `Your desk with ${names.join(" and ")}` : "Your desk"}
                width={160}
                height={112}
                className="dt-desk__img"
              />
              <p className="t-body text-muted" style={{ margin: 0 }}>{deskLine}</p>
            </div>
          </div>

          <aside className="dt-side">
            <section className="dt-card dt-card--side" aria-labelledby="dt-hist-h">
              <h2 className="t-h2" id="dt-hist-h" style={{ margin: 0 }}>Your focus history</h2>
              <p className="t-caption text-muted" style={{ margin: 0 }}>Only you can see this.</p>
              {fb.history.length === 0 ? (
                <p className="t-body-sm text-muted" style={{ margin: 0 }}>Your finished Focus Blocks will show up here.</p>
              ) : (
                <ul className="dt-hist">
                  {fb.history.map((h) => (
                    <li key={h.id}>
                      <span className="t-caption text-muted">{whenLabel(h.ended_at)}</span>
                      <span className="t-body-sm" style={{ fontWeight: 700 }}>{activityLabel(h.activity)} · {h.minutes} min</span>
                      {h.goal && <span className="t-body-sm">{h.goal}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
