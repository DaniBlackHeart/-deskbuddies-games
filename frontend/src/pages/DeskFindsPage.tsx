import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { FINDS_ART } from "../lib/findsArt";
import { useDeskFinds, type Category, type FindItem, type Tier } from "../lib/useDeskFinds";

// Desk Finds: the deskbits shop. Follows the "Debbie Desk Finds" design and the
// Desk Finds draft. Everything comes from the desk-finds Edge Function: the
// catalog, the prices, your balance and every purchase. The browser never sends a
// price, and buying never changes Buddy XP, level or access. While the shop switch
// is off, cards show Paused and you can still look around.
//
// Not built yet: Preview (it needs a Decorate screen), shop buddies, and Little
// Gifts. Gifts show only as a note about the rules, with no gift items or prices.

const CATEGORY_LABEL: Record<Category, string> = {
  accessories: "Desk Accessories",
  comfort: "Comfort",
  furniture: "Furniture",
  showpieces: "Showpieces",
  wardrobe: "Buddy Wardrobe",
};
const CATEGORY_ORDER: Category[] = ["accessories", "comfort", "furniture", "showpieces", "wardrobe"];
const TIER_LABEL: Record<Tier, string> = {
  small: "Small Find",
  cozy: "Cozy Find",
  statement: "Statement Find",
  showpiece: "Showpiece",
};

