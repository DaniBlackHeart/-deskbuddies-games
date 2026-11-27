import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { useMyDesk } from "../lib/useMyDesk";
import { buddyName } from "../lib/deskCatalog";
import DeskScene from "../components/DeskScene";

// "See how visitors see it" (Debbie My Desk design). A PREVIEW of your own desk
// the way a visitor will see it: the desk, your companions and a pin board. It
// shows only your own saved desk, so nothing here is sent or shared. The real
// visitor view is the Buddy Profile page, built server-side so it never carries
// deskbits, journals, goals or Focus history.

export default function MyDeskVisitorPreviewPage() {
  const { profile } = useAuth();
  const { saved, loading } = useMyDesk();
  const name = profile?.username ?? "You";
  const names = saved.companions.map(buddyName);
  const scene = `/desk/scene-${saved.companions[0] ?? "none"}.png`;
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page vp-page mp-page" id="visitor-preview">
        <Link to="/my-desk" className="page-back">
          <span aria-hidden="true">‹</span> Back to My Desk
        </Link>
        <div className="vp-note" role="note">
          <b>Preview only.</b> This is what visitors see when they open your Buddy Profile: your desk, your companions and a pin board. They will never see your deskbits, journals, goals or Focus history.
        </div>
        <div>
          <h1 className="t-h1" style={{ margin: 0 }}>{name}'s desk</h1>
        </div>
        <div className="mp-cols">
          <section className="card vp-desk" aria-label={`${name}'s desk`}>
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>
              {names.length > 0 ? `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} keeping the seat.` : "The companion spot is waiting for a first buddy."}
            </p>
            {loading ? (
              <p className="text-muted" role="status">Loading your desk…</p>
            ) : (
              <div className="md-scene">
                <DeskScene src={scene} alt={names.length ? `${name}'s desk with ${names.join(" and ")} on the companion mat` : `${name}'s desk with an empty spot for a companion`} decor={saved.decor} className="md-scene__img" />
              </div>
            )}
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>Placeholder art: only the companion spot redraws, and it can show one buddy.</p>
            <h2 id="vp-pin" className="md-h2" style={{ marginTop: 8 }}>{name}'s pin board</h2>
            <div className="mp-cork" role="img" aria-label="Empty pin board">
              <span>No stickies yet</span>
            </div>
            <p className="text-muted t-body-sm" style={{ margin: 0 }}>Placeholder pin board. Real art and the pile’s look are still to design.</p>
          </section>

          <div className="mp-side">
            <section className="card" aria-labelledby="vp-stickies">
              <h2 id="vp-stickies" className="md-h2">Desk Stickies</h2>
              <p className="text-muted t-body-sm" style={{ margin: 0 }}>
                Short notes from visitors who have checked in. They refresh each week, and you choose which ones to keep.
              </p>
              <p className="text-muted t-body-sm" style={{ margin: 0 }}>Your real stickies are on My Desk, under Desk Stickies.</p>
              <span className="kdl-btn kdl-btn--off mp-btn" aria-disabled="true">Leave a Desk Sticky (visitors only)</span>
            </section>
            <section className="card" aria-labelledby="vp-see">
              <h2 id="vp-see" className="md-h2">What visitors can see</h2>
              <div>
                <b className="t-body-sm">Shown</b>
                <p className="t-body" style={{ margin: "2px 0 0" }}>The desk, the companion, and Desk Stickies.</p>
              </div>
              <div>
                <b className="t-body-sm">Never shown</b>
                <p className="t-body" style={{ margin: "2px 0 0" }}>deskbits balance, journals, private goals, focus history and anything kept private. Visible to signed-in members only, never on the public internet.</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
