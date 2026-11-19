import { Link, NavLink, useLocation } from "react-router-dom";
import { isGamesRoute } from "../lib/gameRoutes";

// Tab order is fixed by product direction: Home, Games, Boards, Events,
// DeskFinds, Profile. Labels are rendered uppercase via CSS (.app-tab), so the
// text here stays in normal case for screen readers.
const TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Home", end: true },
  { to: "/games", label: "Games" },
  { to: "/boards", label: "Boards" },
  { to: "/events", label: "Events" },
  { to: "/deskfinds", label: "DeskFinds" },
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
      <div className="container" style={{ padding: "16px 24px 8px" }}>
        <Link to="/" className="app-brand">
          Debbie
        </Link>

      </div>

      <nav className="container app-tabs" aria-label="Main">
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
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}
