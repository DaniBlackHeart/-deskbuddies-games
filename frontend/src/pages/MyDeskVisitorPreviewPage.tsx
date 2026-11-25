import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { useMyDesk } from "../lib/useMyDesk";
import { buddyName } from "../lib/deskCatalog";

// "See how visitors see it" (Debbie My Desk design). A PREVIEW of your own desk
// the way a visitor will see it: the desk, your companions and a pin board. It
// shows only your own saved desk, so nothing here is sent or shared. Visiting
// other members' desks and Desk Stickies are later work (not the first
// release); until then nobody else can open this. A real visitor view must be
// built server-side and never carry deskbits, journals, goals or Focus history.

export default function MyDeskVisitorPreviewPage() {
  const { profile } = useAuth();
  const { saved, loading } = useMyDesk();
  const name = profile?.username ?? "You";
  const names = saved.companions.map(buddyName);
  const scene = `/desk/scene-${saved.companions[0] ?? "none"}.png`;
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page vp-page" id="visitor-preview">
        <Link to="/my-desk" className="page-back">
          <span aria-hidden="true">‹</span> Back to My Desk
        </Link>
        <div className="vp-note" role="note">
          <b>Preview only.</b> Nobody else can visit your desk yet. This is what visitors will see when visits arrive: your desk, your companions and a pin board. They will never see your deskbits, journals, goals or Focus history.
        </div>
        <div>
          <h1 className="t-h1" style={{ margin: 0 }}>{name}'s desk</h1>
          <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>
            {names.length > 0 ? `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} keeping the seat.` : "The companion spot is waiting for a first buddy."}
          </p>
        </div>
        <section className="card vp-desk" aria-label={`${name}'s desk`}>
          {loading ? (
            <p className="text-muted" role="status">Loading your desk…</p>
          ) : (
            <div className="md-scene">
              <img src={scene} alt={names.length ? `${name}'s desk with ${names.join(" and ")} on the companion mat` : `${name}'s desk with an empty spot for a companion`} width={160} height={112} className="md-scene__img" />
            </div>
          )}
          <p className="text-muted t-body-sm" style={{ margin: 0 }}>Placeholder art: only the companion spot redraws, and it can show one buddy.</p>
        </section>
        <section className="card" aria-labelledby="vp-pin">
          <h2 id="vp-pin" className="md-h2">{name}'s pin board</h2>
          <p className="text-muted t-body-sm" style={{ margin: 0 }}>
            No stickies yet this week. Desk Stickies are coming later.
          </p>
        </section>
      </main>
    </div>
  );
}