function Sprite({ itemKey }: { itemKey: string }) {
  const a = FINDS_ART[itemKey];
  if (!a) return null;
  const scale = Math.max(1, Math.min(Math.floor(180 / a.w), Math.floor(100 / a.h)));
  return (
    <svg
      aria-hidden="true"
      width={a.w * scale}
      height={a.h * scale}
      viewBox={`0 0 ${a.w} ${a.h}`}
      shapeRendering="crispEdges"
      style={{ display: "block", flex: "none" }}
    >
      {a.layers.map(([fill, d], i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </svg>
  );
}

export default function DeskFindsPage() {
  const { data, loading, error, notice, setNotice, buying, buy, reload } = useDeskFinds();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [pending, setPending] = useState<FindItem | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  // The confirm panel takes focus when it opens, and gives it back when it closes.
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  function ask(item: FindItem, el: HTMLElement) {
    trigger.current = el;
    setNotice("");
    setPending(item);
  }
  function cancel() {
    setPending(null);
    trigger.current?.focus();
  }
  async function confirm() {
    if (!pending) return;
    const item = pending;
    setPending(null);
    await buy(item);
    trigger.current?.focus();
  }

  const items = data?.items ?? [];
  const shown = items.filter((i) => filter === "all" || i.category === filter);
  const counts = (c: Category) => items.filter((i) => i.category === c).length;
  const categories = CATEGORY_ORDER.filter((c) => counts(c) > 0);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page df-page" id="desk-finds">
        <Link to="/my-desk" className="page-back">
          <span aria-hidden="true">‹</span> Back to My Desk
        </Link>
        <div className="df-title">
          <PixelIcon name="desk-finds" size={48} />
          <div>
            <h1 className="t-h1" style={{ margin: 0 }}>Desk Finds</h1>
            <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>
              Little things for your desk and your buddies. Pick what makes your space feel like yours.
            </p>
          </div>
        </div>

        <div role="status" aria-live="polite">{notice && <div className="df-notice">{notice}</div>}</div>

        {loading && !data ? (
          <p className="text-muted t-body" role="status">Opening the shop…</p>
        ) : error && !data ? (
          <div className="df-balance" role="alert">
            <p className="t-body" style={{ margin: 0 }}>{error}</p>
            <button type="button" className="df-btn df-btn--primary" onClick={reload}>Try again</button>
          </div>
        ) : data ? (
          <>
            <div className="df-balance">
              <span className="df-balance__num">
                <PixelIcon name="deskbits" size={32} />
                <span className="df-num df-num--big">{data.balance}</span>
                <span className="t-body" style={{ fontWeight: 700 }}>deskbits to spend</span>
              </span>
              <span className="t-body-sm text-muted df-balance__text">
                {data.shop_open
                  ? "Everything here is earned with deskbits. No money buys these. Spending never changes your Buddy XP, level or access."
                  : "The shop is paused. You can still look around. Spending never changes your Buddy XP, level or access."}
              </span>
            </div>

            <section aria-labelledby="df-browse-h" className="df-stack">
              <h2 className="t-h2" id="df-browse-h" style={{ margin: 0 }}>Browse</h2>
              <div role="group" aria-label="Category" className="df-chips">
                <button type="button" className={"df-chip" + (filter === "all" ? " df-chip--on" : "")} aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setPending(null); }}>
                  All ({items.length})
                </button>
                {categories.map((c) => (
                  <button key={c} type="button" className={"df-chip" + (filter === c ? " df-chip--on" : "")} aria-pressed={filter === c} onClick={() => { setFilter(c); setPending(null); }}>
                    {CATEGORY_LABEL[c]} ({counts(c)})
                  </button>
                ))}
              </div>

              {pending && (
                <div ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="df-confirm-h" className="df-confirm">
                  <div style={{ minWidth: 0 }}>
                    <b id="df-confirm-h" className="t-body">Buy {pending.name} for {pending.price} deskbits?</b>
                    <p className="t-body-sm text-muted" style={{ margin: "2px 0 0" }}>
                      You will have {Math.max(0, data.balance - pending.price)} deskbits left. Buying never changes your Buddy XP, level or access. There is no undo.
                    </p>
                  </div>
                  <div className="df-confirm__actions">
                    <button type="button" className="df-btn df-btn--primary" onClick={confirm}>Confirm</button>
                    <button type="button" className="df-btn" onClick={cancel}>Cancel</button>
                  </div>
                </div>
              )}

              {shown.length === 0 ? (
                <p className="text-muted t-body" style={{ margin: 0 }}>Nothing in the shop right now.</p>
              ) : (
                <ul className="df-grid">
                  {shown.map((it) => {
                    const short = !it.owned && data.shop_open && data.balance < it.price;
                    const canBuy = !it.owned && data.shop_open && !short && !buying;
                    const pct = Math.max(0, Math.min(100, Math.round((data.balance / it.price) * 100)));
                    const descId = "df-d-" + it.key;
                    return (
                      <li key={it.key} className="df-card">
                        <div className={"df-art df-art--" + it.category}><Sprite itemKey={it.key} /></div>
                        <h3 className="df-card__name">{it.name}</h3>
                        <div className="df-tags">
                          <span className="df-tag">{TIER_LABEL[it.tier]}</span>
                          {it.is_style && <span className="df-tag df-tag--style">Style</span>}
                        </div>
                        {it.note && <p className="df-note">{it.note}</p>}
                        <span className="df-price">
                          <PixelIcon name="deskbits" size={16} />
                          <span className="df-num">{it.price}</span>
                          <span className="t-body-sm text-muted">deskbits</span>
                        </span>
                        {short && (
                          <div className="df-progress" id={descId}>
                            <div aria-hidden="true" className="df-progress__bar"><div className="df-progress__fill" style={{ width: pct + "%" }} /></div>
                            <span className="df-count">{data.balance} of {it.price} deskbits</span>
                          </div>
                        )}
                        {it.owned && <p className="df-status">Owned.</p>}
                        {!it.owned && !data.shop_open && <p className="df-status">The shop is paused right now.</p>}
                        <div className="df-actions">
                          <button
                            type="button"
                            className={"df-btn" + (canBuy ? " df-btn--primary" : "")}
                            aria-disabled={!canBuy}
                            aria-describedby={short ? descId : undefined}
                            onClick={(e) => { if (canBuy) ask(it, e.currentTarget); }}
                          >
                            {it.owned ? "Owned" : !data.shop_open ? "Paused" : "Buy"}
                            <span className="sr-only"> {it.name}</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="t-body-sm text-muted" style={{ margin: 0 }}>
                Prices may change as we learn how much people earn. What you paid stays yours, and anything you own stays yours even if it leaves the shop.
              </p>
            </section>

            <section aria-labelledby="df-gifts-h" className="df-later">
              <h2 className="t-h3" id="df-gifts-h" style={{ margin: 0 }}>Little Gifts</h2>
              <p className="t-body text-muted" style={{ margin: 0 }}>
                Coming later. Send a small treat to a friend. They get the item only, and gifts never pay XP to either side. Your message is visible to members, and we will say so before you send.
              </p>
            </section>
            <p className="t-body-sm text-muted" style={{ margin: 0 }}>
              Supporter items are separate. They have no deskbits price and never give XP, deskbits or access.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
