import { useEffect, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import PixelIcon, { type PixelIconName } from "../components/PixelIcon";
import { useBeyondTheDesk, type Goal, type KeepCard, type Reward } from "../lib/useBeyondTheDesk";

// Beyond the Desk: small things to try away from the screen. Follows the
// "Debbie Beyond the Desk" design and the locked UI spec. Everything on the page
// comes from the beyond-the-desk Edge Function: the server picks today's three
// detours, counts goal and Keepsake progress from stored rows, and pays what has
// a rule. Reward amounts show only when the server says earning is on and the
// rule is active. Your progress here is private to you.
//
// Not built yet: the 52 Side Quests wheel, goals that need the puzzle, live
// games, sharing or events, and the Brain & Play and Collection Keepsake
// categories. They appear when their features ship; nothing is shown for them.

const SLOT_LABEL = { move: "Move & rest", make: "Make & learn", play: "Play & connect" } as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GOAL_ICONS: Record<string, PixelIconName> = {
  ww_show_up: "goal-show-up",
  ww_settle_in: "goal-settle-in",
  ww_little_detours: "goal-little-detours",
};
const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold" } as const;

// A date string from the server (YYYY-MM-DD) is shown as written, with no timezone maths.
function parts(ymd: string) {
  const d = new Date(ymd + "T00:00:00Z");
  return { dow: DAYS[d.getUTCDay()], day: d.getUTCDate(), mon: MONTHS[d.getUTCMonth()] };
}
const dayLabel = (ymd: string) => {
  const p = parts(ymd);
  return `${p.dow} ${p.day} ${p.mon}`;
};
const rangeLabel = (a: string, b: string) => {
  const x = parts(a);
  const y = parts(b);
  return `${x.dow} ${x.day} ${x.mon} to ${y.dow} ${y.day} ${y.mon}`;
};

function RewardLine({ reward }: { reward: Reward }) {
  if (!reward) return null;
  return (
    <span className="bd-reward">
      {reward.xp > 0 && (
        <span className="bd-reward__item">
          <PixelIcon name="buddy-xp" size={16} /> +{reward.xp} Buddy XP
        </span>
      )}
      {reward.deskbits > 0 && (
        <span className="bd-reward__item">
          <PixelIcon name="deskbits" size={16} /> +{reward.deskbits} {reward.deskbits === 1 ? "deskbit" : "deskbits"}
        </span>
      )}
    </span>
  );
}

function Segments({ value, total, max = 10 }: { value: number; total: number; max?: number }) {
  const n = Math.min(Math.max(total, 1), max);
  const filled = total <= max ? Math.min(value, total) : Math.floor((Math.min(value, total) / total) * n);
  return (
    <div className="bd-segs" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={"bd-seg" + (i < filled ? " bd-seg--on" : "")} />
      ))}
    </div>
  );
}

