import { Link, NavLink, useLocation } from "react-router-dom";
import { isGamesRoute } from "../lib/gameRoutes";
import PixelIcon, { type PixelIconName } from "./PixelIcon";
import MemberStats from "./MemberStats";

// Tab order is fixed by product direction: Home, Games, Boards, Events,
// Desk Finds, Profile. Icons come from the locked Debbie icon set v1 and sit
// beside a visible label. Profile has no icon in v1 (see the .app-tab__icon
// placeholder below) — it needs a v1.1 addition.
const TABS: { to: string; label: string; icon?: PixelIconName; end?: boolean }[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/games", label: "Games", icon: "reality-break" },
  { to: "/boards", label: "Boards", icon: "buddy-boards" },
  { to: "/events", label: "Events", icon: "buddy-calendar" },
  { to: "/deskfinds", label: "Desk Finds", icon: "desk-finds" },
  { to: "/profile", label: "Profile" },
];

export default function AppHeader() {
  const { pathname } = useLocation();

  // Game lobby/play and MOD pages live outside /games, but they belong to the
  // Games tab, so keep it highlighted there.
  const inGames = isGamesRoute(pathname);

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border-soft)",
        background: "var(--color-surface)",
      }}
    >
      <div className="container app-brandrow">
        <Link to="/" className="app-brand">
          <img src="/favicon.svg" alt="" width={32} height={32} className="app-brand__mark" />
          Debbie
        </Link>
        {/* Narrow screens: chips sit beside the brand. Wide screens: right of the tabs. */}
        <MemberStats className="app-stats--narrow" />
      </div>

      <div className="container app-navrow">
        <nav className="app-tabs" aria-label="Main">
          {TABS.map((tab) => {
            const forceActive = tab.to === "/games" && inGames;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  "app-tab" + (isActive || forceActive ? " app-tab--active" : "")
                }
                aria-current={undefined}
              >
                <span className="app-tab__icon" aria-hidden="true">
                  {tab.icon && <PixelIcon name={tab.icon} size={16} />}
                </span>
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <MemberStats className="app-stats--wide" />
      </div>
    </header>
  );
}
