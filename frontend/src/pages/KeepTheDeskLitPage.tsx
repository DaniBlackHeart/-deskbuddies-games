import AppHeader from "../components/AppHeader";
import { useState } from "react";
import KdlArt from "../components/KdlArt";
import { useSupport, type SupportCost, type SupportState } from "../lib/useSupport";

// Keep the Desk Lit: where support goes, and what it does and does not change. Follows the
// "Debbie Keep the Desk Lit" design and claude/Debbie_Keep_the_Desk_Lit_and_Thank-You_Board_Draft_v0.md
// (rules R1 to R5 are chosen by Dani and still pending Rika).
//
// Real-money support is kept apart from the economy: nothing here reads or changes Buddy XP,
// deskbits or access, and the word "deskbits" never sits next to an amount or a buy button.
//
// Not decided, so not built: prices, suggested amounts, payment provider, QR code, receipt
// reference and "I sent my support", who checks a payment, supporter cosmetics, and The
// Thank-You Board. The "Ways to support" card shows only text and a link the team sets.
// Every figure comes from the database, and nothing is shown that has not been set.

const STATUS_COPY: Record<SupportState, { title: string; line: string }> = {
  empty: {
    title: "Nothing here yet, and that is okay.",
    line: "No support has come in so far. Debbie is open to everyone either way, and nothing on this page is needed to take part.",
  },
  early: {
    title: "A good start.",
    line: "Support has begun to come in. Some of the running costs are covered, and the rest are not yet.",
  },
  funded: {
    title: "Everything here is covered. Thank you.",
    line: "Running costs, maintenance and development, and events are all covered for now.",
  },
  shortfall: {
    title: "Running costs are not fully covered yet.",
    line: "Debbie is open to everyone, as always. If you would like to help with what is left, the ways are below. If not, that is completely fine.",
  },
};

const WORD = { not_yet: "Not yet covered", partly: "Partly covered", covered: "Covered" } as const;

// What the page says it keeps running follows what has shipped.
const KEEPS: { art: string; name: string; text: string }[] = [
  { art: "games", name: "The games", text: "Trivia Night, UNO, Family Feud and the other game nights." },
  { art: "desktime", name: "Desk Time", text: "Focus Blocks, Shared Desk and the daily puzzle." },
  { art: "mydesk", name: "My Desk and buddies", text: "Your desk, your buddies and your Buddybook." },
  { art: "common", name: "The Common Room", text: "Posts, Pull Up a Chair and Daily Detours." },
  { art: "discord", name: "Discord connection", text: "Sign-in, roles, and posts shared with the server." },
];

// Breakdown from the 24 Nov funding decision. Sample figures until the goals are final.
const PARTS: Record<string, { label: string; goal: number; note?: string }[]> = {
  running: [
    { label: "Hosting and database", goal: 2790 },
    { label: "Domain", goal: 80 },
    { label: "Building tool", goal: 1240 },
    { label: "Room for price changes", goal: 390 },
  ],
  maintenance: [{ label: "Our time", goal: 3000, note: "Part-time work, a few hours a month, shared between two people." }],
};
const partsFor = (label: string) => (/running/i.test(label) ? PARTS.running : /maintenance/i.test(label) ? PARTS.maintenance : null);

const GOOD: { art: string; title: string; body: React.ReactNode }[] = [
  {
    art: "money",
    title: "Where the money goes",
    body: (
      <>
        <p><b>Running costs.</b> Hosting, the database and backups, the Discord bot and the tools Debbie uses.</p>
        <p><b>Maintenance and development.</b> Fixing things, building features, and pay for the people who look after Debbie and the community.</p>
        <p><b>Community Events/Initiatives.</b> Game nights and community activities.</p>
      </>
    ),
  },
  {
    art: "shield",
    title: "What support never changes",
    body: (
      <>
        <ul className="kdl-list kdl-list--sm">
          <li>Buddy XP and Buddy Level.</li>
          <li>deskbits: earned by taking part, never bought.</li>
          <li>What you can access on Discord and on site.</li>
          <li>Games, scores and rank.</li>
          <li>Buddies you earn from milestones.</li>
        </ul>
        <p>Not giving changes nothing about you here. Belonging is not measured in money.</p>
      </>
    ),
  },
  {
    art: "house",
    title: "What stays, whatever happens",
    body: (
      <>
        <p><b>The DeskBuddies Discord community stays.</b> A smaller, Discord-only way to carry on is being planned. It is not built or promised yet.</p>
      </>
    ),
  },
  {
    art: "hash",
    title: "Boosting the Discord server",
    body: (
      <>
        <p><b>Boosting a Discord server is something you do with your own Discord account</b>, like the perks that come with Nitro. It is not the same as supporting Debbie here.</p>
        <p>If you already boost the server on Discord, that stays in Discord and is thanked there. Supporting here is a separate, one-time way to help with Debbie’s running costs.</p>
        <p>The Supporter role gives the same perks as a Discord booster, for 30 days.</p>
      </>
    ),
  },
];