function GoalCard({ g, reward, past }: { g: Goal; reward: Reward; past?: boolean }) {
  const unit = g.target === 1 ? g.unit.replace(/s$/, "") : g.unit;
  return (
    <li className={"bd-goal" + (g.done ? " bd-goal--done" : "")}>
      <div className="bd-goal__head">
        {GOAL_ICONS[g.key] && (
          <span aria-hidden="true" className="bd-goal__icon">
            <PixelIcon name={GOAL_ICONS[g.key]} size={32} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h4 className="bd-goal__name">{g.name}</h4>
          <p className="t-body text-muted" style={{ margin: 0 }}>{g.text}</p>
        </div>
      </div>
      <Segments value={g.progress} total={g.target} max={g.target} />
      <div className="bd-goal__foot">
        <span className="bd-count">{g.progress} of {g.target} {unit}</span>
        {g.done ? <span className="bd-done">✓ Done</span> : !past && <RewardLine reward={reward} />}
      </div>
    </li>
  );
}

function Medallion({ tier, threshold, state }: { tier: string; threshold: number; state: "earned" | "next" | "later" }) {
  return (
    <div className={"bd-med bd-med--" + state}>
      <span className={"bd-med__disc bd-med__disc--" + tier} aria-hidden="true">{state === "earned" ? "✓" : ""}</span>
      <span className="bd-count">{threshold}</span>
      <span className="bd-med__tier">
        {TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}
        <span className="sr-only">{state === "earned" ? ", earned" : state === "next" ? ", next step" : ", later step"}</span>
      </span>
    </div>
  );
}

function Keepsake({ card, onOpen }: { card: KeepCard; onOpen: (c: KeepCard, trigger: HTMLElement) => void }) {
  const nextIndex = card.steps.findIndex((s) => !s.earned);
  return (
    <li className="bd-keep">
      <h4 className="bd-keep__name">{card.name}</h4>
      <p className="text-muted t-body-sm" style={{ margin: 0 }}>{card.counts}</p>
      <Segments value={card.value} total={card.target} />
      <p className="bd-count" style={{ margin: 0 }}>
        {card.all_earned ? `${card.value} (all steps earned)` : `${card.value} of ${card.target}`}
      </p>
      <div className="bd-meds">
        {card.steps.map((s, i) => (
          <Medallion key={s.tier} tier={s.tier} threshold={s.threshold} state={s.earned ? "earned" : i === nextIndex ? "next" : "later"} />
        ))}
      </div>
      <button type="button" className="bd-btn" onClick={(e) => onOpen(card, e.currentTarget)}>
        See steps<span className="sr-only"> for {card.name}</span>
      </button>
    </li>
  );
}

function StepsDialog({ card, onClose }: { card: KeepCard; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Modal behaviour: focus moves in, Tab stays inside, Escape closes, the page
  // behind stops scrolling. Focus returns to the button that opened it.
  useEffect(() => {
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nextIndex = card.steps.findIndex((s) => !s.earned);
  return (
    <div className="cr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="bd-steps-h" className="cr-dialog">
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)" }}>
          <div>
            <h2 className="t-h2" id="bd-steps-h" style={{ margin: 0 }}>{card.name}</h2>
            <p className="t-body text-muted" style={{ margin: "4px 0 0" }}>{card.counts}. You have {card.value}.</p>
          </div>
          <button type="button" className="bd-btn bd-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <ul className="bd-steplist">
          {card.steps.map((s, i) => (
            <li key={s.tier} className="bd-step">
              <Medallion tier={s.tier} threshold={s.threshold} state={s.earned ? "earned" : i === nextIndex ? "next" : "later"} />
              <div style={{ minWidth: 0 }}>
                <b>{TIER_LABEL[s.tier]} · {s.threshold}</b>
                <p className="t-body text-muted" style={{ margin: 0 }}>
                  {s.earned ? "Earned. Steps are permanent." : i === nextIndex ? "Your next step." : "A later step."}
                </p>
                {s.reward && <RewardLine reward={s.reward} />}
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="bd-btn bd-btn--primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function BeyondTheDeskPage() {
  const { data, loading, error, notice, busyKey, markDone, reload } = useBeyondTheDesk();
  const [open, setOpen] = useState<KeepCard | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  function openSteps(c: KeepCard, el: HTMLElement) {
    trigger.current = el;
    setOpen(c);
  }
  function closeSteps() {
    setOpen(null);
    trigger.current?.focus();
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page bd-page" id="beyond-the-desk">
        <div className="bd-title">
          <PixelIcon name="beyond-the-desk" size={48} />
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Beyond the Desk</h1>
            <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>
              Small things to try and goals to chip away at. Nothing here takes anything away.
            </p>
          </div>
        </div>

        <div role="status" aria-live="polite">{notice && <div className="bd-notice">{notice}</div>}</div>

        {loading && !data ? (
          <p className="text-muted t-body" role="status">Opening your page…</p>
        ) : error && !data ? (
          <div className="bd-card" role="alert">
            <p className="t-body" style={{ margin: 0 }}>{error}</p>
            <div><button type="button" className="bd-btn bd-btn--primary" onClick={reload}>Try again</button></div>
          </div>
        ) : data ? (
          <>
            <section aria-labelledby="bd-week-h" className="bd-stack">
              <div className="bd-headline">
                <h2 className="t-h2" id="bd-week-h" style={{ margin: 0 }}>Your week</h2>
                <span className="t-body text-muted">{rangeLabel(data.week.start, data.week.end)}, Manila time. A new week starts Monday.</span>
              </div>
              <ol className="bd-week">
                {data.week.days.map((d) => {
                  const p = parts(d.date);
                  const today = d.date === data.today;
                  const future = d.date > data.today;
                  const label = `${p.dow} ${p.day} ${p.mon}${today ? ", today" : ""}: ${d.checked_in ? "checked in" : future ? "not here yet" : "no check-in"}, ${d.detours_done} of 3 detours`;
                  return (
                    <li key={d.date} className={"bd-day" + (today ? " bd-day--today" : "") + (future ? " bd-day--future" : "")} aria-label={label}>
                      <span aria-hidden="true" className="bd-day__dow">{today ? "Today" : p.dow}</span>
                      <span aria-hidden="true" className="bd-day__num">{p.day}</span>
                      <span
                        aria-hidden="true"
                        className="bd-ring"
                        style={{ background: `conic-gradient(var(--color-primary) ${(Math.min(d.detours_done, 3) / 3) * 360}deg, var(--color-border) 0)` }}
                      >
                        <span className="bd-ring__in">{d.checked_in ? "✓" : ""}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="t-body-sm text-muted" style={{ margin: 0 }}>
                The ring fills as you do Daily Detours, up to three a day. A tick in the middle means you checked in. Nothing here counts against you.
              </p>
            </section>

            <div className="bd-cols">
              <section aria-labelledby="bd-detours-h" className="bd-stack bd-col">
                <div className="bd-sechead">
                  <PixelIcon name="section-detours" size={48} />
                  <div>
                    <h2 className="t-h2" id="bd-detours-h" style={{ margin: 0 }}>Daily Detours</h2>
                    <p className="text-muted t-body" style={{ margin: 0 }}>Small things to try today.</p>
                  </div>
                </div>
                <p className="t-body" style={{ margin: 0 }}>
                  <b>{data.detours.done_count} of {data.detours.items.length} done today.</b>{" "}
                  <span className="text-muted">{dayLabel(data.today)}. Optional, no timer, nothing to prove.</span>
                </p>
                {data.detours.items.length === 0 ? (
                  <p className="text-muted t-body" style={{ margin: 0 }}>No detours today. Check back tomorrow.</p>
                ) : (
                  <ul className="bd-list">
                    {data.detours.items.map((it) => {
                      const saving = busyKey === it.key;
                      return (
                        <li key={it.key} className="bd-detour">
                          <div className="bd-detour__text">
                            <span className="bd-pill">{SLOT_LABEL[it.slot]}</span>
                            <p className="t-body" style={{ margin: "6px 0 0", fontWeight: 500 }}>{it.text}</p>
                            {!it.done && <RewardLine reward={data.detours.reward} />}
                          </div>
                          {it.done ? (
                            <span className="bd-btn bd-btn--done" role="img" aria-label="Done">✓ Done</span>
                          ) : (
                            <button
                              type="button"
                              className="bd-btn bd-btn--primary"
                              aria-disabled={saving || busyKey !== null}
                              onClick={() => markDone(it.key)}
                            >
                              {saving ? "Saving…" : "Mark done"}
                              <span className="sr-only">: {it.text}</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="t-body-sm text-muted" style={{ margin: 0 }}>
                  Resets at midnight, Manila time. Unfinished detours do not carry over.
                </p>
              </section>

              {data.weekly.visible && (
                <section aria-labelledby="bd-weekly-h" className="bd-stack bd-col">
                  <div className="bd-sechead">
                    <PixelIcon name="section-weekly" size={48} />
                    <div>
                      <h2 className="t-h2" id="bd-weekly-h" style={{ margin: 0 }}>Weekly Wins</h2>
                      <p className="text-muted t-body" style={{ margin: 0 }}>A little progress throughout your week.</p>
                    </div>
                  </div>
                  <div className="bd-headline">
                    <b>{rangeLabel(data.week.start, data.week.end)}</b>
                    <span className="bd-pill">Resets Monday</span>
                  </div>
                  <div className="bd-meter">
                    <span
                      role="img"
                      aria-label={`${data.weekly.done_count} of ${data.weekly.goals.length} goals done`}
                      className="bd-pips"
                    >
                      {data.weekly.goals.map((g) => (
                        <span key={g.key} className={"bd-pip" + (g.done ? " bd-pip--on" : "")} />
                      ))}
                    </span>
                    <span className="t-body">
                      {data.weekly.done_count} of {data.weekly.goals.length} done. {data.weekly.full_week_goals} of {data.weekly.goals.length} makes a full week.
                    </span>
                  </div>
                  <p className="t-body-sm text-muted" style={{ margin: 0 }}>Any order, any days. Everyone sees the same goals this week.</p>
                  <ul className="bd-list">
                    {data.weekly.goals.map((g) => (
                      <GoalCard key={g.key} g={g} reward={data.weekly.reward} />
                    ))}
                  </ul>
                  <p className="t-body-sm text-muted" style={{ margin: 0 }}>
                    {data.weekly.reward
                      ? "Each goal pays once a week. Next week's goals are not shown ahead of time."
                      : "Each goal counts once a week. Next week's goals are not shown ahead of time."}
                  </p>
                  {data.weekly.last_week && (
                    <details className="bd-last">
                      <summary>Last week's goals</summary>
                      <p className="t-body-sm text-muted" style={{ margin: "8px 0" }}>
                        {rangeLabel(data.weekly.last_week.start, data.weekly.last_week.end)}. Read only. No bonus now.
                      </p>
                      <ul className="bd-list">
                        {data.weekly.last_week.goals.map((g) => (
                          <GoalCard key={g.key} g={g} reward={null} past />
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              )}
            </div>

            {data.keepsakes.length > 0 && (
              <section aria-labelledby="bd-keep-h" className="bd-stack">
                <div className="bd-sechead">
                  <PixelIcon name="section-keepsakes" size={48} />
                  <div>
                    <h2 className="t-h2" id="bd-keep-h" style={{ margin: 0 }}>Keepsakes</h2>
                    <p className="text-muted t-body" style={{ margin: 0 }}>Marks that stay with you.</p>
                  </div>
                </div>
                {data.keepsakes.map((cat) => (
                  <div key={cat.category} className="bd-stack">
                    <h3 className="bd-cat">{cat.category}</h3>
                    <ul className="bd-keeps">
                      {cat.cards.map((c) => (
                        <Keepsake key={c.key} card={c} onOpen={openSteps} />
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="t-body-sm text-muted" style={{ margin: 0 }}>
                  Steps are permanent and never taken away. Your progress here is private to you.
                </p>
              </section>
            )}
          </>
        ) : null}
      </main>
      {open && <StepsDialog card={open} onClose={closeSteps} />}
    </div>
  );
}
