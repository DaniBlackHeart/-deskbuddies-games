import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
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
const KEEPS: { name: string; text: string }[] = [
  { name: "The games", text: "Trivia Night, UNO, Family Feud and the rest of Reality Break." },
  { name: "Desk Time", text: "Focus Blocks and Shared Desk." },
  { name: "My Desk and your buddies", text: "Your desk, Buddy Collection and Buddybook." },
  { name: "The Common Room", text: "Around the desk, and Show Your Buddies posts." },
  { name: "Beyond the Desk", text: "Daily Detours, Weekly Wins and Side Quests." },
  { name: "Buddy Calendar", text: "Events you can join, and check-in." },
  { name: "The Discord link", text: "The bot that joins the server to Debbie." },
];

const peso = (n: number) => "₱ " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function fillPct(c: SupportCost) {
  if (c.status === "covered") return 100;
  if (c.status === "not_yet") return 0;
  if (c.covered_pct !== null) return c.covered_pct;
  if (c.covered_amount !== null && c.total_amount) return Math.min(99, Math.round((c.covered_amount / c.total_amount) * 100));
  return 50; // "partly" with no figure: a half-filled bar, not a measurement
}

function CostCard({ c, showAmounts }: { c: SupportCost; showAmounts: boolean }) {
  const word = c.status ? WORD[c.status] : null;
  const pct = fillPct(c);
  const amounts = showAmounts && c.covered_amount !== null && c.total_amount ? `${peso(c.covered_amount)} of ${peso(c.total_amount)} covered` : null;
  return (
    <article className="kdl-cost">
      <h3 className="kdl-h3">{c.label}</h3>
      <p className="kdl-muted" style={{ margin: 0 }}>{c.pays_for}</p>
      {word && (
        <>
          <div className="kdl-bar" role="img" aria-label={`${c.label}: ${word.toLowerCase()}${amounts ? ", " + amounts : ""}`}>
            <div className="kdl-bar__fill" style={{ width: pct + "%", borderRight: pct > 0 && pct < 100 ? "2px solid var(--color-text)" : 0 }} />
          </div>
          <div className="kdl-word">{word}</div>
          {amounts && <div className="kdl-muted kdl-small">{amounts}</div>}
        </>
      )}
    </article>
  );
}

export default function KeepTheDeskLitPage() {
  const { data, loading, error, reload } = useSupport();

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page kdl-page" id="keep-the-desk-lit">
        <div className="kdl-head">
          <div className="kdl-eyebrow">COMMUNITY SUPPORT · ALWAYS OPTIONAL</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Keep the Desk Lit</h1>
          <p className="text-muted t-subtitle" style={{ margin: "4px 0 0", maxWidth: 720 }}>
            Debbie has a few real costs to run. If you would like to help with them, this page shows where the money goes. Giving is optional, and it never changes your Buddy Level, your deskbits or what you can do in Debbie.
          </p>
        </div>

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
              <div className="kdl-sechead">
                <PixelIcon name="keep-the-desk-lit" size={48} />
                <h2 className="kdl-h2" id="kdl-stand">Where things stand</h2>
              </div>
              {data.status_state ? (
                <div>
                  <p role="status" className="kdl-status">{STATUS_COPY[data.status_state].title}</p>
                  <p className="kdl-muted" style={{ margin: 0 }}>{STATUS_COPY[data.status_state].line}</p>
                </div>
              ) : (
                <p className="kdl-muted" style={{ margin: 0 }}>
                  The team hasn’t shared the cost details yet. Here is what the costs are for.
                </p>
              )}
              <div className="kdl-costs">
                {data.costs.map((c) => <CostCard key={c.key} c={c} showAmounts={data.show_amounts} />)}
              </div>
              {data.costs.some((c) => c.status) && (
                <div className="kdl-legend">
                  <span><span className="kdl-swatch kdl-swatch--on" aria-hidden="true" />Covered</span>
                  <span><span className="kdl-swatch" aria-hidden="true" />Not yet covered</span>
                </div>
              )}
              <p className="kdl-muted kdl-small" style={{ margin: 0 }}>Support goes to running costs first, then maintenance, then events.</p>
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
                  <h2 className="kdl-h2" id="kdl-thanks">Your thank-you</h2>
                  <ul className="kdl-list">
                    <li>One supporter cosmetic set, the same for everyone, labelled Supporter.</li>
                    <li>Added once the team has checked your support.</li>
                    <li>Your name on The Thank-You Board, only if you choose.</li>
                  </ul>
                </section>
                <section className="kdl-card" aria-labelledby="kdl-board">
                  <div>
                    <h2 className="kdl-h2" id="kdl-board">The Thank-You Board</h2>
                    <p className="kdl-muted" style={{ margin: "6px 0 0" }}>Members who chose to be named. No amounts.</p>
                  </div>
                  <div>
                    <span className="kdl-btn kdl-btn--off" aria-disabled="true">Coming soon</span>
                  </div>
                </section>
              </div>
            </div>

            <div className="kdl-row">
              <section className="kdl-card" aria-labelledby="kdl-keeps">
                <div>
                  <h2 className="kdl-h2" id="kdl-keeps">What this keeps running</h2>
                  <p className="kdl-muted" style={{ margin: "6px 0 0" }}>The costs above are what keep these things open for everyone.</p>
                </div>
                <div className="kdl-keeps">
                  {KEEPS.map((k) => (
                    <div key={k.name} className="kdl-keep">
                      <div className="kdl-keep__name">{k.name}</div>
                      <div className="kdl-muted kdl-small">{k.text}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="kdl-card" aria-labelledby="kdl-know">
                <h2 className="kdl-h2" id="kdl-know">Good to know</h2>
                <div className="kdl-acc">
                  <details className="kdl-acc__item">
                    <summary>Where the money goes</summary>
                    <div className="kdl-acc__body">
                      <p><b>Running costs.</b> Hosting, the database and backups, the Discord bot and the tools Debbie uses.</p>
                      <p><b>Maintenance and development.</b> Fixing things, building features, and pay for the people who look after Debbie and the community.</p>
                      <p><b>Community Events/Initiatives.</b> Game nights and community activities.</p>
                    </div>
                  </details>
                  <details className="kdl-acc__item">
                    <summary>What support never changes</summary>
                    <div className="kdl-acc__body">
                      <ul className="kdl-list kdl-list--sm">
                        <li>Buddy XP and Buddy Level.</li>
                        <li>deskbits: earned by taking part, never bought.</li>
                        <li>What you can open or join.</li>
                        <li>Games, scores and rank.</li>
                        <li>Buddies you earn from milestones.</li>
                      </ul>
                      <p>Not giving changes nothing about you here. Belonging is not measured in money.</p>
                    </div>
                  </details>
                  <details className="kdl-acc__item">
                    <summary>What stays, whatever happens</summary>
                    <div className="kdl-acc__body">
                      <p><b>The DeskBuddies Discord community stays.</b> It is a community first, and Debbie is its companion app.</p>
                      <p>A smaller, Discord-only way to carry on is being planned. It is not built or promised yet, so we won’t say more than that.</p>
                    </div>
                  </details>
                  <details className="kdl-acc__item">
                    <summary>Boosting the Discord server</summary>
                    <div className="kdl-acc__body">
                      <p>Boosting is something you do with your own Discord account. It is a separate thing from supporting Debbie here, and it is thanked in Discord.</p>
                    </div>
                  </details>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