const peso = (n: number) => "₱ " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function fillPct(c: SupportCost) {
  if (c.status === "covered") return 100;
  if (c.status === "not_yet") return 0;
  if (c.covered_pct !== null) return c.covered_pct;
  if (c.covered_amount !== null && c.total_amount) return Math.min(99, Math.round((c.covered_amount / c.total_amount) * 100));
  return 50; // "partly" with no figure: a half-filled bar, not a measurement
}

function CostCard({ c, showAmounts, open }: { c: SupportCost; showAmounts: boolean; open: boolean }) {
  const word = c.status ? WORD[c.status] : null;
  const pct = fillPct(c);
  const hasFigures = showAmounts && c.total_amount !== null && c.total_amount > 0;
  const covered = c.covered_amount ?? 0;
  const amountLine = word ? (hasFigures ? `${word} · ${peso(covered)} of ${peso(c.total_amount as number)}` : word) : null;
  const parts = open && hasFigures ? partsFor(c.label) : null;
  let left = covered;
  return (
    <div className="kdl-cost">
      <span className="kdl-cost__name">{c.label}</span>
      {hasFigures && <span className="kdl-muted kdl-small">Goal: {peso(c.total_amount as number)} a month</span>}
      {word ? (
        <>
          <div className="kdl-bar" role="img" aria-label={`${c.label}: ${amountLine?.toLowerCase()}`}>
            <div className="kdl-bar__fill" style={{ width: pct + "%", borderRight: pct > 0 && pct < 100 ? "2px solid var(--color-text)" : 0 }} />
          </div>
          <span className="kdl-cost__amount">{amountLine}</span>
        </>
      ) : (
        <span className="kdl-muted kdl-small">{c.pays_for}</span>
      )}
      {parts && (
        <div className="kdl-parts">
          {parts.map((p) => {
            const got = Math.max(0, Math.min(p.goal, left));
            left -= got;
            const pp = Math.round((got / p.goal) * 100);
            return (
              <div key={p.label} className="kdl-part">
                <div className="kdl-part__row"><span>{p.label}</span><span>{peso(p.goal)}</span></div>
                <div className="kdl-bar kdl-bar--sm" role="img" aria-label={`${p.label}: ${pp}% covered`}>
                  <div className="kdl-bar__fill" style={{ width: pp + "%" }} />
                </div>
                {p.note && <span className="kdl-muted kdl-small">{p.note}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KeepTheDeskLitPage() {
  const { data, loading, error, reload } = useSupport();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [openGood, setOpenGood] = useState<number[]>([]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page kdl-page" id="keep-the-desk-lit">
        <section className="kdl-card kdl-banner">
          <KdlArt name="title" size={64} />
          <div className="kdl-head">
            <div className="kdl-eyebrow">ALWAYS OPTIONAL</div>
            <h1 className="t-h1" style={{ margin: 0 }}>Keep the Desk Lit</h1>
            <p className="text-muted t-subtitle" style={{ margin: 0, maxWidth: 620 }}>Help cover what it costs to run Debbie.</p>
          </div>
        </section>

        {loading && !data ? (
          <p className="text-muted t-body" role="status">Opening the page…</p>
        ) : error && !data ? (
          <div className="kdl-card" role="alert">
            <p className="t-body" style={{ margin: 0 }}>{error}</p>
            <div><button type="button" className="kdl-btn kdl-btn--primary" onClick={reload}>Try again</button></div>
          </div>
        ) : data ? (
          <>
            <section className="kdl-card" aria-labelledby="kdl-stand">
              <div className="kdl-between">
                <h2 className="kdl-h2" id="kdl-stand">Where things stand</h2>
              </div>
              {data.status_state ? (
                <div>
                  <p role="status" className="kdl-status">{STATUS_COPY[data.status_state].title}</p>
                  <p className="kdl-muted kdl-small" style={{ margin: 0 }}>{STATUS_COPY[data.status_state].line}</p>
                </div>
              ) : (
                <p className="kdl-muted" style={{ margin: 0 }}>
                  The team hasn’t shared the cost details yet. Here is what the costs are for.
                </p>
              )}
              <div className="kdl-costs">
                {data.costs.map((c) => <CostCard key={c.key} c={c} showAmounts={data.show_amounts} open={showBreakdown} />)}
              </div>
              <div className="kdl-between kdl-between--foot">
                <p className="kdl-muted kdl-small" style={{ margin: 0 }}>Support goes to running costs first, then maintenance, then events.</p>
                {data.show_amounts && (
                  <button type="button" className="kdl-link" aria-expanded={showBreakdown} onClick={() => setShowBreakdown((v) => !v)}>
                    <span>{showBreakdown ? "Hide breakdown" : "See breakdown"}</span>
                    <KdlArt name="chev" size={24} style={{ color: "var(--color-text)", transform: showBreakdown ? "rotate(180deg)" : undefined }} />
                  </button>
                )}
              </div>
            </section>

            <div className="kdl-row">
              <section className="kdl-card" aria-labelledby="kdl-ways">
                <div>
                  <h2 className="kdl-h2" id="kdl-ways">Support Debbie</h2>
                  <p className="kdl-muted" style={{ margin: "6px 0 0" }}>Always optional.</p>
                </div>
                {data.how_to_give || data.give_url ? (
                  <>
                    {data.how_to_give && <p className="kdl-text">{data.how_to_give}</p>}
                    {data.give_url && (
                      <div>
                        <a className="kdl-btn kdl-btn--primary" href={data.give_url} target="_blank" rel="noopener noreferrer">Open the support page</a>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="kdl-text">Support isn’t open yet. Nothing is needed from you, and everything in Debbie works the same.</p>
                )}
                <p className="kdl-muted kdl-small" style={{ margin: 0 }}>
                  <b>Debbie never asks for card, bank or e-wallet details.</b>
                </p>
              </section>

              <div className="kdl-col">
                <section className="kdl-card" aria-labelledby="kdl-thanks">
                  <div className="kdl-stack">
                    <h2 className="kdl-h2" id="kdl-thanks">Your thank-you</h2>
                    <span className="kdl-tag">Placeholder art</span>
                  </div>
                  <div className="kdl-role">
                    <KdlArt name="role1" size={48} />
                    <KdlArt name="role2" size={48} />
                    <div className="kdl-role__text">
                      <span className="kdl-role__title">Supporter role</span>
                      <span className="kdl-muted kdl-small">Lasts 30 days</span>
                    </div>
                  </div>
                  <ul className="kdl-list">
                    <li>Same perks as Discord boosters.</li>
                    <li>Added once we have checked your support.</li>
                    <li>Your name on The Thank-You Board, only if you choose.</li>
                  </ul>
                </section>
                <section className="kdl-card" aria-labelledby="kdl-board">
                  <div className="kdl-boardhead">
                    <KdlArt name="board" size={48} />
                    <div className="kdl-stack" style={{ flex: "1 1 220px" }}>
                      <h2 className="kdl-h2 kdl-h2--sm" id="kdl-board">The Thank-You Board</h2>
                      <span className="kdl-muted">Members who chose to be named. No amounts.</span>
                    </div>
                  </div>
                  <span className="kdl-btn kdl-btn--off" aria-disabled="true">Visit the board · Coming soon</span>
                </section>
              </div>
            </div>

            <div className="kdl-row">
              <section className="kdl-card" aria-labelledby="kdl-keeps">
                <h2 className="kdl-h2" id="kdl-keeps">What this keeps running</h2>
                <div className="kdl-keeps">
                  {KEEPS.map((k) => (
                    <div key={k.name} className="kdl-keep">
                      <KdlArt name={k.art} size={32} />
                      <div className="kdl-keep__text">
                        <span className="kdl-keep__name">{k.name}</span>
                        <span className="kdl-muted kdl-small">{k.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="kdl-card kdl-card--tight" aria-labelledby="kdl-know">
                <h2 className="kdl-h2" id="kdl-know">Good to know</h2>
                <div className="kdl-acc">
                  {GOOD.map((g, i) => {
                    const open = openGood.includes(i);
                    return (
                      <div key={g.title} className="kdl-acc__item">
                        <button type="button" className="kdl-acc__btn" aria-expanded={open} aria-controls={`kdl-good-${i}`}
                          onClick={() => setOpenGood((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))}>
                          <KdlArt name={g.art} size={32} />
                          <span style={{ flex: "1 1 auto" }}>{g.title}</span>
                          <KdlArt name="chev" size={32} style={{ color: "var(--color-text)", transform: open ? "rotate(180deg)" : undefined }} />
                        </button>
                        {open && <div className="kdl-acc__body" id={`kdl-good-${i}`}>{g.body}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
