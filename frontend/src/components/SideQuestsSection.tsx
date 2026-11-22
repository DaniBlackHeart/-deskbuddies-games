import { useEffect, useRef, useState } from "react";
import { useSideQuests, type Quest, type Reward } from "../lib/useSideQuests";
import { prefersReducedMotion } from "../lib/motion";

// Side Quests on Beyond the Desk: the weekly wheel and the archive. Follows the
// "Debbie Beyond the Desk" design and claude/Debbie_Side_Quest_Wheel_Draft_v1.md.
// The server draws the quest; the wheel only animates to the theme it dealt, so
// refreshing or opening a second tab cannot change it. Reduced motion skips the spin.
// Reward amounts appear only when the server says earning is on and the rule is active.
// Not built yet: the optional photo (needs its own storage).

const THEMES = ["Outside", "Move", "Connect", "Community", "Gratitude", "Positivity", "New"] as const;
const THEME_COLOR: Record<string, string> = {
  Outside: "var(--color-bb-collection)",
  Move: "var(--color-bb-contents)",
  Connect: "var(--color-bb-sidequests)",
  Community: "var(--color-bb-firsts)",
  Gratitude: "var(--color-bb-keepsakes)",
  Positivity: "var(--color-wheel-positivity)",
  New: "var(--color-wheel-new)",
};
const STEP = 360 / THEMES.length;
const SPIN_MS = 3200;
const WHO = { solo: "Solo", either: "Solo or with people", people: "With people" } as const;

function slicePath(i: number) {
  const a0 = ((i * STEP - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * STEP - 90) * Math.PI) / 180;
  const r = 92;
  const p = (a: number) => `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
  return `M100 100 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`;
}
const themeIndex = (theme: string) => Math.max(0, THEMES.indexOf(theme as (typeof THEMES)[number]));
/** Rotation that puts the middle of the theme's slice under the pointer at the top. */
const restFor = (theme: string) => -((themeIndex(theme) + 0.5) * STEP);
const reduced = prefersReducedMotion;

function Wheel({ rot, animate }: { rot: number; animate: boolean }) {
  return (
    <svg viewBox="0 0 200 210" className="sq-wheel" aria-hidden="true" focusable="false">
      <g
        className="sq-wheel__disc"
        style={{ transform: `rotate(${rot}deg)`, transformOrigin: "100px 100px", transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.2, 1)` : "none" }}
      >
        {THEMES.map((t, i) => (
          <path key={t} d={slicePath(i)} fill={THEME_COLOR[t]} stroke="var(--spO,#4a3228)" strokeWidth="2" />
        ))}
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--spO,#4a3228)" strokeWidth="3" />
      </g>
      <circle cx="100" cy="100" r="14" fill="#fffdf8" stroke="var(--spO,#4a3228)" strokeWidth="3" />
      <path d="M92 2 L108 2 L100 18 Z" fill="var(--color-primary)" stroke="var(--spO,#4a3228)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function rewardText(r: Reward) {
  if (!r) return "";
  const parts = [];
  if (r.xp) parts.push(`${r.xp} Buddy XP`);
  if (r.deskbits) parts.push(`${r.deskbits} deskbits`);
  return parts.join(" + ");
}

function QuestCard({ q, reward, bare, children }: { q: Quest; reward: Reward; bare?: boolean; children?: React.ReactNode }) {
  return (
    <div className={"sq-quest" + (bare ? " sq-quest--bare" : "")}>
      <div className="sq-quest__top">
        <b className="sq-quest__name">{q.name}</b>
        <span className="bd-pill">{q.theme}</span>
        <span className="bd-pill">{WHO[q.social]}</span>
      </div>
      <p className="sq-quest__what">{q.what}</p>
      <p className="sq-quest__easier"><b>Easier / rainy-day version:</b> {q.easier}</p>
      <p className="t-body-sm text-muted" style={{ margin: 0 }}>
        {reward ? `Doing it this week earns ${rewardText(reward)} and a stamp.` : "Doing it earns a stamp for your Buddybook."}
      </p>
      {children}
    </div>
  );
}

