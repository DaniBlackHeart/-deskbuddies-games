import { useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import MemberStats from "../components/MemberStats";
import PixelIcon from "../components/PixelIcon";
import { useAuth } from "../contexts/AuthContext";
import { useBuddybook } from "../lib/useBuddybook";
import { useDailyCheckIn } from "../lib/useDailyCheckIn";
import { useMemberProgress } from "../lib/useMemberProgress";
import { useMyDesk } from "../lib/useMyDesk";

// Buddy Profile. Follows the "Debbie Buddy Profile" design, using the member's own real data.
// "How others see it" is a preview on the member's own page: it hides what other members must
// not see (XP total, stamp and Keepsake counts). There is no visitor profile page yet; when one
// ships, the server must send visitors only the visible fields, not hide them on screen.
// Nameplate, My Avatar and the Desk Log link go to "Coming soon" pages until those features
// are designed and built. The Brag Shelf is "Coming soon" in the design itself.

function since(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ProfilePage() {
  const { profile } = useAuth();
  const progress = useMemberProgress();
  const { status: streak } = useDailyCheckIn();
  const { data: book } = useBuddybook();
  const { saved } = useMyDesk();
  const [others, setOthers] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const name = profile?.username ?? "";
  const owned = book ? book.buddies.filter((b) => b.owned) : null;
  const scene = `/desk/scene-${saved.companions[0] ?? "none"}.png`;
  const dash = "—";

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page pf-page" id="profile">
        <section className="pf-card pf-name" aria-labelledby="pf-title">
          <div className="pf-avatar" aria-hidden="true">
            {profile?.avatar_url && !imgFailed ? (
              <img src={profile.avatar_url} alt="" width={72} height={72} referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
            ) : (
              <span>{(name[0] ?? "?").toUpperCase()}</span>
            )}
          </div>
          <div className="pf-name__main">
            <div className="pf-eyebrow">BUDDY PROFILE</div>
            <h1 className="t-h1" id="pf-title" style={{ margin: 0 }}>
              {name}
              {profile?.is_mod && <span className="badge badge-mod" style={{ marginLeft: 10, verticalAlign: "middle" }}>MOD</span>}
            </h1>
            <p className="pf-small" style={{ margin: 0 }}>
              <Link className="pf-plate" to="/nameplate">Nameplate: Coming soon</Link>
            </p>
            <p className="text-muted pf-small" style={{ margin: 0 }}>On Debbie since {since(profile?.created_at)}</p>
          </div>

          <div className="pf-level">
            <strong>Buddy Level {progress.level}</strong>
            <MemberStats showProgress showDeskbits={false} showXp={!others} />
            {!others && <span className="text-muted pf-small">{progress.xp.toLocaleString()} XP earned so far. The level curve is not decided yet, so the bar stays empty.</span>}
          </div>

          <div className="pf-actions">
            <div role="group" aria-label="Profile view" className="pf-row">
              <button type="button" aria-pressed={!others} className={"pf-chip" + (!others ? " pf-chip--on" : "")} onClick={() => setOthers(false)}>Your view</button>
              <button type="button" aria-pressed={others} className={"pf-chip" + (others ? " pf-chip--on" : "")} onClick={() => setOthers(true)}>How others see it</button>
            </div>
            {!others && (
              <div className="pf-row">
                <Link className="pf-chip" to="/buddybook">Buddybook</Link>
                <Link className="pf-chip" to="/my-avatar">My Avatar</Link>
              </div>
            )}
          </div>

          {others && (
            <p className="pf-others" role="status">
              <strong>This is what other members see.</strong> Your Buddy Level and Buddy Streak are shown. Your XP total, stamp and Keepsake counts, private goals, journals, books and habits are not. Items you hide on your shelf are not shown either.
            </p>
          )}
        </section>

        <div className={"pf-stats" + (others ? " pf-stats--one" : "")}>
          <div className="pf-card pf-stat">
            <span className="pf-stat__label">Buddy Streak</span>
            <strong className="pf-stat__val">{streak ? (streak.current_streak > 0 ? `${streak.current_streak} day${streak.current_streak === 1 ? "" : "s"}` : "Starts when you check in") : dash}</strong>
            {!others && streak && <span className="text-muted pf-small">Best: {streak.longest_streak} day{streak.longest_streak === 1 ? "" : "s"}</span>}
          </div>
          {!others && (
            <>
              <Link className="pf-card pf-stat pf-stat--link" to="/buddybook">
                <span className="pf-stat__label">Stamps</span>
                <strong className="pf-stat__val">{book ? book.counts.stamps : dash}</strong>
                <span className="text-muted pf-small">See it in your Buddybook</span>
              </Link>
              <Link className="pf-card pf-stat pf-stat--link" to="/beyond-the-desk">
                <span className="pf-stat__label">Keepsakes</span>
                <strong className="pf-stat__val">{book ? book.counts.keepsakes : dash}</strong>
                <span className="text-muted pf-small">Permanent, never lost</span>
              </Link>
            </>
          )}
        </div>

        <div className="pf-two">
          <section className="pf-card" aria-labelledby="pf-desk">
            <div className="pf-between">
              <h2 className="pf-h2" id="pf-desk">{others ? `${name}’s Desk` : "My Desk"}</h2>
              {!others && <Link className="pf-chip pf-chip--on" to="/my-desk">Open My Desk</Link>}
            </div>
            <div className="pf-scene">
              <img src={scene} alt={saved.companions[0] ? "Your desk with a buddy" : "Your desk"} width={160} height={112} />
            </div>
          </section>

          <section className="pf-card" aria-labelledby="pf-buddies">
            <h2 className="pf-h2" id="pf-buddies">Desk Buddies</h2>
            {owned === null ? (
              <p className="text-muted pf-small" style={{ margin: 0 }}>Loading…</p>
            ) : owned.length === 0 ? (
              <p className="text-muted pf-small" style={{ margin: 0 }}>No Desk Buddies yet. They come from milestones and the shop.</p>
            ) : (
              <>
                <p className="text-muted pf-small" style={{ margin: 0 }}>{owned.length} collected.</p>
                <ul className="pf-buddies">
                  {owned.map((b) => (
                    <li key={b.key} className="pf-buddy">
                      <img src={`/desk/scene-${b.key}.png`} alt="" width={60} height={42} />
                      <span>{b.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!others && <div><Link className="pf-chip" to="/buddybook">Open Buddy Collection</Link></div>}
          </section>
        </div>

        <section className="pf-card" aria-labelledby="pf-shelf">
          <h2 className="pf-h2" id="pf-shelf">The Brag Shelf</h2>
          <p style={{ margin: 0 }}><strong>Coming soon.</strong> The trophies you earn will be shown here.</p>
        </section>

        <section className="pf-card" aria-labelledby="pf-see">
          <h2 className="pf-h2" id="pf-see"><PixelIcon name="buddybook" size={16} /> Who can see what</h2>
          <ul className="pf-list">
            <li><strong>Other members can see:</strong> your name, nameplate, Buddy Level, Buddy Streak, desk, Desk Buddies, and your check-ins, focus blocks and achievements in the Desk Log.</li>
            <li><strong>Only you can see:</strong> your XP total, stamp and Keepsake counts, goals, journals, books, habits and focus goals. Your rewards in the Desk Log are yours alone.</li>
            <li><strong>Nothing here is public on the internet.</strong> It is shown to signed-in members only.</li>
          </ul>
          <div><Link className="pf-link" to="/desk-log">Open my Desk Log</Link></div>
        </section>
      </main>
    </div>
  );
}
