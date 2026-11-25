import { useState } from "react";
import { Link } from "react-router-dom";
import PixelIcon from "./PixelIcon";
import BuddySprite from "./BuddySprite";
import { useWhosAround } from "../lib/useWhosAround";
import { useDeskFinds } from "../lib/useDeskFinds";
import { useBuddyCollection } from "../lib/useBuddyCollection";
import { FINDS_ART } from "../lib/findsArt";
import { LENGTHS } from "../lib/focusBlock";

// "Around your desk" (Debbie nav v4, 24 Nov 2026): Desk Time, Desk Finds,
// Buddy Collection and Desk Stickies are sections of My Desk. Each card shows a
// small preview and a button to its own page, and that page has a Back link here.

function CardHead({ icon, title, blurb }: { icon: React.ReactNode; title: string; blurb: string }) {
  return (
    <div className="ard-head">
      <span className="ard-icon" aria-hidden="true">{icon}</span>
      <div>
        <h3 className="t-h3" style={{ margin: 0 }}>{title}</h3>
        <p className="t-body-sm text-muted" style={{ margin: 0 }}>{blurb}</p>
      </div>
    </div>
  );
}

export function DeskTimeCard() {
  const { around } = useWhosAround();
  const [mins, setMins] = useState<number>(25);
  // "around" also lists members who only checked in today; only Focus Block people count here.
  const count = around ? around.filter((p) => p.focus_minutes_left !== null).length : null;
  return (
    <section className="ard-card" aria-labelledby="ard-dt">
      <div className="ard-head">
        <span className="ard-icon" aria-hidden="true"><PixelIcon name="desk-time" size={32} /></span>
        <div>
          <h3 id="ard-dt" className="t-h3" style={{ margin: 0 }}>Desk Time</h3>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>Quiet company for getting things done</p>
        </div>
      </div>
      <div className="ard-box">
        <span className="ard-eyebrow">A FOCUS BLOCK, YOUR WAY</span>
        <div role="group" aria-label="Focus length" className="ard-chips">
          {LENGTHS.map((m) => (
            <button key={m} type="button" aria-pressed={mins === m} className={"md-seg" + (mins === m ? " md-seg--on" : "")} onClick={() => setMins(m)}>
              {m} min
            </button>
          ))}
        </div>
        {count !== null && (
          <p className="t-body-sm" style={{ margin: 0 }}>
            {count === 0 ? "Nobody else is in a Focus Block right now." : `${count} ${count === 1 ? "member" : "members"} focusing now`}
          </p>
        )}
        <span className="t-caption text-muted">Works in Discord or not. Stepping away never takes back what you earned.</span>
      </div>
      <Link to={`/desk-time?minutes=${mins}`} className="btn btn-secondary ard-open">Start a Focus Block</Link>
    </section>
  );
}

function FindTile({ itemKey }: { itemKey: string }) {
  const a = FINDS_ART[itemKey];
  if (!a) return <span className="ard-find__tile" aria-hidden="true" />;
  const scale = Math.max(1, Math.min(Math.floor(32 / a.w), Math.floor(32 / a.h)));
  return (
    <span className="ard-find__tile" aria-hidden="true">
      <svg width={a.w * scale} height={a.h * scale} viewBox={`0 0 ${a.w} ${a.h}`} shapeRendering="crispEdges" style={{ display: "block" }}>
        {a.layers.map(([fill, d], i) => <path key={i} d={d} fill={fill} />)}
      </svg>
    </span>
  );
}

export function DeskFindsCard() {
  const { data } = useDeskFinds();
  // The three cheapest things you don't own yet. "New this week" needs a release date that doesn't exist yet.
  const few = (data?.items ?? []).filter((i) => !i.owned).sort((a, b) => a.price - b.price).slice(0, 3);
  return (
    <section className="ard-card" aria-labelledby="ard-df">
      <div className="ard-head">
        <span className="ard-icon" aria-hidden="true"><PixelIcon name="desk-finds" size={32} /></span>
        <div>
          <h3 id="ard-df" className="t-h3" style={{ margin: 0 }}>Desk Finds</h3>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>Spend your deskbits on your desk</p>
        </div>
      </div>
      <div className="ard-box">
        <span className="ard-eyebrow">A FEW FINDS</span>
        {data && few.length === 0 && <p className="t-body-sm text-muted" style={{ margin: 0 }}>You have every Find so far.</p>}
        {few.map((i) => (
          <div key={i.key} className="ard-find">
            <FindTile itemKey={i.key} />
            <b>{i.name}</b>
          </div>
        ))}
        {data && <span className="t-caption text-muted">You have {data.balance.toLocaleString()} deskbits to spend.</span>}
      </div>
      <Link to="/deskfinds" className="btn btn-secondary ard-open">Browse Desk Finds</Link>
    </section>
  );
}

export function BuddyCollectionCard() {
  const { buddies, failed } = useBuddyCollection();
  const found = buddies?.filter((b) => b.found).length ?? 0;
  // Found buddies first, then a few shadows, as in the collection.
  const shown = buddies ? [...buddies].sort((a, b) => Number(b.found) - Number(a.found)).slice(0, 6) : [];
  return (
    <section className="ard-card ard-bc" aria-labelledby="ard-bc">
      <div className="ard-head">
        <span className="ard-icon" aria-hidden="true"><BuddySprite id="paper" found size={32} /></span>
        <div>
          <h3 id="ard-bc" className="t-h3" style={{ margin: 0 }}>Buddy Collection</h3>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>Every Desk Buddy you have found</p>
        </div>
      </div>
      <div className="ard-box">
        <span className="ard-eyebrow">YOUR DESK BUDDIES</span>
        {failed && !buddies && <p className="t-body-sm text-muted" style={{ margin: 0 }}>Couldn’t load your collection just now.</p>}
        {buddies && (
          <>
            <div className="ard-sprites" aria-hidden="true">
              {shown.map((b) => <BuddySprite key={b.key} id={b.key} found={b.found} size={40} />)}
            </div>
            <p className="t-body-sm" style={{ margin: 0 }}>
              {found} of {buddies.length} found. Shadows are buddies you haven’t met yet.
            </p>
          </>
        )}
      </div>
      <Link to="/buddy-collection" className="btn btn-secondary ard-open">Open Buddy Collection</Link>
    </section>
  );
}

// The sticky-note icon from the My Desk design (a yellow note with a terracotta pin).
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

// Desk Stickies are not built yet (visitor desks come later), so this card says so
// instead of showing sample notes.
export function DeskStickiesCard() {
  return (
    <section className="ard-card" aria-labelledby="ard-ds">
      <CardHead
        icon={<StickyIcon />}
        title="Desk Stickies"
        blurb="Notes visitors leave on your pin board"
      />
      <div className="ard-box">
        <span className="ard-eyebrow">COMING SOON</span>
        <span className="t-body-sm">Notes visitors leave will land here, and only you will see this list.</span>
      </div>
    </section>
  );
}
