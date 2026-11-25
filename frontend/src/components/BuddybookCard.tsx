import { Link } from "react-router-dom";
import PixelIcon from "./PixelIcon";
import { useBuddybook } from "../lib/useBuddybook";

// Buddybook card on Beyond the Desk (Debbie nav v4: Buddybook has no icon in
// the bar; it opens from here). Shows the member's real stamp count from the
// same buddybook function the Buddybook page uses.

export default function BuddybookCard() {
  const { data, loading, error } = useBuddybook();
  const stamps = data?.counts.stamps;

  let line = "Your stamps, buddies and keepsakes live here.";
  if (loading && !data) line = "Opening your Buddybook…";
  else if (error && !data) line = "Couldn’t load your Buddybook just now. You can still open it.";
  else if (stamps !== undefined)
    line = `${stamps} ${stamps === 1 ? "stamp" : "stamps"} collected. Your buddies and keepsakes live here too.`;

  return (
    <section className="bd-bbcard" aria-labelledby="bd-bbcard-h">
      <div className="bd-bbcard__head">
        <span className="bd-bbcard__icon" aria-hidden="true">
          <PixelIcon name="buddybook" size={32} />
        </span>
        <div>
          <h2 id="bd-bbcard-h" className="t-h3" style={{ margin: 0 }}>Buddybook</h2>
          <p className="t-body-sm text-muted" style={{ margin: 0 }}>Your stamps and milestones</p>
        </div>
      </div>
      <div className="bd-bbcard__box">
        <span className="bd-bbcard__eyebrow">YOUR JOURNAL</span>
        <span className="t-body-sm">{line}</span>
      </div>
      <Link to="/buddybook" className="bd-btn bd-bbcard__open">
        Open Buddybook
      </Link>
    </section>
  );
}