export default function SideQuestsSection() {
  const { data, loading, error, busy, notice, act, reload } = useSideQuests();
  const [rot, setRot] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const placed = useRef(false);
  const timer = useRef<number | null>(null);

  // On first load, rest the wheel on this week's theme without animating.
  useEffect(() => {
    if (!data || placed.current) return;
    placed.current = true;
    if (data.quest) setRot(restFor(data.quest.theme));
  }, [data]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function spinTo(theme: string) {
    const rest = restFor(theme);
    if (reduced()) {
      setAnimate(false);
      setRot(rest);
      return;
    }
    setAnimate(true);
    setSpinning(true);
    setRot((cur) => cur + 1080 + ((((rest - cur) % 360) + 360) % 360));
    timer.current = window.setTimeout(() => setSpinning(false), SPIN_MS + 100);
  }

  async function spin(kind: "spin" | "respin") {
    const d = await act(kind);
    if (d?.quest) spinTo(d.quest.theme);
  }

  return (
    <section aria-labelledby="sq-h" className="bd-stack bd-col">
      <div>
        <h2 className="t-h2" id="sq-h" style={{ margin: 0 }}>Side Quests</h2>
        <p className="text-muted t-body" style={{ margin: 0 }}>One new experience each week.</p>
      </div>

      {loading && !data ? (
        <p className="text-muted t-body" role="status">Loading your side quest…</p>
      ) : error && !data ? (
        <div className="bd-card" role="alert">
          <p className="t-body" style={{ margin: 0 }}>{error}</p>
          <button type="button" className="bd-btn bd-btn--primary" onClick={reload}>Try again</button>
        </div>
      ) : data ? (
        <>
          <div className="bd-card sq-wheelcard">
            <div role="status" aria-live="polite" className="sq-wheelcard__notice">{notice && <div className="bd-notice">{notice}</div>}</div>
            <Wheel rot={rot} animate={animate} />
            <div className="sq-wheelcard__text">
              {data.quest && !spinning ? (
                <QuestCard q={data.quest} reward={data.done_reward} bare>
                  {data.stage === "result" && (
                    <div className="sq-actions">
                      <button type="button" className="bd-btn bd-btn--primary" aria-disabled={busy} onClick={() => act("lock")}>I'll do this one</button>
                      {data.can_respin && (
                        <button type="button" className="bd-btn" aria-disabled={busy} onClick={() => spin("respin")}>Spin again (free, once)</button>
                      )}
                    </div>
                  )}
                  {data.stage === "locked" && (
                    <div className="sq-actions">
                      <button type="button" className="bd-btn bd-btn--primary" aria-disabled={busy} onClick={() => act("done", { quest_key: data.quest!.key })}>
                        Mark done
                        <span className="sr-only">: {data.quest.name}</span>
                      </button>
                      <span className="t-body-sm text-muted">This is your quest for the week.</span>
                    </div>
                  )}
                  {data.stage === "done" && (
                    <div className="sq-actions">
                      <span className="bd-btn bd-btn--done" role="img" aria-label="Done">✓ Done</span>
                      <span className="t-body-sm text-muted">Your stamp is in your Buddybook.</span>
                    </div>
                  )}
                </QuestCard>
              ) : (
                <>
                  {data.stage === "none_left" ? (
                    <p className="t-body" style={{ margin: 0 }}>You've done them all. New quests are coming.</p>
                  ) : (
                    <p className="t-body" style={{ margin: 0 }}>
                      The wheel picks one quest for you. {data.spin_reward ? `Spinning once a week earns ${rewardText(data.spin_reward)}, and a re-spin is free once.` : "Spin once a week, and a re-spin is free once."}
                    </p>
                  )}
                  {data.stage === "unspun" && (
                    <button type="button" className="bd-btn bd-btn--primary" aria-disabled={busy} onClick={() => spin("spin")}>
                      Spin your side quest for the week
                    </button>
                  )}
                  {spinning && <p className="t-body-sm text-muted" role="status" style={{ margin: 0 }}>Spinning…</p>}
                </>
              )}
            </div>
          </div>

          <div className="bd-card" aria-labelledby="sq-archive-h">
            <div className="row-between">
              <h3 className="sq-archive__h" id="sq-archive-h">Your archive</h3>
              <span className="t-body-sm text-muted">Stamps collected <b className="sq-num">{data.stamps}</b></span>
            </div>
            <p className="t-body-sm text-muted" style={{ margin: 0 }}>
              Quests the wheel dealt you that you did not finish. Do them any time for a stamp. They pay no XP and no deskbits.
            </p>
            {data.archive.length === 0 ? (
              <p className="t-body-sm text-muted" style={{ margin: 0 }}>
                Nothing waiting here. A quest you don't finish in its week will wait here for you.
              </p>
            ) : (
              <ul className="bd-list">
                {data.archive.map((q) => (
                  <li key={q.key}>
                    <details className="sq-arch">
                      <summary>
                        <span className="sq-arch__name">{q.name}</span>
                        <span className="sq-arch__theme">{q.theme}</span>
                      </summary>
                      <QuestCard q={q} reward={null}>
                        <div className="sq-actions">
                          <button type="button" className="bd-btn" aria-disabled={busy} onClick={() => act("done", { quest_key: q.key })}>
                            Mark done
                            <span className="sr-only">: {q.name}</span>
                          </button>
                        </div>
                      </QuestCard>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
